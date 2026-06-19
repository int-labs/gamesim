import { Request, Response } from "express";
import Initiative from "../models/initiatives";

// POST /initiatives
export const createInitiative = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, details, costConsumption, energyConsumption } = req.body;

    if (!name || costConsumption === undefined || energyConsumption === undefined) {
      res.status(400).json({ message: "name, costConsumption and energyConsumption are required." });
      return;
    }

    const initiative = await Initiative.create({ name, details, costConsumption, energyConsumption });
    res.status(201).json(initiative);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Initiative with this name already exists." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create initiative." });
  }
};

// GET /initiatives
export const getInitiatives = async (_req: Request, res: Response): Promise<void> => {
  try {
    const initiatives = await Initiative.find().sort({ name: 1 });
    res.status(200).json(initiatives);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch initiatives." });
  }
};

// GET /initiatives/:id
export const getInitiativeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const initiative = await Initiative.findById(req.params.id);
    if (!initiative) {
      res.status(404).json({ message: "Initiative not found." });
      return;
    }
    res.status(200).json(initiative);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch initiative." });
  }
};

// PATCH /initiatives/:id
export const updateInitiative = async (req: Request, res: Response): Promise<void> => {
  try {
    const initiative = await Initiative.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!initiative) {
      res.status(404).json({ message: "Initiative not found." });
      return;
    }
    res.status(200).json(initiative);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update initiative." });
  }
};

// DELETE /initiatives/:id
export const deleteInitiative = async (req: Request, res: Response): Promise<void> => {
  try {
    const initiative = await Initiative.findByIdAndDelete(req.params.id);
    if (!initiative) {
      res.status(404).json({ message: "Initiative not found." });
      return;
    }
    res.status(200).json({ message: "Initiative deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete initiative." });
  }
};