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
import Results from "../models/Results";
import Simulation from "../models/simulations";
import {
  calcMarketModel,
  DecisionDocument,
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
 * calcMarketModel across ALL teams, THEN calcFinancials per team with the
 * resulting share handed in. That order is a requirement: the market model is
 * built from every team's VoC fit, so it cannot run inside calcFinancials.
 *
 * Writes Results + Decision.scored. NOT Projections.
 * See ../../README.md#calculation-order
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

  const decisions: DecisionDocument[] = decisionDocs.map((d: any) => ({
    teamId: d.teamId,
    inputs: d.inputs,
  }));

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

  // TEMP DIAGNOSTIC — the two silent ways this run can produce nothing:
  // an empty marketModel, or productIds the Product collection has no doc for
  // (the `continue` below skips those without a word).
  console.log('[round-calc] inputs', JSON.stringify({
    roundNumber,
    simulationTypeId: String(simulationTypeId),
    decisionDocs: decisionDocs.length,
    teamIds: decisionDocs.map((d: any) => String(d.teamId)),
    marketModelSegments: (baseData.marketModel?.segments ?? []).length,
    marketDataSegments: (baseData.marketData?.segments ?? []).length,
    productIdsReferenced: productIds.map(String),
    productsForSimType: (await Product.find({ simulationTypeId }, { _id: 1 }, s)).map((p: any) => String(p._id)),
    decidedProductIds: decisionDocs.flatMap((d: any) =>
      (d.inputs ?? []).map((inp: any) => String(inp.productId)),
    ),
    productDocsFound: productDocs.map((p: any) => String(p._id)),
    missingProducts: productIds
      .map(String)
      .filter((id: string) => !productById.has(id)),
    yearKey,
  }, null, 2));

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

      const mmOutput = calcMarketModel({
        marketModelProduct: mmProduct,
        productFields,
        decisions,
        year: roundNumber,
      });

      const weightedScoresMap: Record<string, number> = {};
      const marketSharesMap: Record<string, number> = {};

      mmOutput.sharesNormalCDF.forEach(({ teamId, value }) => {
        marketSharesMap[teamId.toString()] = value;
      });

      mmOutput.weightedScores.forEach((fc) => {
        fc.teamValues.forEach(({ teamId, score }) => {
          const tidStr = teamId.toString();
          weightedScoresMap[tidStr] = (weightedScoresMap[tidStr] ?? 0) + score;
        });
      });

      resultsToWrite.push({
        simulationId,
        roundNumber,
        productId,
        segmentId,
        weightedScores: weightedScoresMap,
        marketShares: marketSharesMap,
      });

      for (const { teamId, value: marketShare } of mmOutput.sharesNormalCDF) {
        const teamDecision = decisionDocs.find((d: any) => d.teamId.equals(teamId));
        if (!teamDecision) continue;

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

        const financials = results[0];
        const tidStr = teamId.toString();
        const productKey = productId.toString();

        if (!scoredByTeam[tidStr]) scoredByTeam[tidStr] = {};

        // Shared shape, plus the competed share that only the round close has.
        scoredByTeam[tidStr][productKey] = {
          ...toProjectionMetrics(financials),
          marketShare,
        };
      }
  }

  // TEMP DIAGNOSTIC — remove once the round-close payloads are verified.
  console.log(
    `[round-calc] round ${roundNumber} · ${resultsToWrite.length} Results doc(s) →`,
    JSON.stringify(resultsToWrite, null, 2),
  );

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

  // TEMP DIAGNOSTIC — remove once the round-close payloads are verified.
  console.log(
    `[round-calc] round ${roundNumber} · Decision.scored for ${Object.keys(scoredByTeam).length} team(s) →`,
    JSON.stringify(scoredByTeam, null, 2),
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
