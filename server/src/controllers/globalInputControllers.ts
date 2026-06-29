import { Request, Response } from "express";
import GlobalInput from "../models/globalInputs"; // adjust import path to match your models folder

// POST /global-inputs
export const createGlobalInput = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, category, key, label, details, costConsumption, energyConsumption } = req.body;

    if (!simulationTypeId || !category || !key || !label) {
      res.status(400).json({ message: "simulationTypeId, category, key, and label are required." });
      return;
    }

    const globalInput = await GlobalInput.create({
      simulationTypeId, category, key, label, details, costConsumption, energyConsumption,
    });

    res.status(201).json(globalInput);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "A global input with this key already exists for this simulation type." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create global input." });
  }
};

// GET /global-inputs?simulationTypeId=&category=
export const getGlobalInputs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationTypeId, category } = req.query;

    if (!simulationTypeId) {
      res.status(400).json({ message: "simulationTypeId query param is required." });
      return;
    }

    const filter: Record<string, any> = { simulationTypeId };
    if (category) filter.category = category;

    const globalInputs = await GlobalInput.find(filter);
    res.status(200).json(globalInputs);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch global inputs." });
  }
};

// GET /global-inputs/:id
export const getGlobalInputById = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalInput = await GlobalInput.findById(req.params.id);
    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }
    res.status(200).json(globalInput);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch global input." });
  }
};

// PATCH /global-inputs/:id
export const updateGlobalInput = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalInput = await GlobalInput.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }
    res.status(200).json(globalInput);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "A global input with this key already exists for this simulation type." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to update global input." });
  }
};

// DELETE /global-inputs/:id
export const deleteGlobalInput = async (req: Request, res: Response): Promise<void> => {
  try {
    const globalInput = await GlobalInput.findByIdAndDelete(req.params.id);
    if (!globalInput) {
      res.status(404).json({ message: "Global input not found." });
      return;
    }
    res.status(200).json({ message: "Global input deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete global input." });
  }
};