// Bridge — maps a FinlitPhaseResult into the store's existing ledger + series
// shapes so the V3 engine drives the V2 P&L / stats UI unchanged. Pure: returns
// plain data (no id/Immer coupling); the store attaches ids + appends.

import type { LedgerEntry } from '@/types';
import type { FinlitPhaseResult } from './types';

export type LedgerDraft = Omit<LedgerEntry, 'id'>;

/**
 * Ledger entries for a completed round, tagged by cause. One set of aggregate
 * entries per round keeps the P&L readable (per-day would flood it) — and there
 * is no day loop to flood it with any more.
 *
 * Previously took `startDay` and stamped `day = startDay + result.days - 1`.
 * Entries are keyed on the round now, so the arithmetic is gone with the field.
 */
export function phaseResultToLedger(result: FinlitPhaseResult, roundNumber: number): LedgerDraft[] {
  const out: LedgerDraft[] = [];
  if (result.revenue > 0) out.push({ roundNumber, kind: 'revenue', amount: round2(result.revenue), cause: 'finlit_sales' });
  if (result.cogs > 0) out.push({ roundNumber, kind: 'cogs-material', amount: -round2(result.cogs), cause: 'finlit_cogs' });
  if (result.channelCost > 0) out.push({ roundNumber, kind: 'opex-rent', amount: -round2(result.channelCost), cause: 'finlit_channel' });
  if (result.opex > 0) out.push({ roundNumber, kind: 'opex-marketing', amount: -round2(result.opex), cause: 'finlit_opex' });
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
