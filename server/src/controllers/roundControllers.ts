// Controller Updates
import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Event from "../models/events";
import Round, { RoundInterface } from "../models/rounds";
import { getPaginationQuery } from "../utils/paginationHelper";
import { getSocket } from "../utils/socket";

// Get all rounds with pagination and filtering
export const getAllRounds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, skip, limit, filters } = getPaginationQuery(req);

    const rounds = await Round.find(filters)
      .skip(skip)
      .limit(limit)
      .populate("simulationId", "simulationName"); // Only include simulationName

    const totalCount = await Round.countDocuments(filters);

    res.status(200).json({
      rounds,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (err) {
    next(err);
  }
};

// Create a new round
export const createRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roundData = req.body;

    // Check if a round with the same simulationId and roundNumber already exists
    const existingRound = await Round.findOne({
      simulationId: roundData.simulationId,
      roundNumber: roundData.roundNumber,
    });

    if (existingRound) {
      res
        .status(400)
        .json({
          error:
            "Round with this simulation ID and round number already exists",
        });
      return;
    }

    const newRound = new Round(roundData);
    const savedRound = await newRound.save();

    res.status(201).json(savedRound);
  } catch (err) {
    console.error("Error creating round:", err);
    next(err);
  }
};

// Get a specific round by simulationId and roundNumber (roundNumber is optional)
export const getRoundBySimulationIdAndRoundNumber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.params;

    let query: any = {
      simulationId: new mongoose.Types.ObjectId(simulationId),
    };

    // Only add roundNumber to the query if it's provided
    if (roundNumber) {
      query.roundNumber = parseInt(roundNumber);
    }

    const round = await Round.findOne(query)
      .populate("simulationId")
      .populate("eventsTriggered.event")
      .lean();

    if (!round) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    res.status(200).json(round);
  } catch (err) {
    console.error("Error fetching round:", err);
    next(err);
  }
};

// Update a round by simulationName and roundNumber
export const updateRoundBySimulationIdAndRoundNumber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.params;

    const updatedRound = await Round.findOneAndUpdate(
      { simulationId, roundNumber: parseInt(roundNumber) },
      req.body,
      { new: true, runValidators: true }
    ).populate("simulationId");

    if (!updatedRound) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    res.status(200).json(updatedRound);
  } catch (err) {
    console.error("Error updating round:", err);
    next(err);
  }
};

// Delete a round by simulationId and roundNumber
export const deleteRoundBySimulationIdAndRoundNumber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.params;

    const deletedRound = await Round.findOneAndDelete({
      simulationId,
      roundNumber: parseInt(roundNumber),
    });

    if (!deletedRound) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    res.status(200).json({ message: "Round deleted successfully" });
  } catch (err) {
    console.error("Error deleting round:", err);
    next(err);
  }
};

export const updateRoundEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roundId } = req.params;
    const { eventId } = req.body;

    const round = await Round.findById(roundId);
    let event = null;

    if (eventId) {
      event = await Event.findById(eventId);
    }

    if (!round) {
      res.status(404).json({ error: "Round not found" });

      return;
    }

    if (eventId && !event) {
      res.status(404).json({ error: "Event not found" });

      return;
    }

    if (eventId) {
      if (round.eventId && round.eventId.toString() === eventId) {
        res
          .status(400)
          .json({ error: "Event is already attached to this round" });

        return;
      }

      round.eventId = eventId;
    } else {
      if (!round.eventId) {
        res.status(400).json({ error: "Event is not attached to this round" });

        return;
      }

      round.eventId = null;
    }

    await round.save();

    const io = getSocket();

    io.emit("eventActivated", { round, event });

    res.status(200).json({ message: "Round updated successfully" });
  } catch (err) {
    console.error("Error updating round event:", err);
    next(err);
  }
};


export const addEventToRound = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roundId } = req.params;
    const { eventId, delayed, delayTime, simulationId, roundNumber } = req.body;

    let round: RoundInterface | null = null;
    if (roundId === "by-number" && simulationId && roundNumber !== undefined) {
      round = await Round.findOne({
        simulationId: new mongoose.Types.ObjectId(simulationId),
        roundNumber: Number(roundNumber),
      });
    } else {
      round = await Round.findById(roundId);
    }
    if (!round) {
      res.status(404).json({ error: "Round not found" });
      return;
    }

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const now = new Date();
    const parsedDelay = Number(delayTime || 0);
    const delayStartFrom =
      round.status === "Active" ? "creation" : "roundStart";
    const scheduledAt = delayed
      ? delayStartFrom === "creation"
        ? new Date(now.getTime() + parsedDelay * 1000)
        : round.startedAt
        ? new Date(round.startedAt.getTime() + parsedDelay * 1000)
        : null
      : null;

    round.eventsTriggered.push({
      eventId: new mongoose.Types.ObjectId(eventId),
      delayed: !!delayed,
      delayTime: parsedDelay,
      delayStartFrom,
      scheduledAt,
    });

    round.markModified("eventsTriggered");
    await round.save({ validateBeforeSave: true });

    // Populate the round with events before emitting
    const populatedRound = await Round.findById(round._id)
      .populate("eventsTriggered.event")
      .lean();

    const io = getSocket();

    io.emit("eventActivated", { round: populatedRound, event });

    res.status(200).json({ message: "Event added to round successfully" });
  } catch (err) {
    console.error("❌ Error adding event to round:", err);
    next(err);
  }
};