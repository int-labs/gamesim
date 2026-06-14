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
