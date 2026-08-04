// State-aware Amelia feedback rules.
//
// These rules read live game state and produce contextual mascot
// messages — replacing the old "random text on day N" approach. Each
// rule is a pure function: given a state snapshot it either returns a
// MascotMessage to push or null. The runtime walks the rule list each
// tick and dedupes by message id (the store rejects duplicates).
//
// Tone: each message must explain CAUSE + NEXT ACTION in one or two
// sentences. Never just "uh-oh!" — always tell the player what is
// happening AND what they can do about it.

import type { GameState } from '@/state/store';
import type { MascotMessage } from '@/types';
import { selectComplexity } from '@/engine/complexity';
import { calcDemandToday } from '@/engine/mockEngine';
import { mulberry32, seedFrom } from '@/utils/rng';

interface FeedbackContext {
  state: GameState;
  /** When 0, no message will be pushed. */
  stockoutDays: number;
  overstockDays: number;
}

export interface FeedbackRule {
  key: string;
  /** Must return a message or null. */
  evaluate: (ctx: FeedbackContext) => MascotMessage | null;
}

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────

function bucketedId(prefix: string, day: number, bucket = 5): string {
  return `${prefix}__d${Math.floor(day / bucket)}`;
}

function estimatedDemand(state: GameState): number {
  const seed = state.meta.seed + ':feedback:' + state.meta.day;
  const rand = mulberry32(seedFrom(seed));
  return Math.round(calcDemandToday(state, rand).total);
}

function totalRevenueSoFar(state: GameState): number {
  return state.ledger
    .filter((e) => e.kind === 'revenue')
    .reduce((a, b) => a + b.amount, 0);
}

function totalOpProfitSoFar(state: GameState): number {
  let rev = 0,
    cost = 0;
  for (const e of state.ledger) {
    if (e.kind === 'revenue') rev += e.amount;
    else if (
      e.kind === 'cogs-material' ||
      e.kind === 'cogs-labor' ||
      e.kind === 'cogs-packaging' ||
      e.kind === 'cogs-fulfillment' ||
      e.kind === 'opex-marketing' ||
      e.kind === 'opex-tool'
    )
      cost -= e.amount; // amounts are negative for costs
  }
  return rev - cost;
}

// ──────────────────────────────────────────────────────────────────────
// RULES
// ──────────────────────────────────────────────────────────────────────

const RULES: FeedbackRule[] = [
  // No audience — top priority. Demand is dead until this is fixed.
  // Fires from day 1 so a fresh-start player gets immediate spoken
  // guidance before they even notice the disabled Confirm button.
  {
    key: 'no_audience',
    evaluate: ({ state }) => {
      if (state.market.targetSegment) return null;
      return {
        id: bucketedId('no_audience', state.meta.day),
        type: 'warning',
        priority: 1,
        mood: 'pointing_right_explain',
        body:
          "First move: open Business → Audience and pick a segment. Without a target, demand stays cold because the product has no clear buyer.",
      };
    },
  },

  // Active line has weak fit (<35%) — design / target mismatch.
  {
    key: 'weak_fit',
    evaluate: ({ state }) => {
      const seg = state.market.targetSegment;
      if (!seg) return null;
      const fit =
        state.market.fitBySegmentByLineId[state.portfolio.activeLineId]?.[seg] ?? null;
      if (fit === null || fit >= 0.35) return null;
      return {
        id: bucketedId('weak_fit', state.meta.day, 7),
        type: 'warning',
        priority: 2,
        mood: 'thinking_side',
        body:
          "This notebook does not match your audience well. Try changing type, price, paper quality, or add-ons until fit moves above 50%.",
      };
    },
  },

  // High demand, no stock = lost sales.
  {
    key: 'high_demand_no_stock',
    evaluate: ({ state }) => {
      if (state.meta.day < 5) return null;
      const demand = estimatedDemand(state);
      const finished = state.inventory.totalFinished;
      if (demand < 4 || finished > demand * 0.5) return null;
      return {
        id: bucketedId('high_demand_no_stock', state.meta.day),
        type: 'warning',
        priority: 1,
        mood: 'warning',
        body:
          "Customers want the product but stock is low. You may lose sales unless you produce more - raise Produce / day in Business > Inventory, then confirm the phase.",
      };
    },
  },

  // High stock, low demand = trapped cash.
  {
    key: 'high_stock_low_demand',
    evaluate: ({ state }) => {
      if (state.meta.day < 8) return null;
      const demand = estimatedDemand(state);
      const finished = state.inventory.totalFinished;
      if (finished < 30 || finished < demand * 4) return null;
      return {
        id: bucketedId('high_stock_low_demand', state.meta.day),
        type: 'warning',
        priority: 2,
        mood: 'thinking',
        body:
          "You made more notebooks than customers want. That traps cash in inventory - lower Produce / day until stock drains.",
      };
    },
  },

  // Revenue up but profit lagging.
  {
    key: 'revenue_up_profit_flat',
    evaluate: ({ state }) => {
      if (state.meta.day < 20) return null;
      const rev = totalRevenueSoFar(state);
      const op = totalOpProfitSoFar(state);
      if (rev < 200) return null;
      const margin = op / rev;
      if (margin > 0.15) return null;
      return {
        id: bucketedId('revenue_up_profit_flat', state.meta.day, 10),
        type: 'hint',
        priority: 2,
        mood: 'thinking_side',
        body:
          "Revenue is up but margin is thin. Costs are eating profit - open the P&L and check material, labor, marketing, and tools.",
      };
    },
  },

  // Cash getting tight.
  {
    key: 'cash_tight',
    evaluate: ({ state }) => {
      if (state.meta.day < 4) return null;
      if (state.player.cash >= 100) return null;
      return {
        id: bucketedId('cash_tight', state.meta.day, 4),
        type: 'warning',
        priority: 1,
        mood: 'concerned',
        body:
          "Cash is getting tight. Profit may look fine, but stock and upgrades hit cash first. Pause marketing or ease off Produce / day.",
      };
    },
  },

  // Portfolio overload — too many lines vs capacity.
  {
    key: 'portfolio_overload',
    evaluate: ({ state }) => {
      const c = selectComplexity(state);
      if (c.level !== 'overloaded') return null;
      return {
        id: bucketedId('portfolio_overload', state.meta.day, 10),
        type: 'warning',
        priority: 2,
        mood: 'concerned',
        body:
          "Your product mix is heavier than your production capacity. Some lines will be under-produced. Hire a helper, buy a tool, or drop your weakest line.",
      };
    },
  },

  // Cannibalization — multiple lines fighting for the same audience.
  {
    key: 'cannibalization',
    evaluate: ({ state }) => {
      const seg = state.market.targetSegment;
      if (!seg) return null;
      const lines = state.portfolio.productLines;
      if (lines.length < 2) return null;
      const fitMap = state.market.fitBySegmentByLineId;
      const linesAtSeg = lines.filter((l) => (fitMap[l.id]?.[seg] ?? 0) > 0.5);
      if (linesAtSeg.length < 2) return null;
      return {
        id: bucketedId('cannibalization', state.meta.day, 12),
        type: 'hint',
        priority: 3,
        mood: 'thinking',
        body:
          "Two or more of your lines are aimed at the same audience. They'll compete with each other instead of widening demand. Pick a different segment for one of them.",
      };
    },
  },
];

/**
 * Run all rules against the current state. Returns up to `max`
 * messages, sorted by priority. Designed to be called from a single
 * useEffect and pushed via `pushMascot`.
 */
export function evaluateFeedback(state: GameState, max = 1): MascotMessage[] {
  const ctx: FeedbackContext = {
    state,
    stockoutDays: state.inventory.stockoutDays,
    overstockDays: state.inventory.overstockDays,
  };
  const out: MascotMessage[] = [];
  for (const r of RULES) {
    const m = r.evaluate(ctx);
    if (m) out.push(m);
  }
  out.sort((a, b) => a.priority - b.priority);
  return out.slice(0, max);
}
