import { Request, Response } from "express";
import Decision from "../models/decisions"; // adjust import path to match your models folder

// POST /decisions
export const createDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber, inputs, initiativeInputs, globalInputs } = req.body;

    if (!simulationId || !teamId || roundNumber === undefined) {
      res.status(400).json({ message: "simulationId, teamId, and roundNumber are required." });
      return;
    }

    const decision = await Decision.create({
      simulationId,
      teamId,
      roundNumber,
      inputs,
      initiativeInputs,
      globalInputs,
    });

    res.status(201).json(decision);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "A decision has already been submitted for this team, round, and simulation." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create decision." });
  }
};

// GET /decisions?simulationId=&teamId=&roundNumber=
export const getDecisions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.query;

    if (!simulationId) {
      res.status(400).json({ message: "simulationId query param is required." });
      return;
    }

    const filter: Record<string, any> = { simulationId };
    if (teamId) filter.teamId = teamId;
    if (roundNumber !== undefined) filter.roundNumber = roundNumber;

    const decisions = await Decision.find(filter).populate({ path: "inputs.fields.imageAssets" });
    res.status(200).json(decisions);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch decisions." });
  }
};

// GET /decisions/:id
export const getDecisionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const decision = await Decision.findById(req.params.id).populate({ path: "inputs.fields.imageAssets" });

    if (!decision) {
      res.status(404).json({ message: "Decision not found." });
      return;
    }

    res.status(200).json(decision);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch decision." });
  }
};

// DELETE /decisions/:id (admin only — enforced at the router level)
export const deleteDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const decision = await Decision.findByIdAndDelete(req.params.id);

    if (!decision) {
      res.status(404).json({ message: "Decision not found." });
      return;
    }

    res.status(200).json({ message: "Decision deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete decision." });
  }
};