// Engine configuration / balance constants.
// All tunable numbers live here. Keep this small and explainable.
//
// Patterns adopted from the reference Excel sim:
// - Cost-reduction-by-level for upgrades:  cost × (1 − k × level)
// - Working-capital timing via DSO/DPO (channel and supplier)
// - Indirect cash flow: revenue accrues immediately, cash is delayed by DSO
// - P&L groups: Revenue → COGS → Gross Profit → OpEx → Operating Profit

export const STARTING_CAPITAL = { self: 1000, investor: 2500 } as const;
export const INVESTOR_DEBT = 3000;            // payable by Day 90
export const INVESTOR_PENALTY = 15;           // points off if not repaid
export const INVESTOR_BONUS = 5;              // bonus points if repaid

export const PHASE_MAX_ENERGY = { 1: 30, 2: 45, 3: 60 } as const;
export const ENERGY_REPLENISH = 15;

export const PHASE_DEMAND_MULT = { 1: 0.7, 2: 1.0, 3: 1.2 } as const;

// Product economics base costs (per unit, in $)
export const PAPER_COST = { cheap: 0.8, standard: 1.4, premium: 2.4 } as const;
export const COVER_COST = { hardcover: 1.0, leather: 2.6 } as const;
export const BINDING_COST = { ring: 0.4, staple: 0.1 } as const;
export const SIZE_COST_MULT = { s: 0.7, m: 1.0, l: 1.3 } as const;
export const SIZE_TIME_MULT = { s: 0.8, m: 1.0, l: 1.2 } as const;
export const ADDON_COMPLEXITY = 0.05;         // each add-on adds 5% production time
export const PACKAGING_PER_UNIT = 0.15;       // small packaging cost added at sale
export const FULFILLMENT_PER_UNIT = 0.05;     // small fulfillment cost

// Operations
export const BASE_PRODUCTION_CAPACITY = 5;    // units/day at start
export const HIRE_CAPACITY_GAIN = 4;          // per helper
export const HIRE_DAILY_WAGE = 12;            // $/day per helper
export const TOOL_CAPACITY_GAIN: Record<string, number> = {
  basic: 6,
  pro: 12,
};
export const PROCESS_DEFECT_REDUCTION: Record<string, number> = {
  qa: 0.05,
};
export const DEFAULT_DEFECT_RATE = 0.08;

// Channels — cash timing (Days Sales Outstanding) and reach
export const CHANNEL_DSO: Record<string, number> = {
  word_of_mouth: 0,
  campus_booth: 0,
  online: 7,
  influencer: 7,
  student_club: 14,
  campus_store: 30,
};

// Supplier payment terms (Days Payable Outstanding) — 0 = pay on the day
export const SUPPLIER_DPO_DEFAULT = 0;
export const SUPPLIER_DPO_NEGOTIATED = 14;

// Demand
export const DEMAND_TARGET_BONUS = 1.4;       // multiplier when seg is the chosen target
export const DEMAND_NONTARGET = 0.55;         // multiplier when seg is not the target
export const DEMAND_BRAND_MAX_BOOST = 1.5;    // brand 100 → ×1.5

// Pricing factor exponent: 2 - (price/ref)^sensitivity, clamped 0.05..2.0
export const PRICE_FACTOR_MIN = 0.05;
export const PRICE_FACTOR_MAX = 2.0;

// Inventory cleanliness
export const OVERSTOCK_DAYS_COVER = 5;        // > 5d cover → counts as an overstock day

// Raw material baseline cost per unit. Used as a fallback / minimum when the
// finished-good unit cost (paper+cover+binding+addons) under-represents what
// suppliers really charge. The engine actually uses calcUnitCost(s) so the
// player's cash drain matches their COGS — this is just a floor.
export const RAW_UNIT_COST_FLOOR = 1.4;

// Scoring
// MaxExpectedNetProfit baseline used for score normalisation. Tuned to a
// reasonable "well-played" run target. Real engine would compute this from a
// God-Mode policy; for now a constant works.
export const MAX_EXPECTED_NET_PROFIT = 4500;

// Active Days for cleanliness rate calculation
export const ACTIVE_DAYS_TOTAL = 90;

/**
 * Days in one phase. The run is three of these (`ACTIVE_DAYS_TOTAL`).
 *
 * This is the multiplier behind every "per phase" figure the operations
 * screens show. Company decisions — hiring, vendors, channels, marketing and
 * sales budgets — are all priced per DAY in the design sheets, which is the
 * right unit for the engine and the wrong one for a player: choosing a hire
 * tier meant multiplying a $/day cost and a fractional units/day bonus by 30
 * in your head, sixteen times over, before you could compare two candidates.
 */
export const DAYS_PER_PHASE = 30;

// Defect rate cap so it never goes wild
export const MAX_DEFECT_RATE = 0.5;

// Brand caps
export const BRAND_MAX = 100;
export const BRAND_MIN = 0;
