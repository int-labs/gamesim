import { Request, Response } from "express";
import Simulation from "../models/simulations";

// GET /simulations
export const getAllSimulations = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulations = await Simulation.find().sort({ createdAt: -1 });
    res.status(200).json(simulations);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch simulations." });
  }
};

// GET /simulations/:id
export const getSimulationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulation = await Simulation.findById(req.params.id);
    if (!simulation) {
      res.status(404).json({ message: "Simulation not found." });
      return;
    }
    res.status(200).json(simulation);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch simulation." });
  }
};

// POST /simulations
export const createSimulation = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulation = await Simulation.create(req.body);
    res.status(201).json(simulation);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create simulation." });
  }
};

// PATCH /simulations/:id
export const updateSimulation = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulation = await Simulation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!simulation) {
      res.status(404).json({ message: "Simulation not found." });
      return;
    }
    res.status(200).json(simulation);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update simulation." });
  }
};

// DELETE /simulations/:id
export const deleteSimulation = async (req: Request, res: Response): Promise<void> => {
  try {
    const simulation = await Simulation.findByIdAndDelete(req.params.id);
    if (!simulation) {
      res.status(404).json({ message: "Simulation not found." });
      return;
    }
    res.status(200).json({ message: "Simulation deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete simulation." });
  }
};
