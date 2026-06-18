import { Request, Response } from "express";
import Decision from "../models/decisions";

// POST /decisions
export const createDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber, productId, segmentId, inputs, subProductKey } = req.body;

    if (!simulationId || !teamId || !roundNumber || !productId || !segmentId || !inputs || !subProductKey ) {
      res.status(400).json({ message: "simulationId, teamId, roundNumber, productId, segmentId, subProductKey and inputs are required." });
      return;
    }

    const decision = await Decision.create({
      simulationId,
      teamId,
      roundNumber,
      productId,
      segmentId,
      inputs,
      subProductKey,
    });

    res.status(201).json(decision);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Decision already exists for this team, product, segment and round." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create decision." });
  }
};

// GET /decisions
export const getDecisions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.query;

    if (!simulationId || !teamId || !roundNumber) {
      res.status(400).json({ message: "simulationId, teamId and roundNumber are required." });
      return;
    }

    const decisions = await Decision.find({
      simulationId,
      teamId,
      roundNumber: Number(roundNumber),
    }).sort({ createdAt: 1 });

    res.status(200).json(decisions);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch decisions." });
  }
};

// GET /decisions/:id
export const getDecisionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const decision = await Decision.findById(req.params.id);
    if (!decision) {
      res.status(404).json({ message: "Decision not found." });
      return;
    }
    res.status(200).json(decision);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch decision." });
  }
};

// DELETE /decisions/:id — admin only
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