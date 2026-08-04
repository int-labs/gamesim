import { Request, Response } from "express";
import mongoose from "mongoose";
import Round      from "../models/rounds";
import Simulation from "../models/simulations";
import BaseData   from "../models/baseData";
import Decision   from "../models/decisions";
import Product    from "../models/products";
import Results    from "../models/results";
import Projections from "../models/projections";
import { calcMarketModel, DecisionDocument, MarketModelProduct } from "../sim/calcMarketModel";
import { calcFinancials, ProductField, BaseVariables, DecisionGlobalInputEntry } from "../sim/calcFinancials";

// GET /rounds?simulationId=
export const getRoundsBySimulation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;

    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const rounds = await Round.find({ simulationId }).sort({ roundNumber: 1 });
    res.status(200).json(rounds);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch rounds." });
  }
};

// GET /rounds/:id
export const getRoundById = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.findById(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }
    res.status(200).json(round);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch round." });
  }
};

// POST /rounds
export const createRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.create(req.body);
    res.status(201).json(round);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create round." });
  }
};

// PATCH /rounds/:id/status
export const updateRoundStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, timer } = req.body;

    const round = await Round.findById(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }

    // If status is being flipped to Active, compute endDate
    if (status === "Active") {
      const durationMinutes = timer?.durationMinutes ?? round.timer?.durationMinutes;

      if (!durationMinutes) {
        res.status(400).json({ message: "durationMinutes is required to activate a round." });
        return;
      }

      const startDate = new Date();
      const endDate   = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      round.timer = { startDate, durationMinutes, endDate };
    }

    if (status)        round.status = status;
    if (timer && status !== "Active") round.timer = { ...round.timer, ...timer };

    await round.save();
    res.status(200).json(round);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update round." });
  }
};

// DELETE /rounds/:id
export const deleteRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.findByIdAndDelete(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }
    res.status(200).json({ message: "Round deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete round." });
  }
};

// POST /rounds/:id/calculate
// Admin-only — fires after all teams have submitted for this round.
// Runs calcMarketModel across all teams × all products × all segments,
// then runs a final calcFinancials with real competitive market shares,
// saves Results and updates Projections.
export const calculateRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.findById(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }

    if (round.status !== "Active") {
      res.status(400).json({ message: "Round must be Active to calculate." });
      return;
    }

    const { simulationId, roundNumber } = round;

    // ── Fetch simulation to get simulationTypeId ──────────────────────────
    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      res.status(404).json({ message: "Simulation not found." });
      return;
    }

    const { simulationTypeId } = simulation as any;

    // ── Fetch baseData for this simulation type ───────────────────────────
    const baseData = await BaseData.findOne({ simulationTypeId });
    if (!baseData) {
      res.status(404).json({ message: "Base data not found." });
      return;
    }

    // ── Fetch all decisions for this round ────────────────────────────────
    const decisionDocs = await Decision.find({ simulationId, roundNumber });
    if (decisionDocs.length === 0) {
      res.status(400).json({ message: "No decisions found for this round." });
      return;
    }

    // ── Map decisions to DecisionDocument shape ───────────────────────────
    const decisions: DecisionDocument[] = decisionDocs.map((d: any) => ({
      teamId: d.teamId,
      inputs: (d.inputs ?? []).map((inp: any) => ({
        ...inp,
        productId: new mongoose.Types.ObjectId(inp.productId?.$oid ?? inp.productId),
        fields: (inp.fields ?? []).map((f: any) => ({
          fieldId: new mongoose.Types.ObjectId(f.fieldId?.$oid ?? f.fieldId),
          value:   f.value,
        })),
      })),
    }));

    const yearKey = String(roundNumber);

    // ── Iterate segments → products ───────────────────────────────────────
    const resultsToWrite: any[] = [];
    const projectionsToUpdate: Record<string, any> = {};
    // keyed by teamId string → { productKey: projectionData }

    for (const mmSegment of baseData.marketModel.segments) {
      const segmentId = mmSegment.segmentId;

      // console.log(mmSegment);

      for (const mmProduct of mmSegment.products) {
        const productId = mmProduct.productId;
        
        console.log(mmProduct);
        // fetch product config for productFields
        const product = await Product.findById(productId);
        if (!product) continue;

        const productFields: ProductField[] = product.fields as unknown as ProductField[];

        // get availableMarket from baseData.marketData for this year
        const mdSegment = baseData.marketData.segments.find((s: any) =>
          s.segmentId.equals(segmentId)
        );
        const mdProduct = mdSegment?.products.find((p: any) =>
          p.productId.equals(productId)
        );
        const availableMarket = mdProduct?.yearlyData?.[yearKey]?.marketSize ?? 0;

        // ── Run calcMarketModel for this product across all teams ─────────
        const mmOutput = calcMarketModel({
          marketModelProduct: mmProduct as MarketModelProduct,
          productFields,
          decisions,
          year: roundNumber,
        });

        // ── Save Results document ─────────────────────────────────────────
        const weightedScoresMap: Record<string, number> = {};
        const marketSharesMap:   Record<string, number> = {};

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
          marketShares:   marketSharesMap,
        });

        // ── Run final calcFinancials per team with real market shares ─────
        for (const { teamId, value: marketShare } of mmOutput.sharesNormalCDF) {
          const teamDecision = decisionDocs.find((d: any) =>
            d.teamId.equals(teamId)
          );
          if (!teamDecision) continue;

          const globalInputEntries: DecisionGlobalInputEntry[] =
            (teamDecision as any).globalInputs ?? [];

          const baseVariables: BaseVariables = {
            ...(product.baseVariables as BaseVariables ?? {}),
            availableMarket,
          };

          const { results } = calcFinancials({
            productId: new mongoose.Types.ObjectId(productId.toString()),
            marketShares:  [{ teamId, value: marketShare }],
            productFields,
            decisions: [{
              teamId,
              inputs: (teamDecision as any).inputs.map((inp: any) => ({
                ...inp,
                productId: new mongoose.Types.ObjectId(inp.productId?.$oid ?? inp.productId),
                fields: (inp.fields ?? []).map((f: any) => ({
                  fieldId: new mongoose.Types.ObjectId(f.fieldId?.$oid ?? f.fieldId),
                  value:   f.value,
                })),
              })),
              globalInputs: globalInputEntries,
            }],
            globalInputs:  globalInputEntries,
            baseVariables,
          });

          const financials    = results[0];
          const tidStr        = teamId.toString();
          const productKey    = productId.toString();

          if (!projectionsToUpdate[tidStr]) {
            projectionsToUpdate[tidStr] = {};
          }

          projectionsToUpdate[tidStr][productKey] = {
            customersObtained:    financials.customersObtained,
            sellingPrice:         financials.sellingPrice,
            dynamicPrice:         financials.dynamicPrice,
            productScore:         financials.productScore,
            dynamicCost:          financials.dynamicCost,
            revenue:              financials.revenue,
            COGS:                 financials.COGS,
            grossProfit:          financials.grossProfit,
            productCostBreakdown: financials.productCostBreakdown,
            incurredCosts:        financials.incurredCosts,
            marketShare,
          };
        }
      }
    }

    // ── Upsert Results documents ──────────────────────────────────────────
    await Promise.all(
      resultsToWrite.map((r) =>
        Results.findOneAndUpdate(
          { simulationId: r.simulationId, roundNumber: r.roundNumber, productId: r.productId, segmentId: r.segmentId },
          r,
          { upsert: true, new: true }
        )
      )
    );

    // ── Update Projections per team with final competitive calc ───────────
    await Promise.all(
      Object.entries(projectionsToUpdate).map(([tidStr, productMap]) =>
        Projections.findOneAndUpdate(
          { simulationId, teamId: tidStr, roundNumber },
          { $set: Object.fromEntries(
              Object.entries(productMap).map(([productKey, data]) => [
                `projections.${productKey}`, data
              ])
            )
          },
          { upsert: true, new: true }
        )
      )
    );

    res.status(200).json({ message: "Round calculated successfully.", roundNumber });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to calculate round." });
  }
};

// DELETE /results?simulationId=&roundNumber=
export const deleteResultsByRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.query;
    if (!simulationId || roundNumber === undefined) {
      res.status(400).json({ message: "simulationId and roundNumber are required." });
      return;
    }
    await Results.deleteMany({ simulationId, roundNumber: Number(roundNumber) });
    res.status(200).json({ message: "Results deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete results." });
  }
};
