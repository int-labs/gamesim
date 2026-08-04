import { Request, Response } from "express";
import BaseData from "../models/baseData";

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
