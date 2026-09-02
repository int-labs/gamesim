// UI-facing selectors. Components import these to read engine-derived data
// without putting business logic inside React.

import type { GameState } from '@/state/store';
import { DAYS_PER_PHASE } from './config';
import { stepMultiplier } from '@/gamesim/impacts';
import type { Phase, Size } from '@/types';

// `selectPhasePnL` / `PhasePnL` / `PhasePnLRow` / `PHASE_RANGE` were DELETED.
//
// Nothing consumed them — `FinanceTable` in MetricsTable.tsx does its own
// bucketing — and they encoded two things that are no longer true: a fixed
// three phases, and day windows ({1:[1,30], 2:[31,60], 3:[61,90]}) used to
// decide which phase a ledger entry belonged to. A phase IS a round now, the
// count follows `config.totalRounds`, and entries carry `roundNumber`.

/** End-of-phase summary used by the Evaluation screen. */
export interface EvaluationSummary {
  phase: Phase;
  fromDay: number;
  toDay: number;
  revenue: number;
  matCost: number;
  labor: number;
  packaging: number;
  fulfillment: number;
  marketing: number;
  tools: number;
  /** V3 channel maintenance + consignment + holding on unsold stock. */
  channel: number;
  cogs: number;
  opex: number;
  grossProfit: number;
  opProfit: number;
  cashStart: number | null;
  cashEnd: number | null;
  unitsSold: number;
  unitsLost: number;
  stockoutDays: number;
  overstockDays: number;
  topCostCause: string | null;
}

export function selectEvaluationSummary(s: GameState, phase: Phase): EvaluationSummary {
  // Day numbers are NARRATIVE only — each round tells the story of
  // DAYS_PER_PHASE days of market movement. They are derived from the phase
  // rather than looked up in a fixed table, so a fourth or fifth round has them
  // too. Nothing buckets by them.
  const from = (phase - 1) * DAYS_PER_PHASE + 1;
  const to = phase * DAYS_PER_PHASE;

  // Entries carry the round they belong to. This used to test a day against a
  // window, which capped the sheet at three phases and depended on a day counter
  // that no longer advances.
  const sumIn = (kinds: string[]) =>
    s.ledger
      .filter((e) => e.roundNumber === phase && kinds.includes(e.kind))
      .reduce((a, b) => a + b.amount, 0);
  const revenue = sumIn(['revenue']);
  const matCost = -sumIn(['cogs-material']);
  const labor = -sumIn(['cogs-labor']);
  const packaging = -sumIn(['cogs-packaging']);
  const fulfill = -sumIn(['cogs-fulfillment']);
  const marketing = -sumIn(['opex-marketing']);
  const tools = -sumIn(['opex-tool']);
  // See the note in selectPhasePnL: `opex-rent` is the V3 channel/holding
  // cost and was missing here too, so the Evaluation screen — the one place
  // the game stops to TEACH why profit moved — reported an Operating Profit
  // that excluded the biggest cost line, then the final score included it.
  const channel = -sumIn(['opex-rent']);
  const cogs = matCost + labor + packaging + fulfill;
  const opex = marketing + tools + channel;
  const grossProfit = revenue - cogs;
  const opProfit = grossProfit - opex;

  // Find biggest cost cause in window (negative ledger entries only)
  const causeTotals = new Map<string, number>();
  for (const e of s.ledger) {
    if (e.roundNumber !== phase) continue;
    if (e.amount >= 0) continue;
    if (e.kind === 'inventory-purchase') continue; // balance sheet, not P&L
    causeTotals.set(e.cause, (causeTotals.get(e.cause) ?? 0) + Math.abs(e.amount));
  }
  const top = [...causeTotals.entries()].sort((a, b) => b[1] - a[1])[0];

  // Slice the cash-series for this phase. Series is 0-indexed by tick (day 2 → index 0).
  const series = s.series.cash;
  const startIdx = Math.max(0, from - 2); // index for from-day
  const endIdx = Math.min(series.length - 1, to - 2);
  const cashStart = startIdx < series.length ? series[Math.max(0, startIdx - 1)] ?? null : null;
  const cashEnd = endIdx >= 0 && endIdx < series.length ? series[endIdx] : null;

  // Per-phase units sold & lost from series snapshots.
  const sold = s.series.sold.slice(Math.max(0, from - 2), Math.max(0, to - 1)).reduce((a, b) => a + b, 0);
  const lost = s.series.stockout.slice(Math.max(0, from - 2), Math.max(0, to - 1)).reduce((a, b) => a + b, 0);

  return {
    phase,
    fromDay: from,
    toDay: to,
    revenue,
    matCost,
    labor,
    packaging,
    fulfillment: fulfill,
    marketing,
    tools,
    channel,
    cogs,
    opex,
    grossProfit,
    opProfit,
    cashStart,
    cashEnd,
    unitsSold: sold,
    unitsLost: lost,
    stockoutDays: s.inventory.stockoutDays,
    overstockDays: s.inventory.overstockDays,
    topCostCause: top ? top[0] : null,
  };
}

/** Compact cash + profit trend slice for the bottom-bar charts. */
export interface CashTrend {
  cash: number[];
  profit: number[];
  revenue: number[];
}

export function selectCashTrend(s: GameState, lastDays?: number): CashTrend {
  const slice = (a: number[]) => (lastDays && lastDays > 0 ? a.slice(-lastDays) : a.slice());
  return {
    cash: slice(s.series.cash),
    profit: slice(s.series.profit),
    revenue: slice(s.series.revenue),
  };
}

/** Current-phase descriptor: phase number + day window + days remaining. */
export interface CurrentPhase {
  phase: Phase;
  day: number;
  fromDay: number;
  toDay: number;
  daysRemaining: number;
  energy: number;
  maxEnergy: number;
  energyPct: number;
}

export function selectCurrentPhase(s: GameState): CurrentPhase {
  const phase = s.meta.phase;
  // Narrative day span for this round, derived rather than table-looked-up so
  // it exists for any round count. `daysRemaining` is a story figure, NOT a
  // timer — the real round clock is `bootstrap.round.timer.endDate`.
  const from = (phase - 1) * DAYS_PER_PHASE + 1;
  const to = phase * DAYS_PER_PHASE;
  return {
    phase,
    day: s.meta.day,
    fromDay: from,
    toDay: to,
    daysRemaining: Math.max(0, to - s.meta.day + 1),
    energy: s.player.energy,
    maxEnergy: s.player.maxEnergy,
    energyPct: s.player.maxEnergy > 0 ? s.player.energy / s.player.maxEnergy : 0,
  };
}

/**
 * The drawn size of a notebook.
 *
 * There are two size fields on a ProductLine and only one of them is real.
 * `line.size` ('s'|'m'|'l') is legacy: it is written once at line creation and
 * no mutator has ever updated it since the old design controls were replaced.
 * The live decision is `finlitSpec.size` ('a5'|'b5'|'b4'), which the Design
 * dropdown writes and which drives production rate and cost.
 *
 * So the canvas was scaling from a field the player could not change — pick B4
 * and the sprite stayed exactly the same. Deriving here makes the FinLit spec
 * the single source of truth for physical size; `line.size` is only a fallback
 * for a line saved before the spec existed.
 *
 * Order is real paper size: A5 (148x210mm) < B5 (176x250mm) < B4 (250x353mm).
 */
const FINLIT_SIZE_TO_SIZE: Record<string, Size> = { a5: 's', b5: 'm', b4: 'l' };

export const lineSize = (line?: { size?: Size; finlitSpec?: { size?: string } }): Size =>
  FINLIT_SIZE_TO_SIZE[line?.finlitSpec?.size ?? ''] ?? line?.size ?? 'm';

// ── Projected cash ────────────────────────────────────────────────────────
//
// How much cash the player would have if they confirmed the phase right now,
// given all current decision selections. Purely subtractive: current cash
// minus the total cost of every active globalInput selection.
//
// This is reactive — any change to globalInputSelections recalculates it.
// Used for display only; actual cash is always s.player.cash after a phase runs.

export interface ProjectedCashResult {
  /** Current cash on hand. */
  current: number;
  /** Estimated cash after paying for all current decision selections. */
  projected: number;
  /** Delta: projected - current (always <= 0). */
  delta: number;
  /** Breakdown of each cost contributing to the delta. */
  breakdown: Array<{ decision: string; cost: number }>;
}

export function selectProjectedCash(s: GameState): ProjectedCashResult {
  const current = s.player.cash;
  const breakdown: Array<{ decision: string; cost: number }> = [];

  // Resolve each selection to its backend item BY ID. This used to match
  // `inp.key === sel.selectedStepKey` — a frontend key match against a field
  // that now holds an options key, so every cost would have silently vanished
  // from the projection. It also required a non-null `selectedStepKey`, which
  // would have dropped binary selections (channels) that legitimately have none.
  for (const sel of s.globalInputSelections) {
    if (!sel.inputId) continue;

    const item = s.availableGlobalInputs
      .flatMap((g) => g.inputs)
      .find((inp) => String(inp._id) === sel.inputId);
    if (!item || item.cost === 0) continue;

    // The step multiplier scales the cost — replacing an invented
    // `item.cost * 2^(level-1)` doubling curve the backend never specified.
    // Through the shared util so this matches the server's own cost partition,
    // including its treatment of a binary item (multiplier 1) and of a stepKey
    // that is not a configured option (0).
    breakdown.push({
      decision: item.label,
      cost: Math.ceil(item.cost * stepMultiplier(item, sel.selectedStepKey)),
    });
  }

  const delta = -breakdown.reduce((sum, b) => sum + b.cost, 0);
  const projected = current + delta;

  return { current, projected, delta, breakdown };
}
