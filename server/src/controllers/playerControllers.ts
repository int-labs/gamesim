import { Request, Response } from "express";
import { Types } from "mongoose";

import User from "../models/users";
import Team, { TeamInterface } from "../models/teams";
import Simulation, { SimulationInterface } from "../models/simulations";
import Round, { RoundInterface } from "../models/rounds";
import TeamRoundDecision, { TeamRoundDecisionInterface } from "../models/teamRoundDecisions";
import TeamRoundResult, { TeamRoundResultInterface } from "../models/teamRoundResults";
import { ROLES } from "../constants/roles";
import { simulatePhase } from "../simulation-engines/finlit/simulate";
import type { FinlitDecisions, FinlitLine, FinlitPhaseResult } from "../simulation-engines/finlit/types";
import { FINLIT_CONFIG_VERSION, FINLIT_ENGINE_KEY, FINLIT_ENGINE_VERSION } from "../simulation-engines/finlit/engineMeta";

// ---------- shared helpers ----------

interface PlayerContext {
  team: TeamInterface;
  simulation: SimulationInterface;
}

// Resolves team + simulation from the authenticated session only — never from
// anything the client sends in the request body/query/params.
async function resolvePlayerContext(req: Request): Promise<PlayerContext | { error: string; status: number }> {
  const authUser = (req as any).user as { id: string; role: string; teamId?: string } | undefined;
  if (!authUser || authUser.role !== ROLES.TEAM) {
    return { error: "Only team players have a player context.", status: 403 };
  }

  const user = await User.findById(authUser.id);
  if (!user || !user.teamId) {
    return { error: "No team assigned to this user.", status: 404 };
  }

  const team = await Team.findById(user.teamId);
  if (!team) {
    return { error: "Team not found.", status: 404 };
  }

  const simulation = await Simulation.findById(team.simulationId);
  if (!simulation) {
    return { error: "Simulation not found.", status: 404 };
  }

  return { team, simulation };
}

function isContextError(ctx: PlayerContext | { error: string; status: number }): ctx is { error: string; status: number } {
  return (ctx as { error: string }).error !== undefined;
}

// Current round = latest Active round; falls back to the highest-numbered
// round if none is Active yet (e.g. simulation not started / already ended).
export async function resolveCurrentRound(simulationId: Types.ObjectId): Promise<RoundInterface | null> {
  const active = await Round.findOne({ simulationId, status: "Active" }).sort({ roundNumber: -1 });
  if (active) return active;
  return Round.findOne({ simulationId }).sort({ roundNumber: -1 });
}

function clampPhase(roundNumber: number): 1 | 2 | 3 {
  if (roundNumber <= 1) return 1;
  if (roundNumber >= 3) return 3;
  return 2;
}

// Ending inventory for each line carries forward from the prior round's
// persisted result — never from whatever the client happens to send.
export function applyCarryOver(lines: FinlitLine[], priorResult: TeamRoundResultInterface | null): FinlitLine[] {
  if (!priorResult) return lines;
  const payload = priorResult.payload as FinlitPhaseResult;
  const endingByLine = new Map(payload.byLine.map((l) => [l.lineId, l.endingInventory]));
  return lines.map((line) => ({
    ...line,
    finished: endingByLine.has(line.id) ? (endingByLine.get(line.id) as number) : line.finished,
  }));
}

interface FinlitDecisionPayload {
  lines: FinlitLine[];
  decisions: FinlitDecisions;
}

function isFinlitDecisionPayload(payload: unknown): payload is FinlitDecisionPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.lines) && typeof p.decisions === "object" && p.decisions !== null;
}

function serializeDecision(doc: TeamRoundDecisionInterface) {
  return {
    id: String(doc._id),
    simulationId: String(doc.simulationId),
    roundId: String(doc.roundId),
    teamId: String(doc.teamId),
    engineKey: doc.engineKey,
    status: doc.status,
    payload: doc.payload,
    version: doc.version,
    configVersion: doc.configVersion,
    submittedAt: doc.submittedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializeResult(doc: TeamRoundResultInterface) {
  return {
    id: String(doc._id),
    simulationId: String(doc.simulationId),
    roundId: String(doc.roundId),
    roundNumber: doc.roundNumber,
    teamId: String(doc.teamId),
    engineKey: doc.engineKey,
    engineVersion: doc.engineVersion,
    configVersion: doc.configVersion,
    decisionId: String(doc.decisionId),
    payload: doc.payload,
    finalizedAt: doc.finalizedAt,
  };
}

// ---------- GET /api/player/bootstrap ----------

export const bootstrap = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const round = await resolveCurrentRound(simulation._id as Types.ObjectId);

    let decision: TeamRoundDecisionInterface | null = null;
    let result: TeamRoundResultInterface | null = null;
    if (round) {
      decision = await TeamRoundDecision.findOne({ simulationId: simulation._id, roundId: round._id, teamId: team._id });
      result = await TeamRoundResult.findOne({ simulationId: simulation._id, roundId: round._id, teamId: team._id });
    }

    const canEditDecision = !!round && round.status === "Active" && (!decision || decision.status === "draft");

    res.status(200).json({
      user: { id: String((req as any).user.id) },
      team: { id: String(team._id), name: team.teamName },
      simulation: { id: String(simulation._id), type: "finlit", status: simulation.status },
      round: round ? { id: String(round._id), number: round.roundNumber, status: round.status } : null,
      permissions: {
        canEditDecision,
        canSubmitDecision: canEditDecision,
        canViewResult: !!result,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load bootstrap context." });
  }
};

// ---------- GET /api/player/rounds/current/decision ----------

export const getCurrentDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const round = await resolveCurrentRound(simulation._id as Types.ObjectId);
    if (!round) {
      res.status(404).json({ message: "No round exists for this simulation yet." });
      return;
    }

    const decision = await TeamRoundDecision.findOne({ simulationId: simulation._id, roundId: round._id, teamId: team._id });
    res.status(200).json({ decision: decision ? serializeDecision(decision) : null });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load current decision." });
  }
};

// ---------- PUT /api/player/rounds/current/decision ----------

export const putCurrentDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const round = await resolveCurrentRound(simulation._id as Types.ObjectId);
    if (!round) {
      res.status(404).json({ message: "No round exists for this simulation yet." });
      return;
    }
    if (round.status !== "Active") {
      res.status(409).json({ message: `Round ${round.roundNumber} is not accepting edits (status: ${round.status}).` });
      return;
    }

    const { version, configVersion, payload } = req.body as { version?: number; configVersion?: string; payload?: unknown };
    if (version === undefined || !configVersion || payload === undefined) {
      res.status(400).json({ message: "version, configVersion, and payload are required." });
      return;
    }
    if (!isFinlitDecisionPayload(payload)) {
      res.status(400).json({ message: "payload must contain { lines: [], decisions: {} } for the finlit engine." });
      return;
    }

    const existing = await TeamRoundDecision.findOne({ simulationId: simulation._id, roundId: round._id, teamId: team._id });

    if (!existing) {
      if (version !== 0) {
        res.status(409).json({ message: "No draft exists yet — start at version 0." });
        return;
      }
      const created = await TeamRoundDecision.create({
        simulationId: simulation._id,
        roundId: round._id,
        teamId: team._id,
        engineKey: FINLIT_ENGINE_KEY,
        status: "draft",
        payload,
        configVersion,
        version: 1,
      });
      res.status(201).json(serializeDecision(created));
      return;
    }

    if (existing.status !== "draft") {
      res.status(409).json({ message: `Decision is ${existing.status} and can no longer be edited.` });
      return;
    }
    if (existing.version !== version) {
      res.status(409).json({
        message: "Version conflict — reload the current draft before saving again.",
        currentVersion: existing.version,
        current: serializeDecision(existing),
      });
      return;
    }

    existing.payload = payload;
    existing.configVersion = configVersion;
    existing.version += 1;
    await existing.save();
    res.status(200).json(serializeDecision(existing));
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to save decision draft." });
  }
};

// ---------- POST /api/player/rounds/current/preview ----------

export const previewCurrentRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const round = await resolveCurrentRound(simulation._id as Types.ObjectId);
    if (!round) {
      res.status(404).json({ message: "No round exists for this simulation yet." });
      return;
    }

    const { decisionVersion, payload } = req.body as { decisionVersion?: number; payload?: unknown };
    if (!isFinlitDecisionPayload(payload)) {
      res.status(400).json({ message: "payload must contain { lines: [], decisions: {} } for the finlit engine." });
      return;
    }

    const priorRound = round.roundNumber > 1
      ? await Round.findOne({ simulationId: simulation._id, roundNumber: round.roundNumber - 1 })
      : null;
    const priorResult = priorRound
      ? await TeamRoundResult.findOne({ simulationId: simulation._id, roundId: priorRound._id, teamId: team._id })
      : null;

    const lines = applyCarryOver(payload.lines, priorResult);
    const phase = clampPhase(round.roundNumber);
    const result = simulatePhase(lines, payload.decisions, phase);

    // Preview never persists — no decision/result write happens here.
    res.status(200).json({
      engineVersion: FINLIT_ENGINE_VERSION,
      configVersion: FINLIT_CONFIG_VERSION,
      decisionVersion: decisionVersion ?? null,
      result,
    });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Failed to compute preview." });
  }
};

// ---------- POST /api/player/rounds/current/decision/submit ----------

export const submitCurrentDecision = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const round = await resolveCurrentRound(simulation._id as Types.ObjectId);
    if (!round) {
      res.status(404).json({ message: "No round exists for this simulation yet." });
      return;
    }

    const existing = await TeamRoundDecision.findOne({ simulationId: simulation._id, roundId: round._id, teamId: team._id });
    if (!existing) {
      res.status(400).json({ message: "Save a draft before submitting." });
      return;
    }

    // Idempotent: resubmitting an already-submitted/locked decision just
    // returns the current state instead of erroring.
    if (existing.status !== "draft") {
      res.status(200).json(serializeDecision(existing));
      return;
    }

    if (round.status !== "Active") {
      res.status(409).json({ message: `Round ${round.roundNumber} is not accepting submissions (status: ${round.status}).` });
      return;
    }

    const { version } = req.body as { version?: number };
    if (version !== undefined && existing.version !== version) {
      res.status(409).json({
        message: "Version conflict — reload the current draft before submitting.",
        currentVersion: existing.version,
        current: serializeDecision(existing),
      });
      return;
    }

    existing.status = "submitted";
    existing.submittedAt = new Date();
    await existing.save();

    try {
      const { emitToTeam } = await import("../utils/socket");
      emitToTeam(String(team._id), "decision.submitted", {
        simulationId: String(simulation._id),
        roundId: String(round._id),
        teamId: String(team._id),
      });
    } catch {
      // Socket not initialized (e.g. in tests) — submission itself already succeeded.
    }

    res.status(200).json(serializeDecision(existing));
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to submit decision." });
  }
};

// ---------- GET /api/player/results, /results/current, /results/:roundNumber ----------

export const listResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const results = await TeamRoundResult.find({ simulationId: simulation._id, teamId: team._id }).sort({ roundNumber: 1 });
    res.status(200).json({ results: results.map(serializeResult) });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load results." });
  }
};

export const getCurrentResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const round = await resolveCurrentRound(simulation._id as Types.ObjectId);
    if (!round) {
      res.status(404).json({ message: "No round exists for this simulation yet." });
      return;
    }

    const result = await TeamRoundResult.findOne({ simulationId: simulation._id, roundId: round._id, teamId: team._id });
    if (!result) {
      res.status(404).json({ message: "Round has not been finalized yet." });
      return;
    }
    res.status(200).json(serializeResult(result));
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load current result." });
  }
};

export const getResultByRoundNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await resolvePlayerContext(req);
    if (isContextError(ctx)) {
      res.status(ctx.status).json({ message: ctx.error });
      return;
    }
    const { team, simulation } = ctx;

    const roundNumber = Number(req.params.roundNumber);
    if (!Number.isFinite(roundNumber)) {
      res.status(400).json({ message: "roundNumber must be a number." });
      return;
    }

    const result = await TeamRoundResult.findOne({ simulationId: simulation._id, teamId: team._id, roundNumber });
    if (!result) {
      res.status(404).json({ message: `No finalized result for round ${roundNumber}.` });
      return;
    }
    res.status(200).json(serializeResult(result));
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to load result." });
  }
};
