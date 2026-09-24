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
import PlayerConfig from "../models/playerConfig";
import {
  buildCashWalk,
  buildCompetitorMatrix,
  buildDecisionMatrix,
  type CashWalk,
  type OpeningStock,
  type ReportMatrix,
  type ReportRunMetrics,
  type ScoredLeaderboard,
} from "./reportMatrix";
import { accumulate, scoreRound, type RoundScore } from "./leaderboard";

/** Bucket documents carrying a `roundNumber` by that round. */
export function groupByRound<T extends { roundNumber?: unknown }>(docs: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const d of docs) {
    const r = Number(d.roundNumber);
    if (!Number.isInteger(r)) continue;
    if (!out.has(r)) out.set(r, []);
    out.get(r)!.push(d);
  }
  return out;
}

/**
 * The team's opening cash, from the operator's constant overrides.
 *
 * MAGIC PATH, and worth naming as one: `PlayerConfig.config` is typed as
 * `Record<string, PlayerConfigEntry[]>` but is `Mixed` in the schema, and the
 * player client's `applyConstants` reads a `constants` object out of it that the
 * type does not describe. `.self` is a vestige of the deleted funding-route
 * choice — the table stayed keyed when the mechanic went.
 *
 * `null` rather than a fallback when it is absent or not finite: the client's
 * bundled default lives in that bundle, and restating it here would be a second
 * place to set one number — exactly what PlayerConfig's own header forbids.
 * The cash rows are then omitted instead of being drawn from an invented seed.
 */
export function openingCashFrom(playerConfig: unknown): number | null {
  const constants = (playerConfig as { config?: { constants?: unknown } } | null)
    ?.config?.constants as { STARTING_CASH?: { self?: unknown } } | undefined;
  const seed = Number(constants?.STARTING_CASH?.self);
  return Number.isFinite(seed) ? seed : null;
}

/**
 * What each team carried into `roundNumber`: the PREVIOUS round's stored
 * `closingStock`, per product.
 *
 * The same source the scoring path uses — `roundCalculation` reads round N-1's
 * `closingStock` as round N's `openingStock` — so the report cannot disagree
 * with what was actually scored. Empty at round 0, and empty for any round whose
 * predecessor was never calculated, which prints 0 rather than inventing a carry.
 */
export function openingStockFor(
  byRound: Map<number, unknown[]>,
  roundNumber: number,
): OpeningStock {
  const out: OpeningStock = new Map();
  for (const d of byRound.get(roundNumber - 1) ?? []) {
    const dec = d as {
      teamId?: unknown;
      scored?: Record<string, { closingStock?: unknown }> | null;
    };
    const perProduct = new Map<string, number>();
    for (const [productId, m] of Object.entries(dec.scored ?? {})) {
      const units = Number(m?.closingStock);
      if (Number.isFinite(units) && units !== 0) perProduct.set(productId, units);
    }
    if (perProduct.size > 0) out.set(String(dec.teamId), perProduct);
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
  const [teams, products, containers, allDecisions, allRunReports, config, playerConfig] =
    await Promise.all([
      Team.find({ simulationId }).lean(),
      Product.find({ simulationTypeId }).lean(),
      GlobalInput.find({ simulationTypeId }).lean(),
      Decision.find({ simulationId, roundNumber: { $lte: roundNumber } }).lean(),
      TeamRunReport.find({ simulationId, roundNumber: { $lte: roundNumber } }).lean(),
      LeaderboardConfig.findOne({ simulationTypeId }).lean(),
      PlayerConfig.findOne({ simulationTypeId }).lean(),
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

  // Cash is walked from the opening across EVERY round up to this one, so it
  // needs the same `$lte` set the leaderboard does — not the filtered `decisions`.
  const teamIds = teams.map((t) => String((t as { _id: unknown })._id));
  const seed = openingCashFrom(playerConfig);
  const byRoundDecisions = groupByRound(allDecisions);
  const cash: CashWalk | null =
    seed == null
      ? null
      : buildCashWalk(seed, roundNumber, byRoundDecisions as never, teamIds);

  // Reuses the same grouping the cash walk needs — both read a PRIOR round, and
  // building a second copy is how the two would come to disagree about one.
  const opening = openingStockFor(byRoundDecisions, roundNumber);

  // ── Score every round 0..N, carry only the POINTS forward ─────────────────
  //
  // Each round is ranked among the teams that played THAT round, then the
  // points are summed. Nothing else accumulates: this round's Actual and Rank
  // are this round's, and summing revenue across rounds would double-count
  // against the Financial block.
  //
  // Computed for BOTH report kinds: the competitor report renders the figures
  // and the analysis report renders the working behind them, from this one
  // scoring run. Scoring twice is how the two would come to disagree about a
  // team's points.
  let board: ScoredLeaderboard | null = null;

  if (metrics.length > 0) {
    // `teamIds` and `byRoundDecisions` are the ones built for the cash walk —
    // both halves rank the same roster over the same rounds, and building a
    // second copy here is how the two would drift.
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

  if (kind === "competitor") {
    const matrix = buildCompetitorMatrix(
      roundNumber,
      decisions as never,
      teams as never,
      products as never,
      containers as never,
      board,
      cash,
      opening,
    );
    return {
      matrix,
      title: `Round ${roundNumber} - competitor report`,
      // ASCII hyphens only: the base-14 fonts are WinAnsi and U+2212 is not in
      // that set. See the note in reportPdf.ts.
      // TWO different weights appear on this report and a reader must be able to
      // tell them apart: the leaderboard weight sits in the `Point (weight N)`
      // label, the Weight COLUMN is the product field's own `direction`.
      subtitle:
        `${simName}  ·  ${teamCount} teams  ·  generated ${stamp}  ·  ` +
        (metrics.length > 0
          ? `points = weight x (N - rank + 1), weighting from Leaderboard Config`
          : `no leaderboard configured for this simulation type`) +
        `  ·  Weight column = that field's direction (0-1), blank where it does not compete`,
      filename: `competitor_${simulationId}_round${roundNumber}.pdf`,
    };
  }

  const matrix = buildDecisionMatrix(
    roundNumber,
    decisions as never,
    teams as never,
    products as never,
    containers as never,
    cash,
    // The analysis report shows the WORKING behind every leaderboard figure, so
    // it needs the same scored board the competitor report renders — not a
    // second scoring run, which could disagree about a team's points.
    board,
    opening,
  );
  return {
    matrix,
    title: `Round ${roundNumber} - analysis report`,
    subtitle:
      `${simName}  ·  ${teamCount} teams  ·  generated ${stamp}  ·  ` +
      `channel rows are apportioned, not stored`,
    filename: `analysis_${simulationId}_round${roundNumber}.pdf`,
  };
}
