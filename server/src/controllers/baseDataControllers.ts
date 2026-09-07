import { Request, Response } from "express";
import BaseData from "../models/baseData";
import Results from "../models/results";
import {
  BASE_DATA_SECTIONS,
  changedRounds,
  formatIssues,
} from "../validators/baseData";

// GET /base-data?simulationTypeId=
export const getBaseDataBySimulationType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId } = req.query;

    if (!simulationTypeId) {
      res.status(400).json({ message: "simulationTypeId is required." });
      return;
    }

    const baseData = await BaseData.findOne({ simulationTypeId });
    if (!baseData) {
      res.status(404).json({ message: "Base data not found." });
      return;
    }

    res.status(200).json(baseData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch base data." });
  }
};

// GET /base-data/:id
export const getBaseDataById = async (req: Request, res: Response): Promise<void> => {
  try {
    const baseData = await BaseData.findById(req.params.id);
    if (!baseData) {
      res.status(404).json({ message: "Base data not found." });
      return;
    }
    res.status(200).json(baseData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch base data." });
  }
};

// POST /base-data
export const createBaseData = async (req: Request, res: Response): Promise<void> => {
  try {
    const baseData = await BaseData.create(req.body);
    res.status(201).json(baseData);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Base data for this simulation type already exists." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create base data." });
  }
};

// PATCH /base-data/:id
export const updateBaseData = async (req: Request, res: Response): Promise<void> => {
  try {
    const baseData = await BaseData.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!baseData) {
      res.status(404).json({ message: "Base data not found." });
      return;
    }
    res.status(200).json(baseData);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update base data." });
  }
};

// DELETE /base-data/:id
export const deleteBaseData = async (req: Request, res: Response): Promise<void> => {
  try {
    const baseData = await BaseData.findByIdAndDelete(req.params.id);
    if (!baseData) {
      res.status(404).json({ message: "Base data not found." });
      return;
    }
    res.status(200).json({ message: "Base data deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete base data." });
  }
};

// PATCH /base-data/:id/section/:section
//
// Section-scoped, validated editing — the console's write path. The existing
// PATCH /base-data/:id stays as it was (an unvalidated passthrough) so nothing
// that relies on it changes.
//
// THE GUARD: market sizes are an input to calcMarketModel. Editing a round that
// has already been calculated leaves Results and Projections that nothing can
// reproduce, so we detect exactly which rounds moved and refuse those unless
// the caller passes ?force=true.
export const patchBaseDataSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, section } = req.params;

    const schema = (BASE_DATA_SECTIONS as Record<string, any>)[section];
    if (!schema) {
      res.status(400).json({
        message: `Unknown section "${section}".`,
        allowed: Object.keys(BASE_DATA_SECTIONS),
      });
      return;
    }

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: `Section "${section}" is invalid.`,
        issues: formatIssues(parsed.error),
      });
      return;
    }

    const baseData = await BaseData.findById(id);
    if (!baseData) {
      res.status(404).json({ message: "Base data not found." });
      return;
    }

    if (section === "marketData" && req.query.force !== "true") {
      const moved = changedRounds(baseData.marketData, parsed.data);
      if (moved.length) {
        const calculated = await Results.find({ roundNumber: { $in: moved } })
          .distinct("roundNumber");
        if (calculated.length) {
          res.status(409).json({
            message:
              `Round${calculated.length > 1 ? "s" : ""} ${calculated.join(", ")} ` +
              `${calculated.length > 1 ? "have" : "has"} already been calculated. Changing ` +
              `${calculated.length > 1 ? "their" : "its"} market size would leave results that ` +
              `can't be reproduced. Delete those results first, or retry with ?force=true.`,
            calculatedRounds: calculated,
            changedRounds: moved,
          });
          return;
        }
      }
    }

    (baseData as any)[section] = parsed.data;
    baseData.markModified(section);
    await baseData.save();

    res.status(200).json({ message: `Saved ${section}.`, baseData });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save base data." });
  }
};
