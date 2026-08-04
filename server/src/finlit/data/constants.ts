// FinLit (V3) engine constants — transcribed from `FinLit Calc.xlsx` + the
// design PDF. These are the authoritative numbers for the V3 remodel.
//
// See docs/V3-FINLIT-PRD.md for the full mapping and the locked decisions.
//
// ── WHY THESE ARE `let` ─────────────────────────────────────────────────────
// They are operator-tunable from the console (PlayerConfig → `constants`), and
// hydration happens at boot AFTER these modules have loaded. A `const` export
// cannot be rebound from outside its module, so every one of these used to be
// reported as `skipped` by the hydrator: the console offered them as editable
// and editing them did nothing until the next build.
//
// `export let` + `applyConstantOverrides` fixes that using ES module LIVE
// BINDINGS — an importer reads the binding, not a copy, so reassigning here is
// visible to all ~25 importers with no change to a single one of them.
//
// Two rules keep this safe:
//   • `applyConstantOverrides` is the ONLY thing that may assign to them. They
//     are `let` for the module system's benefit, not an invitation.
//   • Nothing may derive a value from them at MODULE scope (`const x = CAP*2`),
//     because that would snapshot the bundled number before hydration runs.
//     Verified: every read today is inside a function.

/** Multiplicative production BASERATE (`F28` in the sheet). All config-option
 *  rates are <1; this scales their product into a sane units/day figure. */
export let BASERATE = 100_000;

/** A single player's base slice of a genre's market (`I8`: "8.125% divided by
 *  12 teams"). Market-share upgrades push above this. */
export let BASE_MARKET_SHARE = 0.08125;

/** Per-unit cash contribution used by the sheet's earn/day (`K13 = custPerDay
 *  × 16`). Interpreted as the average unit margin routed to cash. */
export let UNIT_CONTRIBUTION = 16;

/**
 * DEMAND_SCALE — game-balance calibration (NOT from the sheet).
 *
 * The sheet sizes the market for a cohort of ~12 competing teams (~60 buyers/
 * day per player) while production is a dorm-scale ~8–23 units/day, so demand
 * permanently outstrips supply: the LP2 inventory-balance mechanic can't
 * function and the sheet's own example config runs at a loss. We scale a single
 * player's per-day addressable demand into the production range so BOTH failure
 * modes (over- and under-production) are reachable and a well-optimised config
 * can turn a profit. Tunable — P6 balance pass locks the final value.
 */
export let DEMAND_SCALE = 0.28;

/**
 * HOLDING_RATE_PER_DAY — carrying cost on UNSOLD finished stock, as a fraction
 * of the notebook's unit cost, charged each day it sits in inventory. Gives the
 * "produce to demand" lever teeth on the over-production side (COGS is charged
 * on sale, so without this, overstock would be free). Lean production ≈ $0;
 * badly over-making a low-demand line bleeds a visible chunk of profit. Tunable.
 */
export let HOLDING_RATE_PER_DAY = 0.015;

/**
 * Marketing & Sales BUDGETS — continuous spend levers (replace the old fixed
 * marketing-team presets). Each is a $/day slider (0 = off):
 *   • Marketing budget → lifts DEMAND (awareness — more people want it)
 *   • Sales budget     → lifts SELL-RATE (conversion — more of them buy)
 * Both charge their $/day to opex and a flat energy to activate (refunded when
 * set back to 0). Tunable.
 */
export let BUDGET_MAX = 40;               // $/day cap per lever
export let BUDGET_LEVER_ENERGY = 4;       // flat ⚡ to activate a budget lever
export let MARKETING_DEMAND_RATE = 0.005; // +demand fraction per $/day
export let SALES_SELL_RATE = 0.004;       // +sell-rate per $/day

/** Demand multiplier from the marketing budget (1.0 = no spend). */
export const marketingDemandMult = (budget: number): number =>
  1 + Math.max(0, budget) * MARKETING_DEMAND_RATE;
/** Sell-rate bonus from the sales budget (0 = no spend). */
export const salesSellBonus = (budget: number): number =>
  Math.max(0, budget) * SALES_SELL_RATE;

/** Days per phase / per demand step. */
export let PHASE_LENGTH_DAYS = 30;

// ── Energy (DEC C — reconciles the PDF's two statements) ──────────────────
// Start 50, +30 at each phase rollover, hard-capped at 100. Tunable.
export let ENERGY_START = 50;
export let ENERGY_PER_PHASE = 30;
export let ENERGY_CAP = 100;

// ── Start routes (DEC D) ──────────────────────────────────────────────────
// Self-funded: $1000, clean books. Investor: $5000 cash but the P&L opens at
// −$4000 (the obligation the player must earn back).
export const ROUTE_START = {
  self: { cash: 1000, openingProfit: 0 },
  investor: { cash: 5000, openingProfit: -4000 },
} as const;

// ── Key Scenario cadence (DEC E) ──────────────────────────────────────────
// P1:1, P2:2, P3:2 = 5 total, on 15-day marks avoiding phase-end eval days.
export const SCENARIOS_PER_PHASE = { 1: 1, 2: 2, 3: 2 } as const;
export const SCENARIO_DAYS = [15, 45, 55, 75, 85] as const;

// ── Demand phase index ────────────────────────────────────────────────────
// The sheet's demand columns are Phase −1 … Phase 3. In-game phases are 1..3;
// we use the P1/P2/P3 columns for the three playable phases and keep P0 as the
// pre-game baseline (used for the opening "market briefing").
export type DemandPhaseKey = 'pMinus1' | 'p0' | 'p1' | 'p2' | 'p3';
export const GAME_PHASE_TO_DEMAND: Record<1 | 2 | 3, DemandPhaseKey> = {
  1: 'p1',
  2: 'p2',
  3: 'p3',
};

// ── Operator overrides ──────────────────────────────────────────────────────

/** Every scalar `applyConstantOverrides` will accept, and its setter. */
const SCALAR_SETTERS: Record<string, (v: number) => void> = {
  BASERATE: (v) => { BASERATE = v; },
  BASE_MARKET_SHARE: (v) => { BASE_MARKET_SHARE = v; },
  UNIT_CONTRIBUTION: (v) => { UNIT_CONTRIBUTION = v; },
  DEMAND_SCALE: (v) => { DEMAND_SCALE = v; },
  HOLDING_RATE_PER_DAY: (v) => { HOLDING_RATE_PER_DAY = v; },
  BUDGET_MAX: (v) => { BUDGET_MAX = v; },
  BUDGET_LEVER_ENERGY: (v) => { BUDGET_LEVER_ENERGY = v; },
  MARKETING_DEMAND_RATE: (v) => { MARKETING_DEMAND_RATE = v; },
  SALES_SELL_RATE: (v) => { SALES_SELL_RATE = v; },
  PHASE_LENGTH_DAYS: (v) => { PHASE_LENGTH_DAYS = v; },
  ENERGY_START: (v) => { ENERGY_START = v; },
  ENERGY_PER_PHASE: (v) => { ENERGY_PER_PHASE = v; },
  ENERGY_CAP: (v) => { ENERGY_CAP = v; },
};

/** The names this module can apply — the hydrator reports the rest as skipped. */
export const OVERRIDABLE_CONSTANTS: readonly string[] = Object.keys(SCALAR_SETTERS);

/**
 * Apply operator overrides to the scalar constants.
 *
 * Returns the names that were actually applied, so the hydration report can
 * distinguish "changed" from "offered but unknown to this build" instead of
 * claiming everything landed.
 *
 * Only finite numbers are accepted: a null or a string from a half-filled
 * console form would otherwise poison every downstream calculation with NaN,
 * and the engine treats "no NaN ever reaches state" as an invariant.
 */
export function applyConstantOverrides(patch: Record<string, unknown>): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(patch ?? {})) {
    const set = SCALAR_SETTERS[key];
    if (!set) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    set(value);
    applied.push(key);
  }
  return applied;
}
