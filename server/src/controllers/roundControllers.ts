import { Request, Response } from "express";
import mongoose from "mongoose";
import Round from "../models/rounds";
import Simulation from "../models/simulations";
import Results from "../models/results";
import { runRoundCalculation } from "../services/roundCalculation";

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
    const { status, timer } = req.body;

    const round = await Round.findById(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }

    // If status is being flipped to Active, compute endDate
    if (status === "Active") {
      const durationMinutes = timer?.durationMinutes ?? round.timer?.durationMinutes;

      if (!durationMinutes) {
        res.status(400).json({ message: "durationMinutes is required to activate a round." });
        return;
      }

      const startDate = new Date();
      const endDate   = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      round.timer = { startDate, durationMinutes, endDate };
    }

    if (status)        round.status = status;
    if (timer && status !== "Active") round.timer = { ...round.timer, ...timer };

    await round.save();
    res.status(200).json(round);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to update round." });
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

// POST /rounds/:id/calculate
// Admin-only — fires after all teams have submitted for this round.
// Runs calcMarketModel across all teams × all products × all segments,
// then runs a final calcFinancials with real competitive market shares,
// saving Results and updating Projections.
//
// Leaves the round Active so it can be recalculated. To close the round in the
// same breath (the normal operator flow) use POST /rounds/:id/end instead.
export const calculateRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const round = await Round.findById(req.params.id);
    if (!round) {
      res.status(404).json({ message: "Round not found." });
      return;
    }

    if (round.status !== "Active") {
      res.status(400).json({ message: "Round must be Active to calculate." });
      return;
    }

    const outcome = await runRoundCalculation(round as any);
    if (!outcome.ok) {
      res.status(outcome.status).json({ message: outcome.message });
      return;
    }

    res.status(200).json({
      message: "Round calculated successfully.",
      roundNumber: round.roundNumber,
      resultsWritten: outcome.resultsWritten,
      teamsUpdated: outcome.teamsUpdated,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to calculate round." });
  }
};

// POST /rounds/:id/end
// The normal operator flow: close the round, calculate it, and advance the
// simulation — atomically.
//
// Splitting these was a trap: `calculateRound` refuses to run unless the round
// is Active, so an operator who closed a round first could never calculate it
// and its results were stranded with no way back. Doing all three in one
// transaction means either the round is closed AND scored AND the simulation
// advanced, or nothing changed at all.
//
// Body: { skipCalculation?: boolean } — closes a round nobody submitted to.
export const endRound = async (req: Request, res: Response): Promise<void> => {
  const skipCalculation = req.body?.skipCalculation === true;
  const session = await mongoose.startSession();

  // Guard failures abort the transaction by throwing ABORT; the details travel
  // out in `failure` rather than in the error, so the rollback and the HTTP
  // response can't disagree about what happened.
  const ABORT = "__end_round_abort__";
  const state: {
    failure: { status: number; message: string } | null;
    payload: Record<string, unknown> | null;
  } = { failure: null, payload: null };

  try {
    await session.withTransaction(async () => {
      const round = await Round.findById(req.params.id, null, { session });
      if (!round) {
        state.failure = { status: 404, message: "Round not found." };
        throw new Error(ABORT);
      }

      if (round.status !== "Active") {
        state.failure = {
          status: 400,
          message: `Round ${round.roundNumber} is ${round.status}. Only an Active round can be ended.`,
        };
        throw new Error(ABORT);
      }

      const simulation = await Simulation.findById(round.simulationId, null, { session });
      if (!simulation) {
        state.failure = { status: 404, message: "Simulation not found." };
        throw new Error(ABORT);
      }

      let calc: { resultsWritten: number; teamsUpdated: number } | null = null;

      if (!skipCalculation) {
        const outcome = await runRoundCalculation(round as any, session);
        if (!outcome.ok) {
          state.failure = { status: outcome.status, message: outcome.message };
          throw new Error(ABORT);
        }
        calc = {
          resultsWritten: outcome.resultsWritten,
          teamsUpdated: outcome.teamsUpdated,
        };
      }

      round.status = "Completed";
      await round.save({ session });

      // Advance the simulation, or complete it when this was the last round.
      const config = (simulation.config ?? {}) as {
        totalRounds?: number;
        currRounds?: number;
      };
      const totalRounds = config.totalRounds ?? 0;
      // `roundNumber` is 0-BASED and `totalRounds` is a COUNT, so the last round
      // is `totalRounds - 1`. This was `roundNumber >= totalRounds`, which is
      // never true for a 0-based sequence: a 3-round simulation ran rounds 0-2,
      // `2 >= 3` was false, the simulation was never marked "Completed", and
      // `currRounds` climbed to a round that does not exist.
      const isLastRound = totalRounds > 0 && round.roundNumber >= totalRounds - 1;

      if (isLastRound) {
        simulation.status = "Completed";
      } else {
        simulation.config = {
          ...config,
          currRounds: Math.max(config.currRounds ?? 0, round.roundNumber + 1),
        };
      }
      await simulation.save({ session });

      state.payload = {
        message: `Round ${round.roundNumber} ended.`,
        roundNumber: round.roundNumber,
        calculated: !skipCalculation,
        isLastRound,
        simulationStatus: simulation.status,
        ...(calc ?? {}),
      };
    });
  } catch (err: any) {
    if (err?.message !== ABORT) {
      await session.endSession();
      res.status(500).json({ message: err?.message ?? "Failed to end the round." });
      return;
    }
  }

  await session.endSession();

  if (state.failure) {
    res.status(state.failure.status).json({ message: state.failure.message });
    return;
  }
  res.status(200).json(state.payload ?? { message: "Round ended." });
};

// DELETE /results?simulationId=&roundNumber=
export const deleteResultsByRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber } = req.query;
    if (!simulationId || roundNumber === undefined) {
      res.status(400).json({ message: "simulationId and roundNumber are required." });
      return;
    }
    await Results.deleteMany({ simulationId, roundNumber: Number(roundNumber) });
    res.status(200).json({ message: "Results deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete results." });
  }
};
