import { Request, Response } from "express";
import mongoose from "mongoose";
import { buildDebriefDimensions } from "../services/debriefDimensions";

// GET /debrief-dimensions?simulationTypeId=
export const getDebriefDimensions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.query;
    if (!simulationTypeId || !mongoose.isValidObjectId(String(simulationTypeId))) {
      res.status(400).json({ message: "A valid simulationTypeId is required." });
      return;
    }

    // A type with no products and no global inputs still returns the fixed
    // dimensions. That is honest: those figures exist on any debrief, and an
    // empty response would read as "this type can plot nothing".
    const dimensions = await buildDebriefDimensions(String(simulationTypeId));
    res.status(200).json(dimensions);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to build dimensions." });
  }
};
