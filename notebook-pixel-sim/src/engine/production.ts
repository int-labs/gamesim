// Production module — shared capacity across multiple product lines.
//
// In the portfolio model, the company has ONE capacity number
// (ops.capacity × event capacityMult). Every line draws on that same
// pool. Allocation is proportional to each line's daily target and
// production complexity:
//
//   dailyTarget[i]    = ceil(line.quantityTarget / phaseLength)   (units)
//   unitTime[i]       = calcUnitTimeForLine(line)                 (time/u)
//   loadRequested[i]  = dailyTarget[i] × unitTime[i]              (time)
//   totalLoad         = Σ loadRequested
//
//   if totalLoad ≤ capacity:
//       lineUnits[i] = min(dailyTarget[i], line.raw)              (no scarcity)
//   else:
//       scale        = capacity / totalLoad                       (∈ (0, 1))
//       lineUnits[i] = min(floor(dailyTarget[i] × scale), line.raw)
//
// Defects are line-specific: defectRate (global) is applied to each
// line's production output. So a higher company-wide defect rate hits
// every line equally, but raw availability per line still gates output.
//
// Returns a per-line allocation. The simulation engine applies it.

import type { GameState } from '@/state/store';
import type { ProductLine } from '@/types';
import { aggregateActive } from './modifiers';
import { MAX_DEFECT_RATE } from './config';
import { calcUnitTimeForLine } from './cost';
import { calcComplexityPenalty } from './complexity';
import { phaseOf } from '@/utils/format';
import { clamp, finite, nonNeg, posOr1, roundInt } from './validation';

const PHASE_LENGTH_DAYS = 30;

/**
 * Effective production capacity today (time-units, before unit-time divisor).
 *
 * Three multipliers stack:
 *   1. base ops capacity (helpers + tools acquired)
 *   2. capacityMult from active event modifiers
 *   3. (1 − complexityPenalty) — soft pressure when the portfolio's
 *      complexity exceeds what current capacity can comfortably handle
 */
export const calcCapacityToday = (s: GameState): number => {
  const mods = aggregateActive(s.activeModifiers);
  const baseCap = nonNeg(s.ops.capacity);
  const complexityPenalty = calcComplexityPenalty(s);
  const effective = baseCap * finite(mods.capacityMult, 1) * (1 - complexityPenalty);
  return Math.max(1, Math.floor(effective));
};

/**
 * Defect rate = ops baseline + event modifier additive + complexity bump.
 * Complexity bump is small (max +2% at full penalty) so the main pressure
 * shows up via capacity reduction; defects are the secondary symptom.
 */
export const calcDefectRate = (s: GameState): number => {
  const mods = aggregateActive(s.activeModifiers);
  const complexityPenalty = calcComplexityPenalty(s);
  return clamp(
    finite(s.ops.defectRate, 0)
      + finite(mods.defectAdd, 0)
      + complexityPenalty * 0.05,
    0,
    MAX_DEFECT_RATE,
  );
};

/** Per-line daily build target derived from per-phase quantityTarget. */
export const dailyTargetForLine = (line: ProductLine): number =>
  Math.max(0, Math.ceil(nonNeg(line.quantityTarget) / PHASE_LENGTH_DAYS));

export interface LineProductionPlan {
  lineId: string;
  /** Units intended to be produced today before scarcity scaling. */
  dailyTarget: number;
  /** Raw materials this line has on hand. */
  rawAvailable: number;
  /** Time-load this line requested from the shared capacity pool. */
  loadRequested: number;
  /** Time-load actually allocated (after scaling for capacity scarcity). */
  loadAllocated: number;
  /** Units this line will attempt to produce (before defect). */
  attempted: number;
  /** Defect units lost. */
  defects: number;
  /** Good units added to this line's finished inventory. */
  finishedAdded: number;
}

export interface PortfolioProductionPlan {
  capacity: number;
  totalLoadRequested: number;
  totalLoadAllocated: number;
  /** True if total requested load exceeded available capacity. */
  overloaded: boolean;
  /** scaling factor applied (1 when not overloaded). */
  scale: number;
  defectRate: number;
  byLine: LineProductionPlan[];
}

/**
 * Plan today's production across the portfolio. Pure projection — the
 * simulation engine consumes raw, increments finished, and writes
 * ledger entries based on this plan.
 */
export const planProduction = (s: GameState): PortfolioProductionPlan => {
  void phaseOf; // phase length is fixed at 30 days; phase number unused here
  const capacity = calcCapacityToday(s);
  const defectRate = calcDefectRate(s);
  const lines = s.portfolio.productLines;

  // First pass: compute requested load per line.
  const requested: Array<{ line: ProductLine; dailyTarget: number; unitTime: number; loadRequested: number; rawAvailable: number }> = [];
  let totalLoadRequested = 0;
  for (const line of lines) {
    const dailyTarget = dailyTargetForLine(line);
    const unitTime = posOr1(calcUnitTimeForLine(line));
    const loadRequested = dailyTarget * unitTime;
    const rawAvailable = nonNeg(line.inventory.raw);
    requested.push({ line, dailyTarget, unitTime, loadRequested, rawAvailable });
    totalLoadRequested += loadRequested;
  }

  const overloaded = totalLoadRequested > capacity;
  const scale = overloaded && totalLoadRequested > 0 ? capacity / totalLoadRequested : 1;

  // Second pass: allocate scaled load per line, gated by raw availability.
  const byLine: LineProductionPlan[] = [];
  let totalLoadAllocated = 0;
  for (const r of requested) {
    const scaledTarget = Math.floor(r.dailyTarget * scale);
    const attempted = Math.max(0, Math.min(scaledTarget, r.rawAvailable));
    const defects = roundInt(attempted * defectRate);
    const finishedAdded = Math.max(0, attempted - defects);
    const loadAllocated = attempted * r.unitTime;
    totalLoadAllocated += loadAllocated;
    byLine.push({
      lineId: r.line.id,
      dailyTarget: r.dailyTarget,
      rawAvailable: r.rawAvailable,
      loadRequested: r.loadRequested,
      loadAllocated,
      attempted,
      defects,
      finishedAdded,
    });
  }

  return {
    capacity,
    totalLoadRequested,
    totalLoadAllocated,
    overloaded,
    scale,
    defectRate,
    byLine,
  };
};
