// Multi-phase game runner — chains three 30-day phases, carrying inventory,
// cash, and energy, and produces the final P&L + the spec's 50/25/25 score
// preview. Pure + deterministic, so a whole 90-day game can be unit-verified
// without any UI. This is the spine P2 (flow) and P6 (scoring) build on.

import {
  ENERGY_START, ENERGY_PER_PHASE, ENERGY_CAP, ROUTE_START, BASE_MARKET_SHARE,
} from '@/data/finlit';
import { simulatePhase } from './simulate';
import type { FinlitLine, FinlitDecisions, FinlitPhaseResult, Route } from './types';

export interface FinlitGameConfig {
  route: Route;
  /** Starting notebook lines (finished inventory carries across phases). */
  lines: FinlitLine[];
  /** Company decisions per phase (index 0 = phase 1). */
  perPhase: [FinlitDecisions, FinlitDecisions, FinlitDecisions];
  /** Optional per-phase market-share (from shipping/branch decisions). */
  marketSharePerPhase?: [number, number, number];
  /** Insight-question outcomes for the score preview (correct/total). */
  insight?: { correct: number; total: number };
  /** Normaliser for the net-profit sub-score (max expected net $). */
  maxExpectedNetProfit?: number;
}

export interface FinlitGameResult {
  phases: FinlitPhaseResult[];
  cashByPhase: number[];
  endingCash: number;
  totalNetProfit: number; // Σ phase net + investor opening obligation
  cleanliness: number; // 1 − (stockout + overstock) / 90
  marketShare: number; // mean across phases
  score: { total: number; netProfit: number; inventory: number; insight: number };
}

const DEFAULT_MAX_EXPECTED = 20000;

export function runFullGame(cfg: FinlitGameConfig): FinlitGameResult {
  const share = cfg.marketSharePerPhase ?? [BASE_MARKET_SHARE, BASE_MARKET_SHARE, BASE_MARKET_SHARE];
  let lines = cfg.lines.map((l) => ({ ...l }));
  let energy = ENERGY_START;
  let cash = ROUTE_START[cfg.route].cash;
  const opening = ROUTE_START[cfg.route].openingProfit;

  const phases: FinlitPhaseResult[] = [];
  const cashByPhase: number[] = [];
  let stockoutDays = 0;
  let overstockDays = 0;

  for (let phase = 1 as 1 | 2 | 3; phase <= 3; phase = (phase + 1) as 1 | 2 | 3) {
    if (phase > 1) energy = Math.min(ENERGY_CAP, energy + ENERGY_PER_PHASE);
    const decisions = cfg.perPhase[phase - 1];

    const res = simulatePhase(lines, decisions, phase, { marketShare: share[phase - 1] });
    phases.push(res);
    cash += res.netProfit;
    cashByPhase.push(cash);
    stockoutDays += res.stockoutDays;
    overstockDays += res.overstockDays;

    // Carry ending inventory into the next phase.
    const endById = new Map(res.byLine.map((b) => [b.lineId, b.endingInventory]));
    lines = lines.map((l) => ({ ...l, finished: endById.get(l.id) ?? l.finished }));
  }

  const totalNetProfit = phases.reduce((a, p) => a + p.netProfit, 0) + opening;
  const cleanliness = Math.max(0, Math.min(1, 1 - (stockoutDays + overstockDays) / 90));
  const marketShare = phases.reduce((a, p) => a + p.marketShare, 0) / phases.length;

  // Spec score: Net Profit 50 · Inventory Cleanliness 25 · Insight 25.
  const maxExpected = cfg.maxExpectedNetProfit ?? DEFAULT_MAX_EXPECTED;
  const netProfitScore = Math.max(0, Math.min(1, totalNetProfit / maxExpected)) * 50;
  const inventoryScore = cleanliness * 25;
  const insight = cfg.insight ?? { correct: 0, total: 0 };
  const insightScore = insight.total > 0 ? (insight.correct / insight.total) * 25 : 0;
  const total = Math.max(0, Math.min(100, Math.round(netProfitScore + inventoryScore + insightScore)));

  return {
    phases,
    cashByPhase,
    endingCash: cash,
    totalNetProfit,
    cleanliness,
    marketShare,
    score: {
      total,
      netProfit: Math.round(netProfitScore),
      inventory: Math.round(inventoryScore),
      insight: Math.round(insightScore),
    },
  };
}
