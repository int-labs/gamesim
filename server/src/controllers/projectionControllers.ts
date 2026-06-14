import { Request, Response } from "express";
import Projection from "../models/projections";

// GET /projections?simulationId=&teamId=&roundNumber=
export const getProjectionsByTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.query;

    if (!simulationId || !teamId) {
      res.status(400).json({ message: "simulationId and teamId are required." });
      return;
    }

    const filter: Record<string, any> = { simulationId, teamId };
    if (roundNumber !== undefined) filter.roundNumber = Number(roundNumber);

    const projections = await Projection.find(filter).sort({ roundNumber: 1 });
    res.status(200).json(projections);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch projections." });
  }
};

// GET /projections/:id
export const getProjectionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const projection = await Projection.findById(req.params.id);
    if (!projection) {
      res.status(404).json({ message: "Projection not found." });
      return;
    }
    res.status(200).json(projection);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch projection." });
  }
};

// DELETE /projections/:id
export const deleteProjection = async (req: Request, res: Response): Promise<void> => {
  try {
    const projection = await Projection.findByIdAndDelete(req.params.id);
    if (!projection) {
      res.status(404).json({ message: "Projection not found." });
      return;
    }
    res.status(200).json({ message: "Projection deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete projection." });
  }
};

// -----------------------------------------------------------------------
// recalcProjections — DEFERRED TO CALCULATION CONVERSATION
// -----------------------------------------------------------------------
// This method will be implemented alongside the full calculation layer:
//   - calcCSAT.ts
//   - calcMarketModel.ts
//   - calcProjections.ts
//   - calcPnL.ts
//   - calcCashflow.ts
//
// It will:
//   1. Read the team's submitted decisions from the decisions collection
//   2. Read globalInputs for the simulation type
//   3. Read baseData coefficients for each product/segment
//   4. Run each calculation in sequence (CSAT → MM → Projections → PnL → Cashflow)
//   5. Write all results back into this projection document
// -----------------------------------------------------------------------
