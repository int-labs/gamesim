/**
 * Everything a round's reports need, loaded from the database once.
 *
 * The builders in `reportMatrix.ts` are pure — this is the only place a report
 * touches Mongo, so a change of source cannot silently alter what is rendered.
 */

import mongoose from "mongoose";
import Simulation from "../models/simulations";
import Team from "../models/teams";
import Product from "../models/products";
import GlobalInput from "../models/globalInputs";
import Decision from "../models/decisions";
import TeamRunReport from "../models/teamRunReport";
import LeaderboardConfig, { type LeaderboardMetric } from "../models/leaderboardConfig";
import {
  buildCompetitorMatrix,
  buildDecisionMatrix,
  type ReportMatrix,
  type ReportRunMetrics,
  type ScoredLeaderboard,
} from "./reportMatrix";
import { accumulate, scoreRound, type RoundScore } from "./leaderboard";

/** Bucket documents carrying a `roundNumber` by that round. */
function groupByRound<T extends { roundNumber?: unknown }>(docs: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const d of docs) {
    const r = Number(d.roundNumber);
    if (!Number.isInteger(r)) continue;
    if (!out.has(r)) out.set(r, []);
    out.get(r)!.push(d);
  }
  return out;
}

export type ReportKind = "decisions" | "competitor";

export interface RoundReportRequest {
  simulationId: string;
  roundNumber:  number;
  kind:         ReportKind;
}

export interface RoundReportResult {
  matrix:   ReportMatrix;
  title:    string;
  subtitle: string;
  /** Suggested download name, without a directory. */
  filename: string;
}

/**
 * Load, build, and describe. Throws with a readable message rather than
 * returning an empty report: "no decisions for round 2" is actionable, a blank
 * page is not.
 */
export async function buildRoundReport(
  req: RoundReportRequest,
): Promise<RoundReportResult> {
  const { simulationId, roundNumber, kind } = req;

  if (!mongoose.isValidObjectId(simulationId)) {
    throw new Error("simulationId is not a valid id.");
  }

  const simulation = await Simulation.findById(simulationId).lean();
  if (!simulation) throw new Error("Simulation not found.");

  const simulationTypeId =
    (simulation as { simulationTypeId?: unknown }).simulationTypeId;

  // Decisions and run reports for EVERY round up to and including this one.
  // The leaderboard's Total points is cumulative — it sums what each round paid
  // out — so the prior rounds have to be scored, not just this one. Everything
  // else on the report reads only `roundNumber`.
  const [teams, products, containers, allDecisions, allRunReports, config] = await Promise.all([
    Team.find({ simulationId }).lean(),
    Product.find({ simulationTypeId }).lean(),
    GlobalInput.find({ simulationTypeId }).lean(),
    Decision.find({ simulationId, roundNumber: { $lte: roundNumber } }).lean(),
    TeamRunReport.find({ simulationId, roundNumber: { $lte: roundNumber } }).lean(),
    LeaderboardConfig.findOne({ simulationTypeId }).lean(),
  ]);

  const decisions = allDecisions.filter(
    (d) => Number((d as { roundNumber: number }).roundNumber) === roundNumber,
  );

  if (teams.length === 0) {
    throw new Error("No teams on this simulation — nothing to compare.");
  }
  if (decisions.length === 0) {
    throw new Error(`No decisions submitted for round ${roundNumber}.`);
  }

  // `TeamRunReport.metrics` is the CLIENT-origin half of the leaderboard, and
  // it is read PER ROUND inside the scoring loop below — not once here — since
  // the cumulative points need every round's, not just this one's.

  const metrics: LeaderboardMetric[] =
    (config as { metrics?: LeaderboardMetric[] } | null)?.metrics ?? [];

  const simName =
    (simulation as { simulationName?: string; name?: string }).simulationName ??
    (simulation as { name?: string }).name ??
    simulationId;

  const stamp = new Date().toISOString().slice(0, 10);
  const teamCount = teams.length;

  if (kind === "competitor") {
    // ── Score every round 0..N, carry only the POINTS forward ───────────────
    //
    // Each round is ranked among the teams that played THAT round, then the
    // points are summed. Nothing else accumulates: this round's Actual and Rank
    // are this round's, and summing revenue across rounds would double-count
    // against the Financial block below.
    let board: ScoredLeaderboard | null = null;

    if (metrics.length > 0) {
      const teamIds = teams.map((t) => String((t as { _id: unknown })._id));
      const byRoundDecisions = groupByRound(allDecisions);
      const byRoundRunMetrics = groupByRound(allRunReports);

      const perRound: Array<Map<string, number>> = [];
      let thisRound: RoundScore | null = null;

      // Ascending, so `thisRound` ends on the round being reported.
      for (const r of [...byRoundDecisions.keys()].sort((a, b) => a - b)) {
        const decs = new Map(
          (byRoundDecisions.get(r) ?? []).map((d) => [String((d as never as { teamId: unknown }).teamId), d]),
        );
        const runs = new Map(
          (byRoundRunMetrics.get(r) ?? []).map((x) => [
            String((x as never as { teamId: unknown }).teamId),
            ((x as never as { metrics?: ReportRunMetrics }).metrics ?? {}),
          ]),
        );
        const scored = scoreRound(metrics, {
          teamIds,
          decisionFor: (t) => (decs.get(t) as never) ?? null,
          runMetricsFor: (t) => runs.get(t) ?? null,
        });
        perRound.push(scored.points);
        if (r === roundNumber) thisRound = scored;
      }

      if (thisRound) {
        board = { round: thisRound, ...accumulate(teamIds, perRound) };
      }
    }

    const matrix = buildCompetitorMatrix(
      roundNumber,
      decisions as never,
      teams as never,
      products as never,
      containers as never,
      board,
    );
    return {
      matrix,
      title: `Round ${roundNumber} - competitor report`,
      // ASCII hyphens only: the base-14 fonts are WinAnsi and U+2212 is not in
      // that set. See the note in reportPdf.ts.
      subtitle:
        `${simName}  ·  ${teamCount} teams  ·  generated ${stamp}  ·  ` +
        (metrics.length > 0
          ? `points = weight x (N - rank + 1), weighting from Leaderboard Config`
          : `no leaderboard configured for this simulation type`),
      filename: `competitor_${simulationId}_round${roundNumber}.pdf`,
    };
  }

  const matrix = buildDecisionMatrix(
    roundNumber,
    decisions as never,
    teams as never,
    products as never,
    containers as never,
  );
  return {
    matrix,
    title: `Round ${roundNumber} - decision comparison`,
    subtitle:
      `${simName}  ·  ${teamCount} teams  ·  generated ${stamp}  ·  ` +
      `channel rows are apportioned, not stored`,
    filename: `decisions_${simulationId}_round${roundNumber}.pdf`,
  };
}
