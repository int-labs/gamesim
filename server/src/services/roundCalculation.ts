// Round calculation, extracted so it can run either standalone
// (POST /rounds/:id/calculate) or inside the atomic end-of-round transaction
// (POST /rounds/:id/end).
//
// WHY THIS EXISTS
// The two operations used to be separate endpoints with no shared code, and
// because `calculateRound` refuses to run on a round that is not Active, an
// operator who closed a round first could never calculate it — the round's
// results were stranded permanently. Stratagem avoids this by making
// "end round" one transaction (close → calculate → advance); this module is
// the piece that lets gamesim do the same without duplicating the engine call.
//
// Everything here is session-aware: pass a ClientSession and every read and
// write joins that transaction, so a mid-calculation failure rolls the round
// status back too.

import mongoose, { ClientSession } from "mongoose";
import BaseData from "../models/baseData";
import Decision from "../models/decisions";
import Product from "../models/products";
import Results from "../models/results";
import Simulation from "../models/simulations";
import Team from "../models/teams";
import {
  MarketModelField,
  MarketModelProduct,
} from "../sim/calcMarketModel";
import {
  BaseVariables,
  DecisionGlobalInputEntry,
  ProductField,
  calcFinancials,
  readCostTreatment,
  toProjectionMetrics,
} from "../sim/calcFinancials";

export interface RoundCalcSuccess {
  ok: true;
  resultsWritten: number;
  teamsUpdated: number;
}

export interface RoundCalcFailure {
  ok: false;
  /** HTTP status the caller should surface. */
  status: number;
  message: string;
}

export type RoundCalcOutcome = RoundCalcSuccess | RoundCalcFailure;

/**
 * MARKET SHARE — the normalised `productScore` across the teams competing for
 * one product. Pure, and exported so it is tested without a database.
 *
 *     share_i = score_i / Σ score        ← sums to 1 across the competitors
 *
 * Shares SUM TO 1 regardless of how many teams skipped the product: a team that
 * is the only one making something takes the whole market for it. The teams
 * that ignored it are not owed a slice of it.
 *
 * `productScore` IS the weighted value of a team's decisions — already
 * direction-weighted against the augmented dynamic price — so normalising it is
 * the whole model. See ../../README.md#market-share for what this replaced.
 *
 * @param totalTeams `Team.countDocuments({ simulationId })` — the teams
 *   CONFIGURED on the simulation. It is the BASE only: when there is no score
 *   to divide by, each competitor falls back to `1 / totalTeams` rather than to
 *   an even split of the competitors. It never scales the normalised split.
 */
export function normaliseShares(
  scoreByTeam: Map<string, number>,
  totalTeams?: number,
): Map<string, number> {
  const shares = new Map<string, number>();
  const competing = scoreByTeam.size;
  if (competing === 0) return shares;

  // Falls back to the competing count so the base is never a division by zero,
  // and clamped so a roster smaller than the teams that submitted — a data
  // anomaly — cannot hand out more than one market.
  const roster = totalTeams != null && totalTeams > 0 ? totalTeams : competing;
  const base = 1 / Math.max(roster, competing);

  // Negative scores would shrink the divisor while the other teams' slices grew
  // past their true proportion, so anything below zero contributes nothing.
  const safe = new Map<string, number>();
  for (const [tid, score] of scoreByTeam) {
    safe.set(tid, Number.isFinite(score) && score > 0 ? score : 0);
  }

  const total = [...safe.values()].reduce((a, b) => a + b, 0);
  for (const [tid, score] of safe) {
    // Every score zero ⇒ nothing to normalise against, so each competitor gets
    // the configured base rather than the market being handed to nobody.
    shares.set(tid, total > 0 ? score / total : base);
  }
  return shares;
}

/**
 * Two passes of calcFinancials per product: the first reads every competing
 * team's `productScore`, those are normalised into shares, and the second runs
 * again with the real share handed in. The order is a requirement — a team's
 * slice depends on the other teams' scores, so a round can only be scored as a
 * whole, and `calcFinancials` never computes a share of its own.
 *
 * Writes Results + Decision.scored. NOT Projections.
 * See ../../README.md#calculation-order and ../../README.md#market-share
 *
 * Returns a failure object rather than throwing for the "expected" invalid
 * states, so both callers can map them to a status code consistently. Genuine
 * errors still throw, which aborts the surrounding transaction if there is one.
 */
export async function runRoundCalculation(
  round: { simulationId: mongoose.Types.ObjectId; roundNumber: number },
  session?: ClientSession
): Promise<RoundCalcOutcome> {
  const { simulationId, roundNumber } = round;
  const s = session ? { session } : {};

  const simulation = await Simulation.findById(simulationId, null, s);
  if (!simulation) {
    return { ok: false, status: 404, message: "Simulation not found." };
  }

  const { simulationTypeId } = simulation as any;

  const baseData = await BaseData.findOne({ simulationTypeId }, null, s);
  if (!baseData) {
    return { ok: false, status: 404, message: "Base data not found." };
  }

  const decisionDocs = await Decision.find({ simulationId, roundNumber }, null, s);
  if (decisionDocs.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No decisions found for this round.",
    };
  }

  // The ROSTER — every team configured on this simulation, not just the ones
  // that submitted. It is the market-share divisor: a team that skipped a
  // product does not hand its slice to whoever did make one. Read once here;
  // it does not vary by product.
  const totalTeams = await Team.countDocuments({ simulationId }, s);

  // Opening stock = last round's closing stock, from `Decision.scored` — NOT
  // Projections, which is what-if and rewritten on every player edit.
  // `roundNumber` is 0-BASED: only round 0 opens at zero.
  const priorDecisions = roundNumber > 0
    ? await Decision.find(
        { simulationId, roundNumber: roundNumber - 1 },
        { teamId: 1, scored: 1 },
        s,
      ).lean()
    : [];
  /** productKey → { teamId → closingStock } */
  const openingByProduct: Record<string, Record<string, number>> = {};
  for (const doc of priorDecisions as any[]) {
    for (const [productKey, metrics] of Object.entries(doc.scored ?? {})) {
      openingByProduct[productKey] ??= {};
      openingByProduct[productKey][String(doc.teamId)] =
        Number((metrics as any)?.closingStock ?? 0);
    }
  }

  const yearKey = String(roundNumber);

  // Pre-load every product the market model references, so the segment ×
  // product loop below doesn't issue a findById per iteration.
  const productIds = baseData.marketModel.segments.flatMap((seg: any) =>
    seg.products.map((p: any) => p.productId)
  );
  const productDocs = await Product.find({ _id: { $in: productIds } }, null, s);
  const productById = new Map<string, any>(productDocs.map((p: any) => [String(p._id), p]));

  // Every product for this simulation type — the fallback source when the
  // market model does not reference them.
  const allProducts = await Product.find({ simulationTypeId }, null, s);

  const resultsToWrite: any[] = [];
  const scoredByTeam: Record<string, any> = {};

  // What gets scored, from BOTH sources — a simulation may configure either.
  //
  // `marketModel` is authoritative where it exists. A product it does not
  // reference is still scored, from its OWN fields: `Product.fields` already
  // carries the `key`/`label`/`direction`/`tightening`/`coefficients` that
  // `MarketModelField` requires, so nothing is fabricated. Segment comes from
  // `Product.segmentId`, which is required on the model.
  //
  // Iterating `marketModel.segments` alone silently dropped EVERY calculation
  // for a simulation that sets products up directly — the run reported success
  // having scored nobody.
  //
  // `segmentFields`/`globalFields` are empty for a derived product: there is no
  // product-level equivalent to map them from. Safe, because the three totals
  // are ADDITIVE in calcMarketModel and scores are only ever compared across
  // TEAMS for one product — every team gets the same field set.
  for (const p of allProducts as any[]) {
    if (productById.has(String(p._id))) continue;
    productById.set(String(p._id), p);
  }

  const scoringPairs: Array<{
    segmentId: mongoose.Types.ObjectId;
    mmProduct: MarketModelProduct;
    product: any;
  }> = [];
  const modelled = new Set<string>();

  for (const mmSegment of (baseData.marketModel?.segments ?? []) as any[]) {
    for (const mmProduct of (mmSegment.products ?? []) as any[]) {
      const product = productById.get(String(mmProduct.productId));
      if (!product) continue;
      modelled.add(String(mmProduct.productId));
      scoringPairs.push({
        segmentId: mmSegment.segmentId,
        mmProduct: mmProduct as MarketModelProduct,
        product,
      });
    }
  }

  // EVERY product for the simulation type, not just the decided ones.
  // Filtering to decided products was wrong: the competitor report compares
  // teams per product, so a product needs its row whether or not this
  // particular team chose it. A team that skipped it scores zero there — that
  // zero IS the comparison. Drop the row and the decision has nothing to be
  // read against.
  for (const p of allProducts as any[]) {
    if (modelled.has(String(p._id))) continue;
    scoringPairs.push({
      segmentId: p.segmentId,
      mmProduct: {
        productId: p._id,
        fields: (p.fields ?? []) as unknown as MarketModelField[],
        segmentFields: [],
        globalFields: [],
      },
      product: p,
    });
  }

  if (scoringPairs.length === 0) {
    return {
      ok: false,
      status: 400,
      message:
        "Nothing to score: this simulation type has neither a market model nor any products.",
    };
  }

  for (const { segmentId, mmProduct, product } of scoringPairs) {
    const productId = mmProduct.productId;

      const productFields: ProductField[] = product.fields as unknown as ProductField[];

      const mdSegment = (baseData.marketData.segments as any[]).find((seg: any) =>
        seg.segmentId.equals(segmentId)
      );
      const mdProduct = mdSegment?.products.find((p: any) =>
        p.productId.equals(productId)
      );
      const availableMarket = mdProduct?.yearlyData?.[yearKey]?.marketSize ?? 0;

      // ── Who competes for this product ────────────────────────────────────
      // Only the teams that actually decided on it. A team that skipped it
      // takes no slice, so it must not dilute the split either.
      const competing = (decisionDocs as any[]).filter((d: any) =>
        (d.inputs ?? []).some((inp: any) =>
          String(inp.productId?.$oid ?? inp.productId) === String(productId),
        ),
      );

      /**
       * ONE calcFinancials invocation, used for both passes. Extracted rather
       * than duplicated: `productScore` needs `augmentedDynamicPrice`, which
       * needs the whole globalInput augmentation loop, so a second
       * implementation of it is exactly the divergence this codebase keeps
       * removing.
       */
      const runFinancials = (teamId: mongoose.Types.ObjectId, teamDecision: any, marketShare: number) => {
        // Normalised through the SAME reader the live-projection path uses, so
        // a stored decision cannot be interpreted one way here and another way
        // by /projections/recalc.
        const globalInputEntries: DecisionGlobalInputEntry[] =
          ((teamDecision as any).globalInputs ?? []).map((gi: any) => ({
            ...(typeof gi?.toObject === "function" ? gi.toObject() : gi),
            costTreatment: readCostTreatment(gi),
          }));

        const baseVariables: BaseVariables = {
          ...((product.baseVariables as BaseVariables) ?? {}),
          availableMarket,
        };

        const { results } = calcFinancials({
          productId: new mongoose.Types.ObjectId(productId.toString()),
          marketShares: [{ teamId, value: marketShare }],
          productFields,
          decisions: [
            {
              teamId,
              inputs: (teamDecision as any).inputs.map((inp: any) => ({
                ...inp,
                productId: new mongoose.Types.ObjectId(
                  inp.productId?.$oid ?? inp.productId
                ),
                // Explicit, not left to the spread: `produced` IS the production
                // decision, and a future refactor of this map must not be able
                // to drop it silently.
                produced: inp.produced ?? null,
                fields: (inp.fields ?? []).map((f: any) => ({
                  fieldId: new mongoose.Types.ObjectId(f.fieldId?.$oid ?? f.fieldId),
                  value: f.value,
                })),
              })),
              globalInputs: globalInputEntries,
            },
          ],
          globalInputs: globalInputEntries,
          baseVariables,
          // Must match the recalc controller's read exactly — these two call
          // sites are the pair that `readCostTreatment` / `toProjectionMetrics`
          // already exist to keep in step.
          openingStock: openingByProduct[productId.toString()] ?? {},
        });
        return results[0];
      };

      // ── PASS 1 — productScore only ───────────────────────────────────────
      // The share argument is a PLACEHOLDER: `productScore` is derived from
      // price against the augmented dynamic price and does NOT depend on the
      // share (the share is applied after it, to turn score into customers).
      // Every other figure this pass produces is discarded — do not read them.
      const scoreByTeam = new Map<string, number>();
      for (const teamDecision of competing) {
        const teamId = teamDecision.teamId as mongoose.Types.ObjectId;
        const probe = runFinancials(teamId, teamDecision, 1);
        scoreByTeam.set(String(teamId), probe?.productScore ?? 0);
      }

      // ── Market share = normalised productScore ───────────────────────────
      // Shares SUM TO 1 across the competing teams: equal scores give each
      // team 1/n, and a higher score takes a proportionally larger slice.
      // A sole competitor takes all of it.
      //
      // `productScore` IS the weighted value of a team's decisions, so this is
      // the whole model — see `normaliseShares` above.
      const shareByTeam = normaliseShares(scoreByTeam, totalTeams);

      const weightedScoresMap: Record<string, number> = {};
      const marketSharesMap: Record<string, number> = {};
      for (const [tid, score] of scoreByTeam) weightedScoresMap[tid] = score;
      for (const [tid, share] of shareByTeam) marketSharesMap[tid] = share;

      resultsToWrite.push({
        simulationId,
        roundNumber,
        productId,
        segmentId,
        weightedScores: weightedScoresMap,
        marketShares: marketSharesMap,
      });

      // ── PASS 2 — the real figures, with the competed share ───────────────
      for (const teamDecision of competing) {
        const teamId = teamDecision.teamId as mongoose.Types.ObjectId;
        const tidStr = String(teamId);
        const marketShare = shareByTeam.get(tidStr) ?? 0;

        const financials = runFinancials(teamId, teamDecision, marketShare);
        if (!financials) continue;
        const productKey = productId.toString();

        if (!scoredByTeam[tidStr]) scoredByTeam[tidStr] = {};

        // Shared shape, plus the competed share that only the round close has.
        scoredByTeam[tidStr][productKey] = {
          ...toProjectionMetrics(financials),
          marketShare,
        };
      }
  }

  await Promise.all(
    resultsToWrite.map((r) =>
      Results.findOneAndUpdate(
        {
          simulationId: r.simulationId,
          roundNumber: r.roundNumber,
          productId: r.productId,
          segmentId: r.segmentId,
        },
        r,
        { upsert: true, new: true, ...s }
      )
    )
  );

  // The official figures go onto the DECISION that produced them.
  // `updateOne`, NOT upsert — the docs were loaded above and the run aborts
  // without them. `scored` is REPLACED, not merged: a round scores as a unit.
  await Promise.all(
    Object.entries(scoredByTeam).map(([tidStr, productMap]) =>
      Decision.updateOne(
        { simulationId, teamId: tidStr, roundNumber },
        { $set: { scored: productMap } },
        s
      )
    )
  );

  return {
    ok: true,
    resultsWritten: resultsToWrite.length,
    teamsUpdated: Object.keys(scoredByTeam).length,
  };
}
