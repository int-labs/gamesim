// Cost module — per-line in the portfolio model.
//
// Each function takes the line whose costs are being computed. The
// previous single-product API is preserved as thin wrappers that read
// the *active* line, so legacy callers (UI panels showing the active
// notebook) keep working without code changes — but now they reflect
// the active line, not a hidden global product.
//
// Cost chain (per line):
//   unitMaterial = (PAPER + COVER + BINDING + Σ addOnCost)
//                  × SIZE_COST_MULT
//                  × materialCostMult           ← global event modifier
//
//   unitTime     = SIZE_TIME × (1 + ADDON_COMPLEXITY × addOnCount)
//
//   effectivePrice = line.price × priceMult     ← global event modifier
//
// Daily opex (company-wide, NOT per-line):
//   labor      = hires × wage
//   marketing  = marketingPerDay × marketingMult

import type { GameState } from '@/state/store';
import type { ProductLine } from '@/types';
import { ADDONS } from '@/data/addOns';
import {
  PAPER_COST,
  COVER_COST,
  BINDING_COST,
  SIZE_COST_MULT,
  SIZE_TIME_MULT,
} from '@/data/balance';
import {
  ADDON_COMPLEXITY,
  PACKAGING_PER_UNIT,
  FULFILLMENT_PER_UNIT,
  HIRE_DAILY_WAGE,
  RAW_UNIT_COST_FLOOR,
} from './config';
import { aggregateActive } from './modifiers';
import { finite, nonNeg, posOr1 } from './validation';

// ---- Helpers --------------------------------------------------------

export const getLineOrThrow = (s: GameState, lineId: string): ProductLine => {
  const line = s.portfolio.productLines.find((l) => l.id === lineId);
  if (!line) {
    throw new Error(`ProductLine not found: ${lineId}`);
  }
  return line;
};

export const getActiveLine = (s: GameState): ProductLine =>
  getLineOrThrow(s, s.portfolio.activeLineId);

/** Add-ons currently active on a line (only the line's CURRENT archetype). */
export const currentAddOnsForLine = (line: ProductLine) =>
  line.addOnsByArchetype[line.archetype] ?? [];

/** Backwards-compat: active line's add-ons. */
export const currentAddOns = (s: GameState) => currentAddOnsForLine(getActiveLine(s));

// ---- Per-line cost --------------------------------------------------

/** COGS per unit for a specific line. */
export const calcUnitCostForLine = (s: GameState, line: ProductLine): number => {
  const list = currentAddOnsForLine(line);
  const addOnsCost = list.reduce((sum, inst) => {
    const def = ADDONS.find((a) => a.id === inst.defId);
    return sum + finite(def?.costPerUnit, 0);
  }, 0);
  const base =
    finite(PAPER_COST[line.paperQuality], 0) +
    finite(COVER_COST[line.cover], 0) +
    finite(BINDING_COST[line.binding], 0);
  const mods = aggregateActive(s.activeModifiers);
  const sizeMul = finite(SIZE_COST_MULT[line.size], 1);
  const matMul = finite(mods.materialCostMult, 1);
  return nonNeg((base + addOnsCost) * sizeMul * matMul);
};

/** Backwards-compat: unit cost of the active line. */
export const calcUnitCost = (s: GameState): number =>
  calcUnitCostForLine(s, getActiveLine(s));

/** Raw-purchase floor (so paper/cover minimums don't free-fall the supplier price). */
export const calcRawPurchaseUnitCostForLine = (s: GameState, line: ProductLine): number =>
  Math.max(RAW_UNIT_COST_FLOOR, calcUnitCostForLine(s, line));

/** Backwards-compat raw purchase price for active line. */
export const calcRawPurchaseUnitCost = (s: GameState): number =>
  calcRawPurchaseUnitCostForLine(s, getActiveLine(s));

/** Production time per unit for a specific line. */
export const calcUnitTimeForLine = (line: ProductLine): number => {
  const c = currentAddOnsForLine(line).length;
  return posOr1(finite(SIZE_TIME_MULT[line.size], 1) * (1 + ADDON_COMPLEXITY * c));
};

/** Backwards-compat: active line's unit time. */
export const calcUnitTime = (s: GameState): number =>
  calcUnitTimeForLine(getActiveLine(s));

/** Sticker price after global priceMult, for a specific line. */
export const calcEffectivePriceForLine = (s: GameState, line: ProductLine): number => {
  const mods = aggregateActive(s.activeModifiers);
  return nonNeg(line.price * finite(mods.priceMult, 1));
};

/** Backwards-compat: active line's effective price. */
export const calcEffectivePrice = (s: GameState): number =>
  calcEffectivePriceForLine(s, getActiveLine(s));

/**
 * Per-unit-sold direct cash costs (packaging + fulfillment). Same for
 * every line — they're channel-side costs, not product-side.
 */
export const calcDirectSaleCostPerUnit = (): number =>
  finite(PACKAGING_PER_UNIT, 0) + finite(FULFILLMENT_PER_UNIT, 0);

/** Daily fixed opex paid every tick regardless of sales. Company-wide. */
export const calcDailyOpex = (s: GameState): { labor: number; marketing: number } => {
  const mods = aggregateActive(s.activeModifiers);
  return {
    labor: nonNeg(s.ops.hires * HIRE_DAILY_WAGE),
    marketing: nonNeg(s.channels.marketingPerDay * finite(mods.marketingMult, 1)),
  };
};

// ---- Portfolio-level aggregates -------------------------------------

/**
 * Average unit cost across the portfolio, weighted by quantityTarget.
 * Useful for "portfolio summary" UI displays.
 */
export const portfolioAvgUnitCost = (s: GameState): number => {
  const lines = s.portfolio.productLines;
  if (lines.length === 0) return 0;
  let totalCost = 0;
  let totalQty = 0;
  for (const l of lines) {
    const q = Math.max(1, l.quantityTarget);
    totalCost += calcUnitCostForLine(s, l) * q;
    totalQty += q;
  }
  return totalQty > 0 ? totalCost / totalQty : 0;
};

export { PACKAGING_PER_UNIT, FULFILLMENT_PER_UNIT, HIRE_DAILY_WAGE };
