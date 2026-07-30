// Bridge — maps a FinlitPhaseResult into the store's existing ledger + series
// shapes so the V3 engine drives the V2 P&L / stats UI unchanged. Pure: returns
// plain data (no id/Immer coupling); the store attaches ids + appends.

import type { LedgerEntry } from '@/types';
import type { FinlitPhaseResult } from './types';

export type LedgerDraft = Omit<LedgerEntry, 'id'>;

/**
 * Ledger entries for a completed phase, tagged by cause. `startDay` is the
 * phase's first day (1/31/61) so entries land on real day numbers. One set of
 * aggregate entries per phase keeps the P&L readable (per-day would flood it).
 */
export function phaseResultToLedger(result: FinlitPhaseResult, startDay: number): LedgerDraft[] {
  const day = startDay + result.days - 1; // recognised at phase end
  const out: LedgerDraft[] = [];
  if (result.revenue > 0) out.push({ day, kind: 'revenue', amount: round2(result.revenue), cause: 'finlit_sales' });
  if (result.cogs > 0) out.push({ day, kind: 'cogs-material', amount: -round2(result.cogs), cause: 'finlit_cogs' });
  if (result.channelCost > 0) out.push({ day, kind: 'opex-rent', amount: -round2(result.channelCost), cause: 'finlit_channel' });
  if (result.opex > 0) out.push({ day, kind: 'opex-marketing', amount: -round2(result.opex), cause: 'finlit_opex' });
  return out;
}

/** Per-day series values to append to state.series for the phase's 30 days. */
export interface SeriesDeltas {
  revenue: number[];
  profit: number[];
  sold: number[];
  finished: number[];
  demand: number[];
  stockout: number[]; // 1/0 per day
  overstock: number[]; // 1/0 per day
}

export function phaseResultToSeries(result: FinlitPhaseResult): SeriesDeltas {
  return {
    revenue: result.series.map((s) => round2(s.revenue)),
    profit: result.series.map((s) => round2(s.netCash)),
    sold: result.series.map((s) => Math.round(s.sold)),
    finished: result.series.map((s) => Math.round(s.finished)),
    demand: result.series.map((s) => Math.round(s.demandUnits)),
    stockout: result.series.map((s) => (s.stockout ? 1 : 0)),
    overstock: result.series.map((s) => (s.overstock ? 1 : 0)),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
