// THE PLAYER'S HALF OF THE LEADERBOARD CONTRACT.
//
// The SERVER declares which metric keys exist — `LeaderboardConfig.metrics[]`
// with `origin: 'client'` — and this file resolves each of those keys against
// whatever the game state actually holds. Neither side invents the other's half:
//
//   server  declares the key, its weight, its label, how it ranks
//   client  resolves the key to a raw value, if it can
//
// NOTHING HERE IS A FIXED LIST OF METRIC NAMES. An earlier version hardcoded
// `insightCorrect` / `insightTotal` / `insightAccuracy`, which meant every new
// scored thing in the game needed a code change here before an operator could
// rank on it — and the whole point of moving the config server-side was that
// they should not have to wait for one.
//
// Instead: a metric key is `<slice><Aggregate>`. Any slice of game state shaped
// `{ score: { correct, total } }` is rankable, and the three aggregates below
// apply to all of them identically. Add a scored slice to the store and
// `<thatSlice>Accuracy` starts working with no edit to this file.
//
//     insights: { score: { correct, total } }   ⇒  insightCorrect
//                                                  insightTotal
//                                                  insightAccuracy
//
// WHY ANY OF THIS IS CLIENT-SIDE: the insight questions are answered in the
// browser and nowhere else, so no server-side calculation could produce them.
// Everything the server CAN compute must be configured `origin: 'server'` — a
// client metric is self-reported and must never carry a figure that could have
// been scored authoritatively.
//
// Values are RAW. No clamping, no rubric banding — `insightCorrect` is a count
// of correct answers, not a 0..25 band. The leaderboard config owns what a
// number means; scoring it here would be a second opinion about it.

import type { GameState } from '@/state/store';

/** The shape that makes a slice of state rankable. */
interface ScoreLike {
  correct: number;
  total: number;
}

/**
 * How a metric key's SUFFIX turns a `{correct,total}` pair into one number.
 *
 * `null` means "no value", which is not zero — see `Accuracy`. A `null` drops
 * the key from the payload rather than reporting a figure the team never had.
 */
const AGGREGATES: Record<string, (sc: ScoreLike) => number | null> = {
  /** How many were answered correctly. A COUNT. */
  Correct: (sc) => sc.correct,
  /** How many were asked — reported so a rate can be checked against its
   *  denominator rather than taken on trust. */
  Total: (sc) => sc.total,
  /**
   * Correct ÷ asked, 0..1.
   *
   * `null` when nothing was asked: a team with no questions has no accuracy,
   * and a zero would rank it BELOW a team that answered one and got it wrong.
   */
  Accuracy: (sc) => (sc.total > 0 ? sc.correct / sc.total : null),
};

export const AGGREGATE_NAMES = Object.keys(AGGREGATES);

const isScoreLike = (v: unknown): v is ScoreLike =>
  !!v && typeof v === 'object' &&
  typeof (v as ScoreLike).correct === 'number' &&
  typeof (v as ScoreLike).total === 'number';

/**
 * Every slice of state that carries a `{ score: { correct, total } }`, keyed by
 * a NORMALISED name: lower-cased, trailing "s" dropped, so the store's
 * `insights` answers to a configured `insight…`.
 *
 * Discovered by walking the state rather than listed, which is what makes a new
 * scored slice available without touching this file.
 */
function discoverScoredSlices(s: GameState): Map<string, ScoreLike> {
  const out = new Map<string, ScoreLike>();
  for (const [name, value] of Object.entries(s as unknown as Record<string, unknown>)) {
    const score = (value as { score?: unknown } | null)?.score;
    if (isScoreLike(score)) out.set(normalise(name), score);
  }
  return out;
}

const normalise = (name: string) => name.toLowerCase().replace(/s$/, '');

/** Split `insightAccuracy` into its slice and its aggregate. `null` when the
 *  key carries no aggregate this build knows. */
function parseMetricKey(key: string): { slice: string; aggregate: string } | null {
  for (const aggregate of AGGREGATE_NAMES) {
    if (key.length > aggregate.length && key.endsWith(aggregate)) {
      return { slice: normalise(key.slice(0, -aggregate.length)), aggregate };
    }
  }
  return null;
}

/**
 * Build the `metrics` map for a run report.
 *
 * `sources` is the set of `source` values from the leaderboard config whose
 * origin is 'client'. Only those are reported — the player does not volunteer
 * numbers nobody configured, so the stored document stays a record of what the
 * operator actually asked for.
 *
 * A key that cannot be resolved is OMITTED, not sent as 0. On a leaderboard a
 * zero reads as a team that competed and scored nothing, where a blank reads as
 * a metric with no figure — which is what a misconfigured or unimplemented key
 * actually is, and the one that gets noticed.
 */
export function collectClientMetrics(
  s: GameState,
  sources: readonly string[],
): Record<string, number> {
  const slices = discoverScoredSlices(s);
  const out: Record<string, number> = {};

  for (const key of sources) {
    const parsed = parseMetricKey(key);
    if (!parsed || !slices.has(parsed.slice)) {
      if (import.meta.env?.DEV) {
        console.warn(
          `[gamesim] leaderboard asks for client metric "${key}", which this build ` +
          `cannot resolve — it will be blank on the report. Expected ` +
          `<slice><Aggregate>, where Aggregate is one of ${AGGREGATE_NAMES.join('/')} ` +
          `and slice is one of: ${[...slices.keys()].join(', ') || '(none scored yet)'}`,
        );
      }
      continue;
    }
    const v = AGGREGATES[parsed.aggregate](slices.get(parsed.slice)!);
    if (v == null || !Number.isFinite(v)) continue;
    out[key] = v;
  }
  return out;
}
