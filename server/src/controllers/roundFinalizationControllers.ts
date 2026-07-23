import { Request, Response } from "express";
import mongoose from "mongoose";

import Round from "../models/rounds";
import Team from "../models/teams";
import TeamRoundDecision, { TeamRoundDecisionInterface } from "../models/teamRoundDecisions";
import TeamRoundResult, { TeamRoundResultInterface } from "../models/teamRoundResults";
import { simulatePhase } from "../simulation-engines/finlit/simulate";
import type { FinlitDecisions, FinlitLine } from "../simulation-engines/finlit/types";
import { FINLIT_CONFIG_VERSION, FINLIT_ENGINE_KEY, FINLIT_ENGINE_VERSION } from "../simulation-engines/finlit/engineMeta";
import { applyCarryOver } from "./playerControllers";

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

function clampPhase(roundNumber: number): 1 | 2 | 3 {
  if (roundNumber <= 1) return 1;
  if (roundNumber >= 3) return 3;
  return 2;
}

// POST /rounds/:roundId/finalize — operator/admin only (enforced at router level).
// Runs the finlit engine for every team's submitted decision inside one
// transaction, persists a TeamRoundResult per team, locks the round's
// decisions, and advances the simulation to the next round. Requires a
// replica-set Mongo deployment for multi-document transactions, same as the
// rest of this codebase's round/decision writes.
export const finalizeRound = async (req: Request, res: Response): Promise<void> => {
  const round = await Round.findById(req.params.roundId);
  if (!round) {
    res.status(404).json({ message: "Round not found." });
    return;
  }

  // Idempotent: a round already completed just returns its existing results
  // instead of re-running the engine or erroring.
  if (round.status === "Completed") {
    const existingResults = await TeamRoundResult.find({ roundId: round._id });
    res.status(200).json({ message: "Round already finalized.", results: existingResults.map(serializeResult) });
    return;
  }

  const session = await mongoose.startSession();
  let finalizedResults: TeamRoundResultInterface[] = [];
  let activatedNextRound = false;

  try {
    await session.withTransaction(async () => {
      const teams = await Team.find({ simulationId: round.simulationId }).session(session);
      const decisions = await TeamRoundDecision.find({
        simulationId: round.simulationId,
        roundId: round._id,
      }).session(session);

      const decisionByTeamId = new Map(decisions.map((d) => [String(d.teamId), d] as const));

      const missingTeams = teams.filter((t) => !decisionByTeamId.has(String(t._id)));
      if (missingTeams.length > 0) {
        throw new Error(`Missing decision for team(s): ${missingTeams.map((t) => t.teamName).join(", ")}`);
      }

      const notSubmitted = decisions.filter((d) => d.status === "draft");
      if (notSubmitted.length > 0) {
        throw new Error(`${notSubmitted.length} team(s) have not submitted their decision yet.`);
      }

      const phase = clampPhase(round.roundNumber);
      const priorRound = round.roundNumber > 1
        ? await Round.findOne({ simulationId: round.simulationId, roundNumber: round.roundNumber - 1 }).session(session)
        : null;

      for (const team of teams) {
        const decision = decisionByTeamId.get(String(team._id)) as TeamRoundDecisionInterface;

        const existingResult = await TeamRoundResult.findOne({
          simulationId: round.simulationId,
          roundId: round._id,
          teamId: team._id,
        }).session(session);

        if (existingResult) {
          // Already computed on a prior (partial) finalize attempt — reuse it.
          finalizedResults.push(existingResult);
        } else {
          const priorResult = priorRound
            ? await TeamRoundResult.findOne({
                simulationId: round.simulationId,
                roundId: priorRound._id,
                teamId: team._id,
              }).session(session)
            : null;

          const payload = decision.payload as { lines: FinlitLine[]; decisions: FinlitDecisions };
          const lines = applyCarryOver(payload.lines, priorResult);
          const engineResult = simulatePhase(lines, payload.decisions, phase);

          const [created] = await TeamRoundResult.create(
            [
              {
                simulationId: round.simulationId,
                roundId: round._id,
                roundNumber: round.roundNumber,
                teamId: team._id,
                engineKey: FINLIT_ENGINE_KEY,
                engineVersion: FINLIT_ENGINE_VERSION,
                configVersion: FINLIT_CONFIG_VERSION,
                decisionId: decision._id,
                payload: engineResult,
                finalizedAt: new Date(),
              },
            ],
            { session }
          );
          finalizedResults.push(created);
        }

        if (decision.status !== "locked") {
          decision.status = "locked";
          await decision.save({ session });
        }
      }

      round.status = "Completed";
      await round.save({ session });

      const nextRound = await Round.findOne({
        simulationId: round.simulationId,
        roundNumber: round.roundNumber + 1,
      }).session(session);
      if (nextRound && nextRound.status === "Pending") {
        nextRound.status = "Active";
        await nextRound.save({ session });
        activatedNextRound = true;
      }
    });
  } catch (err: any) {
    res.status(400).json({ message: err?.message ?? "Failed to finalize round." });
    return;
  } finally {
    await session.endSession();
  }

  res.status(200).json({ message: "Round finalized.", results: finalizedResults.map(serializeResult) });

  // Emit only after the transaction has committed and the response is sent.
  try {
    const { emitToSimulation } = await import("../utils/socket");
    const simulationId = String(round.simulationId);
    emitToSimulation(simulationId, "round.completed", { roundId: String(round._id), roundNumber: round.roundNumber });
    emitToSimulation(simulationId, "result.published", {
      roundId: String(round._id),
      roundNumber: round.roundNumber,
      teamIds: finalizedResults.map((r) => String(r.teamId)),
    });
    if (activatedNextRound) {
      emitToSimulation(simulationId, "round.started", { roundNumber: round.roundNumber + 1 });
    }
  } catch {
    // Socket not initialized (e.g. in tests) — finalization itself already succeeded.
  }
};
