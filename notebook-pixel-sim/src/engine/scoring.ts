// Final scoring.
// Three sub-scores out of 100 total:
//   1. Net Profit (50 pts)         — profit / max-expected, clamped 0..1
//   2. Inventory Cleanliness (25)  — 1 - (stockoutRate + overstockRate)
//   3. Insight Bonus (25)          — correct / total
//
// The three sub-scores are the whole rubric. There is no route modifier: the
// funding-route choice, its repayment obligation and its ×1.1 multiplier were
// removed along with the mechanic.

import type { GameState } from '@/state/store';
import {
  ACTIVE_DAYS_TOTAL,
  MAX_EXPECTED_NET_PROFIT,
} from './config';

export interface FinalScore {
  total: number;       // 0..100
  netProfit: number;   // 0..50
  inventory: number;   // 0..25
  insight: number;     // 0..25
  netDollar: number;   // raw net profit
  cleanliness: number; // 0..1
}

/**
 * Net profit = Σ P&L ledger amounts (revenue positive, costs negative).
 *
 * Excludes balance-sheet entries that are NOT P&L:
 *   - `inventory-purchase` (buying raw is an asset swap, recognised as COGS at sale)
 *   - `cash-in` / `cash-out` (liquidity events; AR/AP draining)
 *
 * Including those would double-count material cost (paid via `inventory-purchase`,
 * recognised again via `cogs-material` at sale time).
 */
function computeNetProfit(state: GameState): number {
  return state.ledger.reduce((sum, e) => {
    if (e.kind === 'inventory-purchase') return sum;
    if (e.kind === 'cash-in' || e.kind === 'cash-out') return sum;
    return sum + e.amount;
  }, 0);
}

function computeCleanliness(state: GameState): number {
  const days = Math.max(1, Math.min(ACTIVE_DAYS_TOTAL, state.meta.day));
  const stockoutRate = clamp(state.inventory.stockoutDays / days, 0, 1);
  const overstockRate = clamp(state.inventory.overstockDays / days, 0, 1);
  return clamp(1 - (stockoutRate + overstockRate), 0, 1);
}

export function computeFinalScore(state: GameState): FinalScore {
  const netDollar = computeNetProfit(state);
  const profitNorm = clamp(netDollar / MAX_EXPECTED_NET_PROFIT, 0, 1);
  const netProfitScore = profitNorm * 50;

  const cleanliness = computeCleanliness(state);
  const inventoryScore = cleanliness * 25;

  // From `answered`, the run-long history — NOT `score`, which is reset every
  // round now that its value is submitted per round on `Decision.clientMetrics`.
  // Reading `score` here would band the final rubric on the LAST round alone.
  const total = state.insights.answered.length;
  const correct = state.insights.answered.filter((a) => a.correct).length;
  const insightScore = total > 0 ? (correct / total) * 25 : 0;

  let raw = netProfitScore + inventoryScore + insightScore;
  raw = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    total: raw,
    netProfit: Math.round(netProfitScore),
    inventory: Math.round(inventoryScore),
    insight: Math.round(insightScore),
    netDollar: Math.round(netDollar),
    cleanliness,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
