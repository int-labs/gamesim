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
import Projections from "../models/projections";
import Results from "../models/results";
import Simulation from "../models/simulations";
import {
  calcMarketModel,
  DecisionDocument,
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
 * Runs calcMarketModel across every team for each product in the simulation
 * type's market model, then calcFinancials per team with the resulting
 * competitive shares. Upserts Results (per product × segment) and Projections
 * (per team).
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

  const yearKey = String(roundNumber);

  // Pre-load every product the market model references, so the segment ×
  // product loop below doesn't issue a findById per iteration.
  const productIds = baseData.marketModel.segments.flatMap((seg: any) =>
    seg.products.map((p: any) => p.productId)
  );
  const productDocs = await Product.find({ _id: { $in: productIds } }, null, s);
  const productById = new Map(productDocs.map((p: any) => [String(p._id), p]));

  const resultsToWrite: any[] = [];
  const projectionsToUpdate: Record<string, any> = {};

  for (const mmSegment of baseData.marketModel.segments as any[]) {
    const segmentId = mmSegment.segmentId;

    for (const mmProduct of mmSegment.products as any[]) {
      const productId = mmProduct.productId;
      const product = productById.get(String(productId));
      if (!product) continue;

      const productFields: ProductField[] = product.fields as unknown as ProductField[];

      const mdSegment = (baseData.marketData.segments as any[]).find((seg: any) =>
        seg.segmentId.equals(segmentId)
      );
      const mdProduct = mdSegment?.products.find((p: any) =>
        p.productId.equals(productId)
      );
      const availableMarket = mdProduct?.yearlyData?.[yearKey]?.marketSize ?? 0;

      const mmOutput = calcMarketModel({
        marketModelProduct: mmProduct as MarketModelProduct,
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
        });

        const financials = results[0];
        const tidStr = teamId.toString();
        const productKey = productId.toString();

        if (!projectionsToUpdate[tidStr]) projectionsToUpdate[tidStr] = {};

        // Shared shape, plus the competed share that only the round close has.
        projectionsToUpdate[tidStr][productKey] = {
          ...toProjectionMetrics(financials),
          marketShare,
        };
      }
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

  await Promise.all(
    Object.entries(projectionsToUpdate).map(([tidStr, productMap]) =>
      Projections.findOneAndUpdate(
        { simulationId, teamId: tidStr, roundNumber },
        {
          $set: Object.fromEntries(
            Object.entries(productMap as Record<string, any>).map(
              ([productKey, data]) => [`projections.${productKey}`, data]
            )
          ),
        },
        { upsert: true, new: true, ...s }
      )
    )
  );

  return {
    ok: true,
    resultsWritten: resultsToWrite.length,
    teamsUpdated: Object.keys(projectionsToUpdate).length,
  };
}
