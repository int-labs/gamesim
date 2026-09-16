import { Request, Response } from "express";
import Result from "../models/results";

// GET /results?simulationId=&roundNumber=&productId=&segmentId=
export const getResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber, productId, segmentId } = req.query;

    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const filter: Record<string, any> = { simulationId };
    if (roundNumber !== undefined) filter.roundNumber = Number(roundNumber);
    if (productId)  filter.productId  = productId;
    if (segmentId)  filter.segmentId  = segmentId;

    const results = await Result.find(filter).sort({ roundNumber: 1 });
    res.status(200).json(results);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch results." });
  }
};

// GET /results/:id
export const getResultById = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Result.findById(req.params.id);
    if (!result) {
      res.status(404).json({ message: "Result not found." });
      return;
    }
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch result." });
  }
};

// POST /results
export const createResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Result.create(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Result for this simulation, round, product, and segment already exists." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create result." });
  }
};

// PATCH /results/:id
export const updateResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Result.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!result) {
      res.status(404).json({ message: "Result not found." });
      return;
    }
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update result." });
  }
};

// DELETE /results?simulationId=&roundNumber=
//
// The first step of a round RESET. It MUST run before the decisions delete:
// `deleteDecisionsByRound` refuses with 409 while results for the round still
// exist, so clearing results first satisfies that guard instead of bypassing it
// with ?force=true.
//
// Lived in roundControllers and was mounted on `/rounds`, so the console's
// `DELETE /results?...` matched no route and 404'd — results were never deleted
// and the decisions guard could never be satisfied.
export const deleteResultsByRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.query;
    if (!simulationId || roundNumber === undefined) {
      res.status(400).json({ message: "simulationId and roundNumber are required." });
      return;
    }
    const { deletedCount } = await Result.deleteMany({
      simulationId,
      roundNumber: Number(roundNumber),
    });
    res.status(200).json({ message: "Results deleted.", deletedCount });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete results." });
  }
};

// DELETE /results/:id
export const deleteResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Result.findByIdAndDelete(req.params.id);
    if (!result) {
      res.status(404).json({ message: "Result not found." });
      return;
    }
    res.status(200).json({ message: "Result deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete result." });
  }
};
