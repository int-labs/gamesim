import { Request, Response } from "express";
import Team from "../models/teams"; // adjust import path to match your models folder

// CREATE
export const createTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamName, teamLeader, score, marketShare } = req.body;

    if (!simulationId || !teamName) {
      res.status(400).json({ message: "simulationId and teamName are required" });
      return;
    }

    const team = await Team.create({
      simulationId,
      teamName,
      teamLeader,
      score,
      marketShare,
    });

    res.status(201).json({ data: team });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Duplicate team" });
      return;
    }
    res.status(500).json({ message: err.message });
  }
};

// GET ALL — no filter, returns every team across all simulations
export const getAllTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    const teams = await Team.find();
    res.status(200).json({ data: teams });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// GET (filtered by simulationId — required, per convention: no silent empty arrays)
export const getTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;

    if (!simulationId) {
      res.status(400).json({ message: "simulationId query param is required" });
      return;
    }

    const teams = await Team.find({ simulationId });
    res.status(200).json({ data: teams });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// GET ONE
export const getTeamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const team = await Team.findById(id);

    if (!team) {
      res.status(404).json({ message: "Team not found" });
      return;
    }

    res.status(200).json({ data: team });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE (PATCH — partial updates, e.g. score/marketShare written by calc layer later)
export const updateTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const team = await Team.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!team) {
      res.status(404).json({ message: "Team not found" });
      return;
    }

    res.status(200).json({ data: team });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "Duplicate team" });
      return;
    }
    res.status(500).json({ message: err.message });
  }
};

// DELETE (hard delete — no `active` field on teams model)
export const deleteTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const team = await Team.findByIdAndDelete(id);

    if (!team) {
      res.status(404).json({ message: "Team not found" });
      return;
    }

    res.status(200).json({ message: "Team deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};