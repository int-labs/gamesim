// UI-facing selectors. Components import these to read engine-derived data
// without putting business logic inside React.

import type { GameState } from '@/state/store';
import { calcDemandToday, calcEffectivePrice, calcUnitCost, calcUnitTime, currentAddOns } from './mockEngine';
import { computeFinalScore, type FinalScore } from './scoring';
import { mulberry32, seedFrom } from '@/utils/rng';
import { totalReceivables, totalPayables } from './cashflow';
import { aggregateActive } from './modifiers';
import type { Phase, Segment, Size } from '@/types';
import { SEGMENTS } from '@/data/segments';
import { GENRES } from '@/data/finlit';

export interface KpiSet {
  cash: number;
  receivables: number;
  payables: number;
  revenue: number;
  opProfit: number;
  finished: number;
  raw: number;
  demandEst: number;
  fitPct: number | null;
  brand: number;
  unitCost: number;
  effectivePrice: number;
  unitTime: number;
}

const sumKind = (s: GameState, kind: string) =>
  s.ledger.filter((e) => e.kind === kind).reduce((a, b) => a + b.amount, 0);

export function selectKpis(s: GameState): KpiSet {
  const grossRevenue = sumKind(s, 'revenue');
  const matCost = -sumKind(s, 'cogs-material');
  const labor = -sumKind(s, 'cogs-labor');
  const marketing = -sumKind(s, 'opex-marketing');
  const tools = -sumKind(s, 'opex-tool');
  const packaging = -sumKind(s, 'cogs-packaging');
  const fulfill = -sumKind(s, 'cogs-fulfillment');
  const channel = -sumKind(s, 'opex-rent'); // V3 channel + holding
  const opProfit = grossRevenue - matCost - labor - marketing - tools - packaging - fulfill - channel;
  const rand = mulberry32(seedFrom(`${s.meta.seed}:preview:${s.meta.day + 1}`));
  const dem = calcDemandToday(s, rand);
  // Best fit across the portfolio for the currently-set lead segment.
  let fit: number | null = null;
  if (s.market.targetSegment) {
    const t = s.market.targetSegment;
    let best = 0;
    for (const lid of Object.keys(s.market.fitBySegmentByLineId)) {
      const f = s.market.fitBySegmentByLineId[lid]?.[t] ?? 0;
      if (f > best) best = f;
    }
    fit = best;
  }
  return {
    cash: s.player.cash,
    receivables: totalReceivables(s.cashSchedule),
    payables: totalPayables(s.cashSchedule),
    revenue: grossRevenue,
    opProfit,
    finished: s.inventory.totalFinished,
    raw: s.inventory.totalRaw,
    demandEst: Math.round(dem.total),
    fitPct: fit !== null ? Math.round(fit * 100) : null,
    brand: Math.round(s.player.brand),
    unitCost: calcUnitCost(s),
    effectivePrice: calcEffectivePrice(s),
    unitTime: calcUnitTime(s),
  };
}

export interface PnLRowData {
  key: string;
  label: string;
  amount: number;
  emphasis?: 'subtotal' | 'highlight';
  positive?: boolean;
  cause: string;
}

export function selectPnL(s: GameState): PnLRowData[] {
  const grossRevenue = sumKind(s, 'revenue');
  const matCost = -sumKind(s, 'cogs-material');
  const packaging = -sumKind(s, 'cogs-packaging');
  const fulfill = -sumKind(s, 'cogs-fulfillment');
  const labor = -sumKind(s, 'cogs-labor');
  const marketing = -sumKind(s, 'opex-marketing');
  const tools = -sumKind(s, 'opex-tool');
  const channel = -sumKind(s, 'opex-rent'); // V3 channel + holding
  const totalCogs = matCost + packaging + fulfill + labor;
  const grossProfit = grossRevenue - totalCogs;
  const totalOpex = marketing + tools + channel;
  const opProfit = grossProfit - totalOpex;

  return [
    { key: 'rev', label: 'Gross Revenue', amount: grossRevenue, positive: true, cause: 'Units sold × effective price.' },
    { key: 'mat', label: 'Material Cost', amount: -matCost, cause: causeMaterial(s) },
    { key: 'pkg', label: 'Packaging Cost', amount: -packaging, cause: 'Per-unit packaging.' },
    { key: 'ful', label: 'Fulfillment Cost', amount: -fulfill, cause: 'Per-unit fulfillment.' },
    { key: 'lab', label: 'Labor Cost', amount: -labor, cause: 'Wages × helpers.' },
    { key: 'gross', label: 'Gross Profit', amount: grossProfit, emphasis: 'subtotal', positive: grossProfit >= 0, cause: 'Revenue − COGS.' },
    { key: 'mkt', label: 'Marketing Spend', amount: -marketing, cause: 'Active campaigns + channel cost.' },
    { key: 'chan', label: 'Channel & Holding', amount: -channel, cause: 'Channel maintenance, consignment fees, carrying cost on unsold stock.' },
    { key: 'tool', label: 'Tools / Upgrades', amount: -tools, cause: 'One-off upgrades, supplier deals, processes.' },
    { key: 'op', label: 'Operating Profit', amount: opProfit, emphasis: 'highlight', positive: opProfit >= 0, cause: 'Gross profit − operating expenses.' },
    { key: 'cash', label: 'Cash Balance', amount: s.player.cash, emphasis: 'highlight', positive: s.player.cash >= 0, cause: 'Cash on hand right now (excludes pending receivables).' },
  ];
}

function causeMaterial(s: GameState) {
  // Look across the whole portfolio — flag the most expensive driver in
  // any line. ("If ANY line uses leather, leather is a story to tell.")
  const lines = s.portfolio.productLines;
  if (lines.some((l) => l.cover === 'leather')) return 'Lifted by leather cover on at least one line (~+1.6×).';
  if (lines.some((l) => l.paperQuality === 'premium')) return 'Lifted by premium paper on at least one line.';
  if (lines.some((l) => l.size === 'l')) return 'Large-size lines scale material per unit.';
  return 'Driven by paper, cover, binding, add-ons.';
}

export interface Warning {
  tone: 'warn' | 'error';
  text: string;
}

/**
 * Phase-windowed P&L. Returns a row per line item with values for Phase 1, 2, 3
 * and Total. Source of truth for the always-visible BottomPnL and the phase
 * evaluation snapshot.
 */
export interface PhasePnL {
  rows: PhasePnLRow[];
  cashByPhase: Record<Phase, number | null>; // cash at *end* of each phase (null if phase not yet reached)
  cashNow: number;
}

export interface PhasePnLRow {
  key: string;
  label: string;
  group: 'revenue' | 'cogs' | 'opex' | 'subtotal';
  emphasis?: 'subtotal' | 'highlight';
  byPhase: Record<Phase, number>;
  total: number;
  cause: string;
}

const PHASE_RANGE: Record<Phase, [number, number]> = {
  1: [1, 30],
  2: [31, 60],
  3: [61, 90],
};

const sumKindForPhase = (s: GameState, kinds: string[], p: Phase) => {
  const [from, to] = PHASE_RANGE[p];
  return s.ledger
    .filter((e) => e.day >= from && e.day <= to && kinds.includes(e.kind))
    .reduce((a, b) => a + b.amount, 0);
};

export function selectPhasePnL(s: GameState): PhasePnL {
  const phases: Phase[] = [1, 2, 3];
  const make = (kinds: string[], invert: boolean) =>
    phases.reduce(
      (acc, p) => {
        const v = sumKindForPhase(s, kinds, p);
        acc[p] = invert ? -v : v; // costs are stored as negatives → flip to positive expense
        return acc;
      },
      { 1: 0, 2: 0, 3: 0 } as Record<Phase, number>,
    );

  const revenue = make(['revenue'], false);
  const material = make(['cogs-material'], true);
  const labor = make(['cogs-labor'], true);
  const packaging = make(['cogs-packaging'], true);
  const fulfill = make(['cogs-fulfillment'], true);
  const marketing = make(['opex-marketing'], true);
  const tools = make(['opex-tool'], true);
  // Channel maintenance + consignment + holding cost on unsold stock. The
  // FinLit bridge books all three as `opex-rent` (engine/finlit/bridge.ts),
  // and this selector used to omit it entirely — so Operating Profit was
  // OVERSTATED by what is very likely the largest cost in the game
  // ($36.50/day of maintenance alone with all three channels stocked,
  // ~$1,095 per phase, against $1,000 of starting cash on the self-funded
  // route). scoring.ts and FinalResultsScreen always counted it, so the
  // phase P&L disagreed with the score the player was actually graded on.
  const channel = make(['opex-rent'], true);

  const totalOf = (r: Record<Phase, number>) => r[1] + r[2] + r[3];

  const grossProfit: Record<Phase, number> = {
    1: revenue[1] - material[1] - labor[1] - packaging[1] - fulfill[1],
    2: revenue[2] - material[2] - labor[2] - packaging[2] - fulfill[2],
    3: revenue[3] - material[3] - labor[3] - packaging[3] - fulfill[3],
  };
  const opProfit: Record<Phase, number> = {
    1: grossProfit[1] - marketing[1] - tools[1] - channel[1],
    2: grossProfit[2] - marketing[2] - tools[2] - channel[2],
    3: grossProfit[3] - marketing[3] - tools[3] - channel[3],
  };

  const phaseReached = (p: Phase) => s.meta.day >= PHASE_RANGE[p][1];
  // Snapshot the cash-series at the end-of-phase day. Series is 1-indexed by tick:
  // series.cash[i] = cash at end of day (i+1) when day starts at 2 (no day-1 tick).
  const cashSeries = s.series.cash;
  const cashAtDay = (day: number) => {
    // dayTick pushes to the series after each tick; dayTick(2) is the first push,
    // so series[0] = cash at end of day 2. series[day - 2] for day >= 2.
    const idx = day - 2;
    if (idx < 0 || idx >= cashSeries.length) return null;
    return cashSeries[idx];
  };
  const cashByPhase: Record<Phase, number | null> = {
    1: phaseReached(1) ? cashAtDay(30) : null,
    2: phaseReached(2) ? cashAtDay(60) : null,
    3: phaseReached(3) ? cashAtDay(90) : null,
  };

  const rows: PhasePnLRow[] = [
    { key: 'rev',  label: 'Gross Revenue',          group: 'revenue', byPhase: revenue,    total: totalOf(revenue),    cause: 'Units sold × effective price.' },
    { key: 'mat',  label: 'Material Cost',          group: 'cogs',    byPhase: material,   total: totalOf(material),   cause: causeMaterial(s) },
    { key: 'lab',  label: 'Labor Cost',             group: 'cogs',    byPhase: labor,      total: totalOf(labor),      cause: 'Wages × helpers.' },
    { key: 'pkg',  label: 'Packaging Cost',         group: 'cogs',    byPhase: packaging,  total: totalOf(packaging),  cause: 'Per-unit packaging on each sale.' },
    { key: 'ful',  label: 'Fulfillment Cost',       group: 'cogs',    byPhase: fulfill,    total: totalOf(fulfill),    cause: 'Per-unit shipping on each sale.' },
    { key: 'gp',   label: 'Gross Profit',           group: 'subtotal', emphasis: 'subtotal',  byPhase: grossProfit, total: totalOf(grossProfit), cause: 'Revenue − all COGS.' },
    { key: 'mkt',  label: 'Marketing / Ops',        group: 'opex',    byPhase: marketing,  total: totalOf(marketing),  cause: 'Marketing team, sales spend and hiring cost.' },
    { key: 'chan', label: 'Channel & Holding',      group: 'opex',    byPhase: channel,    total: totalOf(channel),    cause: 'Channel maintenance + consignment fees + carrying cost on unsold stock.' },
    { key: 'tool', label: 'Tools / Upgrades',       group: 'opex',    byPhase: tools,      total: totalOf(tools),      cause: 'One-off upgrades & supplier deals.' },
    { key: 'op',   label: 'Operating Profit',       group: 'subtotal', emphasis: 'highlight', byPhase: opProfit, total: totalOf(opProfit), cause: 'Gross profit − OpEx.' },
  ];
  return { rows, cashByPhase, cashNow: s.player.cash };
}

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
  const [from, to] = PHASE_RANGE[phase];
  const inPhase = (day: number) => day >= from && day <= to;
  const sumIn = (kinds: string[]) =>
    s.ledger.filter((e) => inPhase(e.day) && kinds.includes(e.kind)).reduce((a, b) => a + b.amount, 0);
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
    if (!inPhase(e.day)) continue;
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

/** Compact inventory trend slice. */
export interface InventoryTrend {
  finished: number[];
  raw: number[];
  demand: number[];
  sold: number[];
  stockout: number[];
}

export function selectInventoryTrend(s: GameState, lastDays?: number): InventoryTrend {
  const slice = (a: number[]) => (lastDays && lastDays > 0 ? a.slice(-lastDays) : a.slice());
  return {
    finished: slice(s.series.finished),
    raw: slice(s.series.raw),
    demand: slice(s.series.demand),
    sold: slice(s.series.sold),
    stockout: slice(s.series.stockout),
  };
}

/** Final-score selector. Just delegates to scoring.computeFinalScore. */
export function selectFinalScore(s: GameState): FinalScore {
  return computeFinalScore(s);
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
  const [from, to] = PHASE_RANGE[phase];
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

/** Product summary used by side panels and tooltips. */
export interface ProductSummary {
  archetype: string;
  cover: string;
  binding: string;
  size: string;
  paperQuality: string;
  price: number;
  effectivePrice: number;
  unitCost: number;
  unitTime: number;
  unitProfit: number;
  marginPct: number;
  addOnCount: number;
  fitBySegment: Record<Segment, number>;
  topFit: { segment: Segment; fit: number };
  targetFit: number | null;
}

/**
 * Product summary for the ACTIVE line. (UI components that need details
 * about the line being edited use this; portfolio summaries iterate the
 * `productLines` array directly.)
 */
export function selectProductSummary(s: GameState): ProductSummary {
  const unitCost = calcUnitCost(s);
  const effectivePrice = calcEffectivePrice(s);
  const unitProfit = effectivePrice - unitCost;
  const marginPct = effectivePrice > 0 ? unitProfit / effectivePrice : 0;
  const activeLine = s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
    ?? s.portfolio.productLines[0];
  const lineFit = s.market.fitBySegmentByLineId[activeLine?.id ?? ''] ?? { students: 0, creators: 0, professionals: 0, gift: 0 };
  const fitBySegment = { ...lineFit };
  let topFit: { segment: Segment; fit: number } = { segment: SEGMENTS[0].id, fit: 0 };
  for (const seg of SEGMENTS) {
    if (fitBySegment[seg.id] > topFit.fit) topFit = { segment: seg.id, fit: fitBySegment[seg.id] };
  }
  return {
    archetype: activeLine?.archetype ?? GENRES[0].id,
    cover: activeLine?.cover ?? 'hardcover',
    binding: activeLine?.binding ?? 'ring',
    size: lineSize(activeLine),
    paperQuality: activeLine?.paperQuality ?? 'standard',
    price: activeLine?.price ?? 8,
    effectivePrice,
    unitCost,
    unitTime: calcUnitTime(s),
    unitProfit,
    marginPct,
    addOnCount: currentAddOns(s).length,
    fitBySegment,
    topFit,
    targetFit: activeLine?.targetSegment ? fitBySegment[activeLine.targetSegment] : null,
  };
}

export function selectWarnings(s: GameState): Warning[] {
  const k = selectKpis(s);
  const out: Warning[] = [];
  if (!s.market.targetSegment) out.push({ tone: 'warn', text: 'No target audience yet - demand stays weak.' });
  if (k.cash < 100) out.push({ tone: 'error', text: 'Cash low - pause marketing or batch buys.' });
  if (k.finished === 0 && s.meta.day > 4) out.push({ tone: 'error', text: 'No finished goods - set Produce / day in Business > Inventory, then confirm the phase.' });
  if (k.demandEst > k.finished * 1.4 && k.finished > 0) out.push({ tone: 'warn', text: 'Demand outpacing stock - risk of stockout.' });
  if (k.finished > 5 * Math.max(4, k.demandEst)) out.push({ tone: 'warn', text: 'Stock piling up - overstock traps cash.' });
  if (k.fitPct !== null && k.fitPct < 40) out.push({ tone: 'warn', text: 'Weak segment fit - design and target mismatched.' });
  const mods = aggregateActive(s.activeModifiers);
  if (mods.materialCostMult > 1.05) out.push({ tone: 'warn', text: `Material cost spike (×${mods.materialCostMult.toFixed(2)}) is active.` });
  if (mods.demandMult < 0.95) out.push({ tone: 'warn', text: `Demand modifier active (×${mods.demandMult.toFixed(2)}).` });
  if (s.cashSchedule.length > 0) {
    const ar = totalReceivables(s.cashSchedule);
    if (ar > 100) out.push({ tone: 'warn', text: `$${Math.round(ar)} in receivables - cash is delayed by channel terms.` });
  }
  return out;
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
