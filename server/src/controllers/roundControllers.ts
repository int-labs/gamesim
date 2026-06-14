import { Request, Response } from "express";
import Round from "../models/rounds";

// GET /rounds?simulationId=
export const getRoundsBySimulation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;

    if (!simulationId) {
      res.status(400).json({ message: "simulationId is required." });
      return;
    }

    const rounds = await Round.find({ simulationId }).sort({ roundNumber: 1 });
    res.status(200).json(rounds);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch rounds." });
  }
};

// GET /rounds/:id
export const getRoundById = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.findById(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }
    res.status(200).json(round);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch round." });
  }
};

// POST /rounds
export const createRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.create(req.body);
    res.status(201).json(round);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to create round." });
  }
};

// PATCH /rounds/:id/status
export const updateRoundStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ message: "status is required." });
      return;
    }

    const round = await Round.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }
    res.status(200).json(round);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update round status." });
  }
};

// DELETE /rounds/:id
export const deleteRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.findByIdAndDelete(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }
    res.status(200).json({ message: "Round deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete round." });
  }
};
