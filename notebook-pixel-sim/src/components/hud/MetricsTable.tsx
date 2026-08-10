import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { A } from '@/assets';
import { fmt$, fmtInt } from '@/utils/format';
import { CountUp } from '@/components/primitives/CountUp';
import type { LedgerEntry, ProductLine } from '@/types';
import {
  GENRES, prodPerDay, unitCost as finlitUnitCost, customersPer30dFor,
  genreDemand, GAME_PHASE_TO_DEMAND, DEMAND_SCALE, hireLevel,
  salesSellBonus, marketingDemandMult,
  type GenreId, type ChannelId, type ProductionSpec,
} from '@/data/finlit';
import { vocFit } from '@/engine/finlit/fit';

/** Build the full FinLit production spec for a line (overrides on defaults,
 *  type follows genre) — the single source both stats panels read from. */
function finlitSpecOf(line: ProductLine): ProductionSpec {
  const genre: GenreId = line.genre ?? 'indie';
  return {
    type: line.finlitSpec?.type ?? genre,
    paper: line.finlitSpec?.paper ?? 'cream',
    size: line.finlitSpec?.size ?? 'a5',
    pageDesign: line.finlitSpec?.pageDesign ?? 'lined',
    addon: line.finlitSpec?.addon ?? 'bookmark',
    cover: line.finlitSpec?.cover ?? 'plastic',
  };
}

/**
 * The single home for every number the sim shows the player, rendered as
 * REAL TABLES in the classic P&L style and presented by `BottomStats` as
 * paper documents below the canvas:
 *
 *   • FinanceTable      — the phase-windowed P&L (Line item · P1 · P2 · P3 ·
 *                         Total) with a unique icon per line item.
 *   • NotebookMetrics   — the active line's live impact (icon'd KV table).
 *   • PortfolioMetrics  — the all-notebooks rollup, same treatment.
 *
 * Parent/group rows carry the icon; child rows indent with a left gap; +/-
 * tones mirror the finance palette. Values count up; rows stagger in.
 */

type Tone =
  | 'neutral' | 'success' | 'warn' | 'danger' | 'info'
  | 'revenue' | 'cost' | 'profit' | 'cash';

const toneText: Record<Tone, string> = {
  neutral: 'text-text',
  success: 'text-success',
  warn: 'text-warning',
  danger: 'text-danger',
  info: 'text-text',
  revenue: 'text-fin-revenue',
  cost: 'text-fin-cost',
  profit: 'text-fin-profit',
  cash: 'text-fin-cash',
};

/**
 * BottomStats — the stats & P&L as DOCUMENTS ON A DESK. Scrolling down the
 * page reveals three paper sheets (Active Notebook, Portfolio, P&L) that
 * LIFT off the desk as they enter view — rising, straightening from a
 * scattered tilt, each held down by tape strips — like picking up paperwork
 * to read it. `id="stats-section"` is the scroll anchor for the canvas
 * "Stats ↓" chip. Reduced-motion renders everything settled instantly.
 */
export function BottomStats() {
  return (
    <section
      id="stats-section"
      aria-label="Stats and profit &amp; loss"
      className="relative shrink-0 px-3 sm:px-8 pt-8 pb-16 overflow-hidden"
    >
      {/* Desk dressing — faint scattered blank sheets behind the documents. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[6%] top-24 w-64 h-44 bg-cream-100/[0.05] border border-cream-100/10 -rotate-6" />
        <div className="absolute right-[8%] top-16 w-72 h-48 bg-cream-100/[0.05] border border-cream-100/10 rotate-3" />
        <div className="absolute left-[38%] bottom-10 w-80 h-40 bg-cream-100/[0.04] border border-cream-100/10 rotate-1" />
      </div>

      <header className="relative flex items-center gap-2.5 mb-6">
        <span className="inline-flex items-center justify-center w-9 h-9 border border-cream-100/25 bg-black/25">
          <img src={A.ui.sidebar.metrics} alt="" className="w-6 h-6 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
        </span>
        <div className="min-w-0">
          <div className="pixel-caption text-cream-100">Stats &amp; P&amp;L</div>
          <div className="body-xs font-medium text-cream-100/80 hidden md:block mt-1">
            Your paperwork - the active notebook, the whole portfolio, and the run's finances
          </div>
        </div>
      </header>

      <div className="relative grid gap-5 lg:grid-cols-2 mb-6 items-start">
        <PaperSheet title="Active Notebook" icon={A.ui.sidebar.product} tilt={-0.6}>
          <NotebookMetrics />
        </PaperSheet>
        <PaperSheet title="Portfolio" icon={A.ui.sidebar.metrics} tilt={0.5} delay={0.08}>
          <PortfolioMetrics />
        </PaperSheet>
      </div>
      <PaperSheet title="Profit & Loss · by phase" icon={A.ui.pnl.operating_profit} tilt={0.35} delay={0.05} className="relative">
        <FinanceTable />
      </PaperSheet>
    </section>
  );
}

/**
 * PaperSheet - a document lying on the desk: taped at the top corners, at a
 * slight scattered tilt, that LIFTS into reading position (rises + settles
 * nearly straight) when scrolled into view.
 */
function PaperSheet({
  title,
  icon,
  tilt = 0,
  delay = 0,
  className,
  children,
}: {
  title: string;
  icon: string;
  tilt?: number;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 56, rotate: tilt * 4, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      // Hovering a sheet lifts it slightly and straightens it - like
      // picking the page up to read.
      whileHover={reduced ? undefined : { y: -4, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 190, damping: 24, delay }}
      className={clsx('relative', className)}
    >
      {/* Tape strips holding the sheet to the desk. */}
      <span aria-hidden className="absolute -top-2 left-7 w-14 h-4 -rotate-3 bg-[#E9E0C8]/90 border border-black/20 shadow-[1px_1px_0_0_rgba(0,0,0,0.25)] z-10" />
      <span aria-hidden className="absolute -top-2 right-7 w-14 h-4 rotate-2 bg-[#E9E0C8]/90 border border-black/20 shadow-[1px_1px_0_0_rgba(0,0,0,0.25)] z-10" />

      <div className="panel-frame bg-surface px-3 pt-3 pb-3">
        <div className="flex items-center gap-2 pb-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 border border-border-soft bg-surface-2 shrink-0">
            <img src={icon} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
          </span>
          <span className="eyebrow eyebrow-sm text-text truncate">{title}</span>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

/* ── Key-value table renderer (Notebook / Portfolio sheets) ───────────── */

interface KVRow {
  key: string;
  label: string;
  /** Static formatted value (used when `num` is absent). */
  value?: string;
  /** Numeric value → animated count-up (needs `format`). */
  num?: number;
  format?: (n: number) => string;
  tone?: Tone;
  sub?: string;
  emphasis?: 'subtotal' | 'highlight';
}
interface KVGroup {
  key: string;
  icon: string;
  title: string;
  total?: string;
  totalTone?: Tone;
  rows: KVRow[];
}

function KVTable({ groups }: { groups: KVGroup[] }) {
  const reduced = useReducedMotion();
  let rowIdx = 0;
  return (
    // Thin border only - the PaperSheet wrapper provides the heavy frame.
    <div className="border border-border-soft bg-surface overflow-hidden">
      <table className="w-full border-collapse body-xs">
        {groups.map((g, gi) => (
          <tbody key={g.key} className={clsx(gi > 0 && 'border-t border-border-soft')}>
            {/* GROUP header - a clear SECTION divider: small caps, heavy,
                strong ink. Deliberately smaller than the row values below it
                so the data reads as the loudest thing. */}
            <tr className="bg-surface-2/80">
              <th className="text-left stat-label text-text-2 px-2.5 py-1.5">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 border border-border-soft bg-surface shrink-0">
                    <img src={g.icon} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                  </span>
                  {g.title}
                </span>
              </th>
              <th className={clsx('text-right px-2.5 py-1.5 num-xs', toneText[g.totalTone ?? 'neutral'])}>
                {g.total ?? ''}
              </th>
            </tr>
            {/* CHILD rows - LABEL (medium) · VALUE (big, bold, coloured) ·
                SUB (small, light, muted). Three clearly distinct levels. */}
            {g.rows.map((r) => {
              const delay = reduced ? 0 : rowIdx++ * 0.028;
              return (
                <motion.tr
                  key={r.key}
                  initial={reduced ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay, ease: [0.2, 1, 0.4, 1] }}
                  className={clsx(
                    'border-t border-border-soft/40 hover:bg-surface-2/60 transition-colors',
                    r.emphasis === 'highlight' && 'bg-surface-2',
                    r.emphasis === 'subtotal' && 'bg-surface-2/40',
                  )}
                >
                  <td className="pl-10 pr-2.5 py-2 align-middle">
                    <div className={clsx('leading-tight truncate body-xs', r.emphasis ? 'item-name text-text' : 'text-text-2')}>
                      {r.label}
                    </div>
                    {r.sub && <div className="hint font-medium text-text-3 leading-tight truncate mt-0.5">{r.sub}</div>}
                  </td>
                  <td className={clsx('px-2.5 py-2 text-right align-middle num-sm whitespace-nowrap w-[120px]', toneText[r.tone ?? 'neutral'])}>
                    {r.num !== undefined && r.format ? <CountUp value={r.num} format={r.format} /> : r.value}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function EmptyMetrics({ text }: { text: string }) {
  return (
    <div className="border border-border-soft bg-surface p-6 text-center">
      <div className="body-xs text-text-2">{text}</div>
    </div>
  );
}

/* ── Notebook tab (active line impact) ───────────────────────────────── */

function NotebookMetrics() {
  const hasNotebook = useGame((s) => s.portfolio.productLines.length > 0);
  const line = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
  const finished = useGame((s) => s.inventory.totalFinished);
  const phase = useGame((s) => s.meta.phase);
  const hire = useGame((s) => s.finlit.hire);
  const marketingBudget = useGame((s) => s.finlit.marketingBudget);
  const salesBudget = useGame((s) => s.finlit.salesBudget);

  if (!hasNotebook || !line) return <EmptyMetrics text="No notebook selected. Open Notebook Items to add one." />;

  // Everything here reads from the V3 FinLit model - the same engine that
  // actually runs the phase - so this panel agrees with the top-bar VoC pill
  // and the design controls (the legacy segment-fit / demand-est shown two
  // conflicting numbers because they came from the old V2 engine).
  const genre: GenreId = line.genre ?? 'indie';
  const spec = finlitSpecOf(line);
  const channels = new Set<ChannelId>((line.channels ?? ['offline']) as ChannelId[]);
  const price = line.price;
  const capacity = prodPerDay(spec, 0);
  const uCost = finlitUnitCost(spec);
  const margin = price > 0 ? (price - uCost) / price : 0;
  const marginPct = Math.round(margin * 100);

  // FinLit demand/day - used only for the stock-warning tone (not shown as a
  // row). Same math as the top pill: genre curve × VoC fit × channels.
  const sellBonus =
    (hire ? hireLevel(hire.candidate, hire.level).sellBonus : 0) +
    salesSellBonus(salesBudget);
  const demandCurve = genreDemand(genre, GAME_PHASE_TO_DEMAND[phase]);
  const fit = vocFit(spec, price, [...channels], genre);
  let demand30d = 0;
  for (const ch of channels) demand30d += customersPer30dFor(genre, ch, demandCurve, sellBonus);
  const demandPerDay = (demand30d * fit * marketingDemandMult(marketingBudget) * DEMAND_SCALE) / 30;

  const produceTarget = line.targetPerDay ?? Math.ceil(capacity);
  const genreName = GENRES.find((g) => g.id === genre)?.name ?? genre;

  const marginTone: Tone = margin >= 0.4 ? 'success' : margin >= 0.15 ? 'info' : 'warn';
  const stockTone: Tone = finished === 0 ? 'danger' : finished < demandPerDay ? 'warn' : 'neutral';

  const groups: KVGroup[] = [
    {
      key: 'market',
      icon: A.ui.metrics.demand,
      title: 'Market',
      rows: [
        { key: 'genre', label: 'Genre', value: genreName, tone: 'info' },
        { key: 'channels', label: 'Channels live', value: `${channels.size}/3`, tone: channels.size === 0 ? 'warn' : 'neutral' },
      ],
    },
    {
      key: 'pricing',
      icon: A.ui.pnl.operating_profit,
      title: 'Pricing & Margin',
      rows: [
        { key: 'price', label: 'Price', num: price, format: fmt$, tone: 'neutral' },
        { key: 'unit', label: 'Unit cost', num: uCost, format: fmt$, tone: uCost > price * 0.7 ? 'warn' : 'neutral', sub: 'per notebook' },
        { key: 'margin', label: 'Margin', value: `${marginPct}%`, tone: marginTone },
      ],
    },
    {
      key: 'stock',
      icon: A.ui.metrics.inventory,
      title: 'Inventory',
      rows: [
        { key: 'onhand', label: 'Stock on hand', num: finished, format: fmtInt, tone: stockTone, sub: finished === 0 ? 'Confirm the phase to produce' : finished < demandPerDay ? 'Running lean vs demand' : 'Comfortable vs demand' },
        { key: 'target', label: 'Produce target', value: `~${fmtInt(produceTarget)}/day`, tone: 'neutral', sub: `capacity ~${capacity.toFixed(1)}/day` },
      ],
    },
  ];

  return <KVTable groups={groups} />;
}

/* ── Finance tab - the classic phase-windowed P&L TABLE, with icons ───── */

type RowEmphasis = 'normal' | 'subtotal' | 'highlight';
interface PnLRow {
  label: string;
  icon: string;
  kinds: LedgerEntry['kind'][];
  sign: 'plus' | 'minus';
  emphasis?: RowEmphasis;
  computed?: 'gross-profit' | 'op-profit' | 'cash';
  cause: string;
  group: 'revenue' | 'cost' | 'profit' | 'cash';
}

const PNL_ROWS: PnLRow[] = [
  { label: 'Gross Revenue',        icon: A.ui.pnl.gross_revenue,    kinds: ['revenue'],       sign: 'plus',  group: 'revenue', cause: 'Units sold × price' },
  { label: 'Material Cost',        icon: A.ui.pnl.material_cost,    kinds: ['cogs-material'], sign: 'minus', group: 'cost',    cause: 'Paper, cover, binding, add-ons' },
  { label: 'Labor Cost',           icon: A.ui.pnl.labor_cost,       kinds: ['cogs-labor'],    sign: 'minus', group: 'cost',    cause: 'Daily wages × hires' },
  { label: 'Marketing / Ops',      icon: A.ui.pnl.marketing_spend,  kinds: ['opex-marketing'],sign: 'minus', group: 'cost',    cause: 'Marketing team + hiring daily cost' },
  { label: 'Channel & Holding',    icon: A.ui.pnl.fulfillment_cost, kinds: ['opex-rent'],     sign: 'minus', group: 'cost',    cause: 'Channel maintenance + consignment + unsold-stock holding' },
  { label: 'Packaging / Fulfill.', icon: A.ui.pnl.packaging_cost,   kinds: ['cogs-packaging','cogs-fulfillment'], sign: 'minus', group: 'cost', cause: 'Per-unit packaging + shipping' },
  { label: 'Tools / Upgrades',     icon: A.ui.sidebar.studio,       kinds: ['opex-tool'],     sign: 'minus', group: 'cost',    cause: 'One-off equipment, supplier deals' },
  { label: 'Gross Profit',         icon: A.ui.metrics.profit,       kinds: [], sign: 'plus', emphasis: 'subtotal',  computed: 'gross-profit', group: 'profit', cause: 'Revenue minus all COGS' },
  { label: 'Operating Profit',     icon: A.ui.pnl.operating_profit, kinds: [], sign: 'plus', emphasis: 'highlight', computed: 'op-profit',    group: 'profit', cause: 'Gross profit minus operating expenses' },
  { label: 'Cash Balance',         icon: A.ui.pnl.net_revenue,      kinds: [], sign: 'plus', emphasis: 'highlight', computed: 'cash',         group: 'cash',   cause: 'Cash on hand right now (timing-aware)' },
];

export function FinanceTable() {
  const ledger = useGame((s) => s.ledger);
  const cash = useGame((s) => s.player.cash);
  const phaseNow = useGame((s) => s.meta.phase);
  const reduced = useReducedMotion();

  // Bucket ledger entries by phase - identical math to the old BottomPnL.
  const byPhase: Record<1 | 2 | 3, Record<string, number>> = { 1: {}, 2: {}, 3: {} };
  for (const e of ledger) {
    const p = e.day <= 30 ? 1 : e.day <= 60 ? 2 : 3;
    byPhase[p][e.kind] = (byPhase[p][e.kind] ?? 0) + e.amount;
  }
  const sumKindForPhase = (kinds: string[], p: 1 | 2 | 3) =>
    kinds.reduce((a, k) => a + (byPhase[p][k] ?? 0), 0);
  const sumKindAll = (kinds: string[]) =>
    sumKindForPhase(kinds, 1) + sumKindForPhase(kinds, 2) + sumKindForPhase(kinds, 3);

  const computeRow = (r: PnLRow, p: 1 | 2 | 3 | 'total'): number | null => {
    if (r.computed === 'cash') return p === 'total' ? cash : null;
    if (r.computed === 'gross-profit') {
      const get = (ph: 1 | 2 | 3) =>
        sumKindForPhase(['revenue'], ph) +
        sumKindForPhase(['cogs-material', 'cogs-packaging', 'cogs-fulfillment', 'cogs-labor'], ph);
      return p === 'total' ? get(1) + get(2) + get(3) : get(p);
    }
    if (r.computed === 'op-profit') {
      const get = (ph: 1 | 2 | 3) =>
        sumKindForPhase(['revenue'], ph) +
        sumKindForPhase(
          ['cogs-material','cogs-labor','cogs-packaging','cogs-fulfillment','opex-marketing','opex-rent','opex-tool'],
          ph,
        );
      return p === 'total' ? get(1) + get(2) + get(3) : get(p);
    }
    const raw = p === 'total' ? sumKindAll(r.kinds) : sumKindForPhase(r.kinds, p);
    if (r.sign === 'minus') return -raw; // ledger costs are negative; show as positive expense
    return raw;
  };

  return (
    // Thin border only - the PaperSheet wrapper provides the heavy frame.
    <div className="border border-border-soft bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[520px]">
          <thead>
            {/* The live phase column is marked in the header rather than left
                to the reader to work out from the day counter. */}
            <tr className="bg-cream-200 border-b border-border-soft">
              <th className="stat-label text-left py-2.5 pl-3 pr-2">Line item</th>
              {([1, 2, 3] as const).map((p) => (
                // "You are here" is a COLUMN marker, so it reads as a rule
                // under the heading, the way a selected tab does — not as a
                // filled cell. The fill was `bg-info-soft`, a lavender block
                // dropped into a table of warm creams and browns, and it
                // highlighted one header cell rather than the column it names.
                // The trailing "·" is gone with it: a stray dot after "P1" is
                // not a legend anyone can read.
                <th
                  key={p}
                  aria-current={phaseNow === p ? 'true' : undefined}
                  className={clsx(
                    'eyebrow eyebrow-sm text-right py-2.5 px-2 w-[78px] border-b-4',
                    phaseNow === p
                      ? 'eyebrow-strong border-primary bg-cream-100'
                      : 'eyebrow-muted border-transparent',
                  )}
                >
                  {`P${p}`}
                </th>
              ))}
              <th className="stat-label text-text text-right py-2.5 pl-2 pr-3 w-[92px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {PNL_ROWS
              // Hide cost lines that are $0 across the whole run (the V2 rows -
              // labor / packaging / tools - are always 0 in the V3 economy).
              .filter((r) => r.group !== 'cost' || Math.abs(computeRow(r, 'total') ?? 0) > 0.005)
              .map((r, i, arr) => {
              const values = {
                p1: computeRow(r, 1),
                p2: computeRow(r, 2),
                p3: computeRow(r, 3),
                total: computeRow(r, 'total'),
              };
              const emphasisCls =
                r.emphasis === 'highlight' ? 'bg-surface-2 item-name'
                : r.emphasis === 'subtotal' ? 'bg-surface-2/40'
                : '';
              // Group-based divider: heavier line where the group changes
              // (revenue → cost → profit → cash), robust to hidden rows.
              const divider = i > 0 && arr[i - 1].group !== r.group;
              return (
                <motion.tr
                  key={r.label}
                  title={r.cause}
                  initial={reduced ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: reduced ? 0 : i * 0.035, ease: [0.2, 1, 0.4, 1] }}
                  className={clsx(
                    'align-middle border-t',
                    divider ? 'border-border-soft' : 'border-border-soft/40',
                    emphasisCls,
                  )}
                >
                  <td className={clsx('py-2 pl-3 pr-2', r.group === 'cost' ? 'text-text-2' : 'text-text')}>
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex items-center justify-center w-7 h-7 border border-border-soft bg-surface-2/60 shrink-0">
                        <img src={r.icon} alt="" className="w-4 h-4 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
                      </span>
                      <span className={clsx('truncate', r.emphasis ? 'item-name' : 'body-xs')}>{r.label}</span>
                    </span>
                  </td>
                  <PnLCell value={values.p1} row={r} />
                  <PnLCell value={values.p2} row={r} />
                  <PnLCell value={values.p3} row={r} />
                  <PnLCell value={values.total} row={r} emphasis />
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PnLCell({ value, row, emphasis }: { value: number | null; row: PnLRow; emphasis?: boolean }) {
  if (value === null) {
    return <td className="py-2 px-2 text-right num-xs text-text-3">-</td>;
  }
  let color = 'text-text';
  if (row.group === 'cost') color = value !== 0 ? 'text-fin-cost' : 'text-text-3';
  else if (row.group === 'revenue') color = value > 0 ? 'text-fin-revenue' : 'text-text-3';
  else if (row.group === 'profit')
    color = value > 0 ? 'text-fin-profit' : value < 0 ? 'text-danger' : 'text-text';
  else if (row.group === 'cash') color = value < 0 ? 'text-danger' : 'text-fin-cash';

  const display =
    row.group === 'cost' && value !== 0 ? `−${fmt$(Math.abs(value))}` : fmt$(value);

  return (
    <td className={clsx('py-2 px-2 text-right num-xs whitespace-nowrap', color, emphasis && 'pr-3')}>
      {display}
    </td>
  );
}

/* ── Portfolio tab (all-notebooks rollup) ────────────────────────────── */

export function PortfolioMetrics() {
  const lines = useGame((s) => s.portfolio.productLines);
  const finished = useGame((s) => s.inventory.totalFinished);

  if (lines.length === 0) return <EmptyMetrics text="No notebooks yet. Open Notebook Items to add one." />;

  // Everything reads from the FinLit model (same engine that runs the phase),
  // so the portfolio sheet agrees with the Active Notebook sheet. The old
  // Capacity & Risk card (capacity-load / complexity / cannibalization) was
  // legacy V2 - none of it fed the V3 sim - so it's gone.
  const specs = lines.map(finlitSpecOf);
  const avgCost = specs.reduce((a, sp) => a + finlitUnitCost(sp), 0) / specs.length;
  const totalCapacity = specs.reduce((a, sp) => a + prodPerDay(sp, 0), 0);
  const totalTarget = lines.reduce(
    (a, l, i) => a + (l.targetPerDay ?? Math.ceil(prodPerDay(specs[i], 0))),
    0,
  );
  // A genuine diversity signal (the honest heir to "cannibalization"): are the
  // lines spread across genres, or piled onto one?
  const genresInPlay = new Set(lines.map((l) => l.genre ?? 'indie')).size;

  const loadRatio = totalCapacity > 0 ? totalTarget / totalCapacity : 0;
  const loadPct = Math.round(loadRatio * 100);
  const loadTone: Tone = loadPct > 100 ? 'danger' : loadPct > 90 ? 'warn' : 'success';

  const groups: KVGroup[] = [
    {
      key: 'lines',
      icon: A.ui.sidebar.product,
      title: 'Product Lines',
      total: fmtInt(lines.length),
      totalTone: 'neutral',
      rows: [
        { key: 'count', label: 'Notebooks', num: lines.length, format: fmtInt, tone: 'neutral' },
        { key: 'genres', label: 'Genres in play', value: `${genresInPlay}/${GENRES.length}`, tone: genresInPlay > 1 ? 'success' : 'neutral', sub: genresInPlay === 1 ? 'All lines share one market' : 'Spread across markets' },
        { key: 'avg', label: 'Avg unit cost', num: avgCost, format: fmt$, tone: 'neutral' },
      ],
    },
    {
      key: 'output',
      icon: A.ui.metrics.capacity,
      title: 'Daily Output',
      rows: [
        { key: 'target', label: 'Produce target', value: `~${fmtInt(totalTarget)}/day`, tone: 'neutral' },
        { key: 'cap', label: 'Capacity', value: `~${fmtInt(Math.round(totalCapacity))}/day`, tone: 'neutral' },
        { key: 'load', label: 'Capacity load', value: `${loadPct}%`, tone: loadTone, sub: loadPct > 100 ? 'Target exceeds capacity' : 'Within capacity' },
      ],
    },
    {
      key: 'inventory',
      icon: A.ui.metrics.inventory,
      title: 'Inventory',
      rows: [
        { key: 'finished', label: 'Finished stock', num: finished, format: fmtInt, tone: finished === 0 ? 'warn' : 'neutral' },
      ],
    },
  ];

  return <KVTable groups={groups} />;
}
