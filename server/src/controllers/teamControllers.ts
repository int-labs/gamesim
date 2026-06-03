import { NextFunction, Request, Response } from "express";
import Projection from "../models/projections";
import Simulation from "../models/simulations";
import Team from "../models/teams";
import User from "../models/users";
import { getPaginationQuery } from "../utils/paginationHelper";
import { issueTokens } from "./authControllers";

// Get all teams with simulationName populated
export const getAllTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, skip, limit, filters } = getPaginationQuery(req);

    // Fetch teams and populate simulationName
    const teams = await Team.find(filters)
      .skip(skip)
      .limit(limit)
      .populate("simulationId", "simulationName"); // Populate simulationName from Simulation

    const totalCount = await Team.countDocuments(filters);

    res.status(200).json({
      teams,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    next(err);
  }
};

// Get teams by either simulationId or simulationName, populate simulationId with simulationName
export const getTeamsBySimulationIdAndName = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, simulationName } = req.params;

    let filter = {};

    // If simulationId is provided, filter by simulationId
    if (simulationId) {
      filter = { simulationId };
    }
    // If simulationName is provided, find simulationId by simulationName and filter by it
    else if (simulationName) {
      const simulation = await Simulation.findOne({ simulationName });
      if (!simulation) {
        res.status(404).json({
          error: `Simulation with name "${simulationName}" not found.`,
        });
        return;
      }
      filter = { simulationId: simulation._id };
    }

    // Fetch teams with the filter applied and populate simulationId with simulationName
    const teams = await Team.find(filter).populate(
      "simulationId",
      "simulationName"
    );

    if (teams.length === 0) {
      res.status(404).json({ error: "No teams found for this simulation." });
      return;
    }

    res.status(200).json(teams);
  } catch (err) {
    next(err);
  }
};

// Create a new team
export const createTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const teamData = req.body;

    // Prevent duplicate team names
    const existingTeam = await Team.findOne({ teamName: teamData.teamName });
    if (existingTeam) {
      res.status(400).json({ error: "A team with this name already exists." });
      return;
    }

    // Create and save the new team
    const newTeam = new Team(teamData);
    const savedTeam = await newTeam.save();

    res.status(201).json(savedTeam);
  } catch (err) {
    next(err);
  }
};

// Update a team by simulationId and teamName
export const updateTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, teamName } = req.params;

    const updatedTeam = await Team.findOneAndUpdate(
      { simulationId, teamName },
      req.body,
      { new: true }
    );

    if (!updatedTeam) {
      res.status(404).json({ error: "Team not found." });
      return;
    }

    res.status(200).json(updatedTeam);
  } catch (err) {
    next(err);
  }
};

export const updateOwnTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { teamLeader, teamName: newTeamName, avatarUrl } = req.body;

    const user = (req as any).user;

    const queriedUser = await User.findById(user.userId);

    const updatedTeam = await Team.findOneAndUpdate(
      { _id: user.teamId },
      { teamLeader, teamName: newTeamName, avatarUrl },
      { new: true }
    );

    if (!queriedUser || !updatedTeam) {
      res.status(404).json({ error: "Team not found." });
      return;
    }

    const { accessToken: jwtToken, refreshToken } = await issueTokens(
      queriedUser,
      updatedTeam
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
    });

    res.status(200).json({ updatedToken: jwtToken });
  } catch (err) {
    next(err);
  }
};

// Delete a team by simulationId and teamName
export const deleteTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, teamName } = req.params;

    const deletedTeam = await Team.findOneAndDelete({ simulationId, teamName });

    if (!deletedTeam) {
      res.status(404).json({ error: "Team not found." });
      return;
    }

    res.status(200).json({ message: "Team deleted." });
  } catch (err) {
    next(err);
  }
};

export const getTeamProjections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { teamId } = req.params;
    const { roundNumber } = req.query;

    const query: any = { teamId };

    if (roundNumber) {
      query.roundNumber = roundNumber;
    }

    const projections = await Projection.find(query).sort({ createdAt: -1 });

    if (!projections || projections.length === 0) {
      res.status(404).json({
        error: "No projections found for the specified team.",
        name: "NotFoundError",
      });
      return;
    }

    res.status(200).json({ projections: projections });
  } catch (err) {
    next(err);
  }
};
