// FinLit (V3) engine constants — transcribed from `FinLit Calc.xlsx` + the
// design PDF. These are the authoritative numbers for the V3 remodel.
//
// See docs/V3-FINLIT-PRD.md for the full mapping and the locked decisions.

/** Multiplicative production BASERATE (`F28` in the sheet). All config-option
 *  rates are <1; this scales their product into a sane units/day figure. */
export const BASERATE = 100_000;

/** A single player's base slice of a genre's market (`I8`: "8.125% divided by
 *  12 teams"). Market-share upgrades push above this. */
export const BASE_MARKET_SHARE = 0.08125;

/** Per-unit cash contribution used by the sheet's earn/day (`K13 = custPerDay
 *  × 16`). Interpreted as the average unit margin routed to cash. */
export const UNIT_CONTRIBUTION = 16;

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
export const DEMAND_SCALE = 0.28;

/**
 * HOLDING_RATE_PER_DAY — carrying cost on UNSOLD finished stock, as a fraction
 * of the notebook's unit cost, charged each day it sits in inventory. Gives the
 * "produce to demand" lever teeth on the over-production side (COGS is charged
 * on sale, so without this, overstock would be free). Lean production ≈ $0;
 * badly over-making a low-demand line bleeds a visible chunk of profit. Tunable.
 */
export const HOLDING_RATE_PER_DAY = 0.015;

/**
 * Marketing & Sales BUDGETS — continuous spend levers (replace the old fixed
 * marketing-team presets). Each is a $/day slider (0 = off):
 *   • Marketing budget → lifts DEMAND (awareness — more people want it)
 *   • Sales budget     → lifts SELL-RATE (conversion — more of them buy)
 * Both charge their $/day to opex and a flat energy to activate (refunded when
 * set back to 0). Tunable.
 */
export const BUDGET_MAX = 40;               // $/day cap per lever
export const BUDGET_LEVER_ENERGY = 4;       // flat ⚡ to activate a budget lever
export const MARKETING_DEMAND_RATE = 0.005; // +demand fraction per $/day
export const SALES_SELL_RATE = 0.004;       // +sell-rate per $/day

/** Demand multiplier from the marketing budget (1.0 = no spend). */
export const marketingDemandMult = (budget: number): number =>
  1 + Math.max(0, budget) * MARKETING_DEMAND_RATE;
/** Sell-rate bonus from the sales budget (0 = no spend). */
export const salesSellBonus = (budget: number): number =>
  Math.max(0, budget) * SALES_SELL_RATE;

/** Days per phase / per demand step. */
export const PHASE_LENGTH_DAYS = 30;

// ── Energy (DEC C — reconciles the PDF's two statements) ──────────────────
// Start 50, +30 at each phase rollover, hard-capped at 100. Tunable.
export const ENERGY_START = 50;
export const ENERGY_PER_PHASE = 30;
export const ENERGY_CAP = 100;

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
