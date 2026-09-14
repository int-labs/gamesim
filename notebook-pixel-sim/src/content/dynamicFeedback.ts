// State-aware Amelia feedback rules.
//
// These rules read live game state and produce contextual mascot
// messages â€” replacing the old "random text on day N" approach. Each
// rule is a pure function: given a state snapshot it either returns a
// MascotMessage to push or null. The runtime walks the rule list each
// tick and dedupes by message id (the store rejects duplicates).
//
// Tone: each message must explain CAUSE + NEXT ACTION in one or two
// sentences. Never just "uh-oh!" â€” always tell the player what is
// happening AND what they can do about it.

import type { GameState } from '@/state/store';
import type { MascotMessage } from '@/types';
import { selectComplexity } from '@/engine/complexity';

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function bucketedId(prefix: string, day: number, bucket = 5): string {
  return `${prefix}__d${Math.floor(day / bucket)}`;
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RULES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RULES: FeedbackRule[] = [
  // `no_audience` and `weak_fit` were DELETED here on 2026-09-14 with the V2
  // segment axis. Both read `market.targetSegment` / `fitBySegmentByLineId`.

  // Two rules — `high_demand_no_stock` and `high_stock_low_demand` — were
  // DELETED here on 2026-09-09 with the local demand engine they depended on.
  // Both compared `inventory.totalFinished` (no writer) against a client-side
  // demand estimate, behind a `meta.day` gate that never opened in phase 1.

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
          "Cash is getting tight. Profit may look fine, but stock and upgrades hit cash first. Pause marketing or ease off Produce / phase.",
      };
    },
  },

  // Portfolio overload â€” too many lines vs capacity.
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

  // `cannibalization` was DELETED here on 2026-09-14 with the V2 segment axis.
  // "Two lines aimed at the same audience" has no subject without segments.
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
