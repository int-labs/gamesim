// Complexity system.
//
// The simulation no longer hard-caps how many notebook product lines
// the player can create. Instead, complexity acts as a SOFT pressure:
// the more lines / add-ons / archetype variety you carry, the harder
// your operations have to work to keep up. Once complexity exceeds
// what your current capacity can comfortably handle, two things start
// to bite:
//
//   1. Effective production capacity drops (penalty multiplier on
//      `calcCapacityToday`)
//   2. Defect rate rises slightly (additive on `calcDefectRate`)
//
// This is the gameplay tradeoff the spec calls for: a player who adds
// more lines reaches more audiences (broader demand surface) but pays
// for it in throughput and quality unless they also invest in capacity
// upgrades (helpers, tools).
//
// Score formula (matches the spec):
//
//   complexityScore =
//     numberOfLines * 1.5
//   + totalAddOns   * 0.5
//   + uniqueArchetypes * 1
//
// Threshold scales with current effective capacity — each unit of
// capacity comfortably handles ~0.5 units of complexity. Capacity
// modifiers (events that buff/nerf capacity) flow through naturally.
//
// Penalty curve: linear from 0 at threshold up to MAX_PENALTY (40%)
// at 1.8× threshold. Keeps things feelable without being punishing.

import type { GameState } from '@/state/store';
import { currentAddOnsForLine } from './cost';
import { aggregateActive } from './modifiers';
import { clamp, finite, nonNeg } from './validation';

const LINE_WEIGHT = 1.5;
const ADDON_WEIGHT = 0.5;
const ARCHETYPE_WEIGHT = 1.0;
/** Each capacity unit comfortably handles 2 complexity points. Tuned
 *  so a starter capacity of 5 keeps a 2–3 line portfolio in the
 *  "healthy" band — overload only triggers when the player stretches
 *  beyond what their current operations can plausibly cover. */
const COMPLEXITY_PER_CAPACITY = 2.0;
/** Slope of the penalty curve once threshold is exceeded. */
const PENALTY_PER_OVERSHOOT_RATIO = 0.5;
/** Hard ceiling on penalty so even an extreme portfolio remains playable. */
const MAX_PENALTY = 0.4;

/**
 * Soft sanity ceiling — players can keep adding notebooks until this
 * count. Set high so the limit basically never bites in normal play;
 * it exists only to stop a runaway loop or accidental spam.
 */
export const MAX_LINES_HARD_CAP = 20;

export interface ComplexityState {
  score: number;
  threshold: number;
  /** 0..MAX_PENALTY — applied to capacity and defect rate. */
  penalty: number;
  /** Bucketed for UI display. */
  level: ComplexityLevel;
  /** Granular contributions for tooltip / debug. */
  breakdown: { lines: number; addons: number; archetypes: number };
}

export type ComplexityLevel = 'low' | 'healthy' | 'strained' | 'overloaded';

export const calcComplexityScore = (s: GameState): number => {
  const lines = s.portfolio.productLines;
  if (lines.length === 0) return 0;
  let totalAddOns = 0;
  for (const l of lines) totalAddOns += currentAddOnsForLine(l).length;
  const uniqueArchetypes = new Set(lines.map((l) => l.archetype)).size;
  return lines.length * LINE_WEIGHT
    + totalAddOns * ADDON_WEIGHT
    + uniqueArchetypes * ARCHETYPE_WEIGHT;
};

export const calcComplexityThreshold = (s: GameState): number => {
  const mods = aggregateActive(s.activeModifiers);
  const baseCap = nonNeg(s.ops.capacity);
  // Floor of 2 ensures even a brand-new run with low capacity has a
  // sensible threshold — otherwise the first add-on would already
  // overload the system.
  return Math.max(2, baseCap * COMPLEXITY_PER_CAPACITY * finite(mods.capacityMult, 1));
};

/**
 * Multiplicative penalty in 0..MAX_PENALTY. Returns 0 when the
 * portfolio is within capacity. Applied as `(1 − penalty)` to
 * effective capacity and additively to the defect rate.
 */
export const calcComplexityPenalty = (s: GameState): number => {
  const score = calcComplexityScore(s);
  const threshold = calcComplexityThreshold(s);
  if (score <= threshold || threshold <= 0) return 0;
  const overshootRatio = (score - threshold) / threshold;
  return clamp(overshootRatio * PENALTY_PER_OVERSHOOT_RATIO, 0, MAX_PENALTY);
};

/** Bucket the score into a UI-friendly tone. */
export const calcComplexityLevel = (score: number, threshold: number): ComplexityLevel => {
  if (threshold <= 0) return 'low';
  const ratio = score / threshold;
  if (ratio < 0.6) return 'low';
  if (ratio < 1.0) return 'healthy';
  if (ratio < 1.4) return 'strained';
  return 'overloaded';
};

/** Single-call snapshot used by selectors and the UI. */
export const selectComplexity = (s: GameState): ComplexityState => {
  const lines = s.portfolio.productLines;
  let totalAddOns = 0;
  for (const l of lines) totalAddOns += currentAddOnsForLine(l).length;
  const uniqueArchetypes = new Set(lines.map((l) => l.archetype)).size;
  const score = lines.length * LINE_WEIGHT
    + totalAddOns * ADDON_WEIGHT
    + uniqueArchetypes * ARCHETYPE_WEIGHT;
  const threshold = calcComplexityThreshold(s);
  const penalty = score <= threshold || threshold <= 0
    ? 0
    : clamp((score - threshold) / threshold * PENALTY_PER_OVERSHOOT_RATIO, 0, MAX_PENALTY);
  return {
    score,
    threshold,
    penalty,
    level: calcComplexityLevel(score, threshold),
    breakdown: {
      lines: lines.length * LINE_WEIGHT,
      addons: totalAddOns * ADDON_WEIGHT,
      archetypes: uniqueArchetypes * ARCHETYPE_WEIGHT,
    },
  };
};
