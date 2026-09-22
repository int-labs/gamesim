import { Request, Response } from "express";
import Decision from "../models/decisions"; // adjust import path to match your models folder
import Results from "../models/results";

/**
 * Client-origin leaderboard metrics, kept RAW but not kept blindly.
 *
 * The key shape mirrors `CLIENT_SOURCE_PATTERN` in models/leaderboardConfig.ts.
 * Checked here too, because `clientMetrics` is a Mixed field and accepts
 * anything by definition.
 *
 * NOT clamped: the server has no range for an operator-declared metric and
 * inventing one would silently rewrite it. `null` when the team sent nothing,
 * which differs from an empty object — one means "did not report", the other
 * "reported no metrics".
 */
const CLIENT_METRIC_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

const sanitiseClientMetrics = (raw: unknown): Record<string, number> | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!CLIENT_METRIC_KEY.test(k)) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
};

// POST /decisions
export const createDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber, inputs, initiativeInputs, globalInputs, clientMetrics } = req.body;

    if (!simulationId || !teamId || roundNumber === undefined) {
      res.status(400).json({ message: "simulationId, teamId, and roundNumber are required." });
      return;
    }

    const decision = await Decision.create({
      simulationId,
      teamId,
      roundNumber,
      inputs,
      initiativeInputs,
      globalInputs,
      // Client-origin leaderboard figures for this round — insight answers and
      // anything else only the browser can compute. Part of the SAME insert, so
      // there is no second write and no window where a round exists without
      // them: the insight check is asked before this POST, not after.
      //
      // Sanitised rather than trusted: dropped, not coerced, so a malformed key
      // or non-finite value cannot land as a 0 that reads like a team scoring
      // nothing.
      clientMetrics: sanitiseClientMetrics(clientMetrics),
    });

    res.status(201).json(decision);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ message: "A decision has already been submitted for this team, round, and simulation." });
      return;
    }
    res.status(500).json({ message: err?.message ?? "Failed to create decision." });
  }
};

// DELETE /decisions?simulationId=&roundNumber=
export const deleteDecisionsByRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, roundNumber, force } = req.query;
    if (!simulationId || roundNumber === undefined) {
      res.status(400).json({ message: "simulationId and roundNumber are required." });
      return;
    }

    const round = Number(roundNumber);

    // Deleting the decisions behind an already-calculated round leaves Results
    // and Projections that nothing can reproduce. Refuse unless the caller says
    // so explicitly.
    if (force !== "true") {
      const existingResults = await Results.countDocuments({
        simulationId,
        roundNumber: round,
      });
      if (existingResults > 0) {
        res.status(409).json({
          message:
            `Round ${round} has already been calculated (${existingResults} result ` +
            `documents). Deleting its decisions would orphan those results. ` +
            `Delete the results first, or retry with ?force=true.`,
        });
        return;
      }
    }

    const { deletedCount } = await Decision.deleteMany({
      simulationId,
      roundNumber: round,
    });
    res.status(200).json({ message: "Decisions deleted.", deletedCount });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete decisions." });
  }
};

// GET /decisions?simulationId=&teamId=&roundNumber=
export const getDecisions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { simulationId, teamId, roundNumber } = req.query;

    if (!simulationId) {
      res.status(400).json({ message: "simulationId query param is required." });
      return;
    }

    const filter: Record<string, any> = { simulationId };
    if (teamId) filter.teamId = teamId;
    if (roundNumber !== undefined) filter.roundNumber = roundNumber;

    const decisions = await Decision.find(filter).populate({ path: "inputs.fields.imageAssets" });
    res.status(200).json(decisions);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch decisions." });
  }
};

// GET /decisions/:id
export const getDecisionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const decision = await Decision.findById(req.params.id).populate({ path: "inputs.fields.imageAssets" });

    if (!decision) {
      res.status(404).json({ message: "Decision not found." });
      return;
    }

    res.status(200).json(decision);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch decision." });
  }
};

// DELETE /decisions/:id (admin only — enforced at the router level)
export const deleteDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const decision = await Decision.findByIdAndDelete(req.params.id);

    if (!decision) {
      res.status(404).json({ message: "Decision not found." });
      return;
    }

    res.status(200).json({ message: "Decision deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete decision." });
  }
};