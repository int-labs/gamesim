/**
 * THE LEADERBOARD. Pure: config + figures in, ranked points out.
 *
 * ── WHAT IS PER ROUND, AND WHAT ACCUMULATES ─────────────────────────────────
 * Owner's ruling, 2026-09-22:
 *
 *   > "the only thing that's cumulative is JUST the point values […] everything
 *   >  else does not get cumulatively added. just the leaderboard total points."
 *
 * So a metric is scored WITHIN a round — this round's revenue, this round's
 * customers, ranked against the other teams' same-round figures — and the only
 * thing carried forward is the POINTS each round paid out.
 *
 *   per round:   Actual, Rank, Point        ← `scoreRound`
 *   cumulative:  Total points, Standing     ← `accumulate`
 *
 * A team that wins round 0 and loses round 1 keeps round 0's points. Nothing
 * else is summed across rounds, because nothing else means anything summed:
 * revenue would double-count against the round's own Financial block, and a
 * rank has no running total at all.
 *
 * ── THE SCORE ───────────────────────────────────────────────────────────────
 *
 *     rank   — teams ordered by the metric's `direction`; rank 1 is best,
 *              TIES SHARE the better rank (1, 1, 3)
 *     points = weight × (N − rank + 1)
 *
 * `N` is the number of teams that HAVE a figure for that metric in that round.
 * A team with none is not ranked and scores nothing — a different statement
 * from scoring zero, and a real one: it did not compete that round.
 *
 * Confirmed against the operator's reference sheet: weight 35 over 5 teams pays
 * 175 / 140 / 105 / 70 / 35.
 *
 * ── WHERE A FIGURE COMES FROM ───────────────────────────────────────────────
 *   origin 'server' — a `calcFinancials` field off `Decision.scored`, summed
 *                     across the team's products. The team cannot influence it.
 *   origin 'client' — `TeamRunReport.metrics[source]`, reported by the browser
 *                     because that is the only place the value exists.
 *                     SELF-REPORTED — never configure something the server can
 *                     compute this way.
 */

import type { LeaderboardMetric } from "../models/leaderboardConfig";
import {
  sumScored,
  type ReportDecision,
  type ReportRunMetrics,
} from "./reportMatrix";

export interface TeamScore {
  /** `null` = not ranked, which is NOT the same as a value of 0. */
  value:  number | null;
  rank:   number | null;
  points: number | null;
}

/** One metric's ranked column for one round. */
export interface LeaderboardBlock {
  metricKey: string;
  label:     string;
  format:    LeaderboardMetric["format"];
  weight:    number;
  scores:    Map<string, TeamScore>;
}

export interface RoundScore {
  blocks: LeaderboardBlock[];
  /** This round's points per team — the only thing that carries forward. */
  points: Map<string, number>;
}

export interface LeaderboardInputs {
  teamIds:       string[];
  decisionFor:   (teamId: string) => ReportDecision | null;
  runMetricsFor: (teamId: string) => ReportRunMetrics | null;
}

/**
 * A client-origin figure for one team in one round.
 *
 * `Decision.clientMetrics` FIRST: since 2026-09-22 the insight check is asked
 * before the round is submitted, so its answer arrives in the same
 * `POST /decisions` as the decision itself — one document per
 * `simulation × team × round` carrying both halves of the leaderboard.
 *
 * `TeamRunReport.metrics` is the fallback, and only that. It is filed once when
 * a RUN ends rather than per round, so it cannot attribute a figure to the
 * round that earned it — which is exactly why the insight moved. Rounds scored
 * before the move still read from it.
 */
function clientValue(
  io: LeaderboardInputs,
  teamId: string,
  source: string,
): number | null {
  const fromDecision = io.decisionFor(teamId)?.clientMetrics?.[source];
  if (typeof fromDecision === "number" && Number.isFinite(fromDecision)) return fromDecision;

  const fromRunReport = io.runMetricsFor(teamId)?.[source];
  return typeof fromRunReport === "number" && Number.isFinite(fromRunReport)
    ? fromRunReport
    : null;
}

/** Rank and points for one metric across every team, within ONE round. */
function scoreMetric(
  m: LeaderboardMetric,
  io: LeaderboardInputs,
): Map<string, TeamScore> {
  const vals = io.teamIds.map((t) => ({
    id: t,
    v: m.origin === "client"
      ? clientValue(io, t, m.source)
      // Summed across the team's PRODUCTS for this round — a column is a team,
      // and every configured source is additive.
      : sumScored(io.decisionFor(t), m.source),
  }));

  const ranked = vals
    .filter((x): x is { id: string; v: number } => x.v != null)
    // `direction` decides which end wins — `asc` where less is better.
    .sort((a, b) => (m.direction === "asc" ? a.v - b.v : b.v - a.v));

  const N = ranked.length;
  const out = new Map<string, TeamScore>();

  for (const x of ranked) {
    // Ties share the FIRST index at which the value appears: two teams level at
    // the top are both rank 1 and the next is rank 3.
    const rank = ranked.findIndex((y) => y.v === x.v) + 1;
    out.set(x.id, { value: x.v, rank, points: m.weight * (N - rank + 1) });
  }
  for (const x of vals) {
    if (!out.has(x.id)) out.set(x.id, { value: null, rank: null, points: null });
  }
  return out;
}

/** Score ONE round: every metric ranked, and what each team earned. */
export function scoreRound(
  metrics: LeaderboardMetric[],
  io: LeaderboardInputs,
): RoundScore {
  const blocks: LeaderboardBlock[] = metrics.map((m) => ({
    metricKey: m.key,
    label:     m.label,
    format:    m.format,
    weight:    m.weight,
    scores:    scoreMetric(m, io),
  }));

  const points = new Map<string, number>(
    io.teamIds.map((t) => [
      t,
      blocks.reduce((a, b) => a + (b.scores.get(t)?.points ?? 0), 0),
    ]),
  );

  return { blocks, points };
}

export interface Standings {
  /** teamId → points earned across every round up to and including this one. */
  totals:   Map<string, number>;
  /** teamId → placing on those totals, ties sharing the better one. */
  standing: Map<string, number>;
}

/**
 * THE CUMULATIVE HALF. Sum each round's points, then rank on the running total.
 *
 * `perRound` is every round from 0 up to and including the one being reported,
 * in order. A round a team did not play contributes nothing rather than
 * dragging it down — not competing is not the same as losing.
 */
export function accumulate(
  teamIds: string[],
  perRound: Array<Map<string, number>>,
): Standings {
  const totals = new Map<string, number>(
    teamIds.map((t) => [t, perRound.reduce((a, r) => a + (r.get(t) ?? 0), 0)]),
  );

  const order = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const standing = new Map<string, number>(
    order.map(([teamId, v]) => [teamId, order.findIndex(([, w]) => w === v) + 1]),
  );

  return { totals, standing };
}
