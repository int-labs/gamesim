import { Request, Response } from "express";
import Team from "../models/teams"; // adjust import path to match your models folder
import { DEFAULT_TEAM_AVATAR_STYLE, generateAndStoreAvatar } from "../services/avatars";

// CREATE
export const createTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamName, teamLeader, score, marketShare } = req.body;

    if (!simulationId || !teamName) {
      res.status(400).json({ message: "simulationId and teamName are required" });
      return;
    }

    // Give every team a face at creation.
    //
    // Avatars used to appear only once someone opened the roster and saved a
    // member (PUT /:id/members) or picked a style (PUT /:id/avatar), so a team
    // created and left alone had `avatar: null` forever and the console fell
    // back to initials. A team is identified by its name in every list in the
    // product; the picture is part of that, not an optional extra.
    const avatar = await generateAndStoreAvatar(DEFAULT_TEAM_AVATAR_STYLE, teamName).catch(
      // Never fail team creation over avatar rendering — a faceless team is
      // recoverable, a team that could not be created mid-class is not.
      () => null
    );

    const team = await Team.create({
      simulationId,
      teamName,
      teamLeader,
      score,
      marketShare,
      avatar,
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
// GET /teams  ·  GET /teams?simulationId=
// The simulationId filter is OPTIONAL here — callers that need every team
// (the admin console's user↔team join) omit it, callers scoped to one
// simulation pass it. `getTeams` below requires it; this one doesn't, which is
// why this is the handler the router mounts.
export const getAllTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId } = req.query;
    const filter = simulationId ? { simulationId } : {};

    const teams = await Team.find(filter);
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