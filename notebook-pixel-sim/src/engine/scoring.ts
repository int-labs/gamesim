// Final scoring.
// Three sub-scores out of 100 total:
//   1. Net Profit (50 pts)         — profit / max-expected, clamped 0..1
//   2. Inventory Cleanliness (25)  — 1 - (stockoutRate + overstockRate)
//   3. Insight Bonus (25)          — correct / total
//
// Investor route: penalty if obligation not met by Day 90; small bonus if met.

import type { GameState } from '@/state/store';
import {
  ACTIVE_DAYS_TOTAL,
  INVESTOR_BONUS,
  INVESTOR_PENALTY,
  MAX_EXPECTED_NET_PROFIT,
} from './config';
import { totalReceivables } from './cashflow';

export interface FinalScore {
  total: number;       // 0..100
  netProfit: number;   // 0..50
  inventory: number;   // 0..25
  insight: number;     // 0..25
  netDollar: number;   // raw net profit
  cleanliness: number; // 0..1
  routePenalty: number;
  routeBonus: number;
  obligationMet: boolean | null;
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
export function computeNetProfit(state: GameState): number {
  return state.ledger.reduce((sum, e) => {
    if (e.kind === 'inventory-purchase') return sum;
    if (e.kind === 'cash-in' || e.kind === 'cash-out') return sum;
    return sum + e.amount;
  }, 0);
}

export function computeCleanliness(state: GameState): number {
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

  const total = state.insights.score.total;
  const correct = state.insights.score.correct;
  const insightScore = total > 0 ? (correct / total) * 25 : 0;

  let routePenalty = 0;
  let routeBonus = 0;
  let obligationMet: boolean | null = null;
  if (state.meta.route === 'investor') {
    // Did the player effectively cover the $3000 obligation?
    // Reasonable proxy: cash + receivables - investor debt remaining ≥ 0.
    const liquid = state.player.cash + totalReceivables(state.cashSchedule);
    const obligationStanding = state.player.debt - liquid;
    obligationMet = obligationStanding <= 0;
    if (obligationMet) routeBonus = INVESTOR_BONUS;
    else routePenalty = INVESTOR_PENALTY;
  }

  let raw = netProfitScore + inventoryScore + insightScore + routeBonus - routePenalty;
  raw = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    total: raw,
    netProfit: Math.round(netProfitScore),
    inventory: Math.round(inventoryScore),
    insight: Math.round(insightScore),
    netDollar: Math.round(netDollar),
    cleanliness,
    routePenalty,
    routeBonus,
    obligationMet,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
