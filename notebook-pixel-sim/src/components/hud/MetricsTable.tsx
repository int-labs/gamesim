import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { A } from '@/assets';
import { fmt$, fmtInt } from '@/utils/format';
import { CountUp } from '@/components/primitives/CountUp';
import type { LedgerEntry } from '@/types';
import { GENRES, type GenreId } from '@/data/finlit';
import type { LiveProjectionState } from '@/gamesim/useLiveProjection';
import type { ServerProjectionResult, ServerProductProjection } from '@/gamesim/sync';

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
export function BottomStats({ liveProjectionState }: { liveProjectionState: LiveProjectionState }) {
  const { liveProjection, loading } = liveProjectionState;

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
          <div className="body-xs text-cream-100/80 hidden md:block mt-1">
            Your paperwork - the active notebook, the whole portfolio, and the run's finances
          </div>
        </div>
        {loading && <span className="body-xs text-cream-100/50 ml-2">Updating…</span>}
      </header>

      <div className="relative grid gap-5 lg:grid-cols-2 mb-6 items-start">
        <PaperSheet title="Active Notebook" icon={A.ui.sidebar.product} tilt={-0.6}>
          <NotebookMetrics liveProjection={liveProjection} />
        </PaperSheet>
        <PaperSheet title="Portfolio" icon={A.ui.sidebar.metrics} tilt={0.5} delay={0.08}>
          <PortfolioMetrics liveProjection={liveProjection} />
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
                    {r.sub && <div className="hint text-text-3 leading-tight truncate mt-0.5">{r.sub}</div>}
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

/* ── Notebook tab (active line) ───────────────────────────────────────── */

function NotebookMetrics({ liveProjection }: { liveProjection: ServerProjectionResult | null }) {
  const line = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
  const lineIndex = useGame((s) =>
    s.portfolio.productLines.findIndex((l) => l.id === s.portfolio.activeLineId),
  );
  const finished = useGame((s) => s.inventory.totalFinished);
  const channelCount = useGame((s) =>
    s.globalInputSelections.filter((sel) => sel.key === 'channel' && sel.selectedStepKey != null).length,
  );

  if (!line) return <EmptyMetrics text="No notebook selected. Open Notebook Items to add one." />;

  const genre: GenreId = line.genre ?? 'indie';
  const genreName = GENRES.find((g) => g.id === genre)?.name ?? genre;

  // Server projection for this specific line (index-aligned with portfolio order).
  const proj: ServerProductProjection | null = liveProjection?.byProduct[lineIndex] ?? liveProjection?.byProduct[0] ?? null;

  const revenue = proj?.revenue;
  const customers = proj?.customersObtained;
  const unitCost = proj?.dynamicCost;
  const grossProfit = proj?.grossProfit;
  const price = proj?.sellingPrice ?? line.price;

  const marginPct = unitCost != null && price > 0 ? Math.round(((price - unitCost) / price) * 100) : null;
  const marginTone: Tone = marginPct == null ? 'neutral' : marginPct >= 40 ? 'success' : marginPct >= 15 ? 'info' : 'warn';

  const projRows: KVRow[] = proj ? [
    { key: 'revenue',   label: 'Revenue',      num: Math.round(revenue ?? 0),    format: fmt$,   tone: 'revenue' },
    { key: 'customers', label: 'Customers',     num: Math.round(customers ?? 0),  format: fmtInt, tone: 'neutral' },
    { key: 'ucost',     label: 'Unit cost',     num: unitCost ?? 0,               format: fmt$,   tone: 'cost',   sub: 'per notebook (incl. modifiers)' },
    { key: 'gprofit',   label: 'Gross profit',  num: Math.round(grossProfit ?? 0), format: fmt$,  tone: (grossProfit ?? 0) >= 0 ? 'profit' : 'danger' },
  ] : [
    { key: 'pending', label: 'Waiting for server projection…', value: '–', tone: 'neutral' },
  ];

  const groups: KVGroup[] = [
    {
      key: 'design',
      icon: A.ui.metrics.demand,
      title: 'Design',
      rows: [
        { key: 'genre',    label: 'Genre',          value: genreName,                              tone: 'info' },
        { key: 'price',    label: 'Price',           num: line.price, format: fmt$,                 tone: 'neutral' },
        { key: 'channels', label: 'Channels active', value: `${channelCount}/3`,                   tone: channelCount === 0 ? 'warn' : 'neutral' },
        ...(marginPct != null ? [{ key: 'margin', label: 'Margin', value: `${marginPct}%`, tone: marginTone } as KVRow] : []),
      ],
    },
    {
      key: 'projections',
      icon: A.ui.pnl.operating_profit,
      title: 'Projections (this phase)',
      rows: projRows,
    },
    {
      key: 'inventory',
      icon: A.ui.metrics.inventory,
      title: 'Inventory',
      rows: [
        { key: 'stock', label: 'Stock on hand', num: finished, format: fmtInt, tone: finished === 0 ? 'danger' : 'neutral', sub: finished === 0 ? 'Confirm the phase to produce' : undefined },
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
  { label: 'Labor Cost',           icon: A.ui.pnl.labor_cost,       kinds: ['cogs-labor'],    sign: 'minus', group: 'cost',    cause: 'Wages × hires' },
  { label: 'Marketing / Ops',      icon: A.ui.pnl.marketing_spend,  kinds: ['opex-marketing'],sign: 'minus', group: 'cost',    cause: 'Marketing team + hiring cost' },
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
                      ? 'eyebrow-strong border-primary bg-primary-soft/55 border-x border-x-primary/45'
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
                  {/* The live phase is marked down the whole COLUMN. A 4px
                      rule under one header cell is invisible once your eye is
                      three rows into the numbers, which is where you actually
                      read - so the column you are playing carries a tint and
                      side rules for its full height. */}
                  <PnLCell value={values.p1} row={r} live={phaseNow === 1} />
                  <PnLCell value={values.p2} row={r} live={phaseNow === 2} />
                  <PnLCell value={values.p3} row={r} live={phaseNow === 3} />
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

function PnLCell({ value, row, emphasis, live }: { value: number | null; row: PnLRow; emphasis?: boolean; live?: boolean }) {
  const liveCls = live ? 'bg-primary-soft/55 border-x border-primary/45' : '';
  if (value === null) {
    return <td className={clsx('py-2 px-2 text-right num-xs text-text-3', liveCls)}>-</td>;
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
    <td className={clsx('py-2 px-2 text-right num-xs whitespace-nowrap', color, liveCls, emphasis && 'pr-3')}>
      {display}
    </td>
  );
}

/* ── Portfolio tab (all-notebooks rollup) ────────────────────────────── */

export function PortfolioMetrics({ liveProjection }: { liveProjection?: ServerProjectionResult | null }) {
  const lines = useGame((s) => s.portfolio.productLines);
  const finished = useGame((s) => s.inventory.totalFinished);

  if (lines.length === 0) return <EmptyMetrics text="No notebooks yet. Open Notebook Items to add one." />;

  const genresInPlay = new Set(lines.map((l) => l.genre ?? 'indie')).size;

  const bp = liveProjection?.byProduct ?? [];
  const avgCost = bp.length
    ? bp.reduce((a, p) => a + (p.dynamicCost ?? 0), 0) / bp.length
    : null;
  const totalRevenue   = bp.length ? Math.round(bp.reduce((a, p) => a + (p.revenue ?? 0), 0))           : null;
  const totalCustomers = bp.length ? Math.round(bp.reduce((a, p) => a + (p.customersObtained ?? 0), 0)) : null;

  const groups: KVGroup[] = [
    {
      key: 'lines',
      icon: A.ui.sidebar.product,
      title: 'Product Lines',
      total: fmtInt(lines.length),
      totalTone: 'neutral',
      rows: [
        { key: 'count',  label: 'Notebooks',      num: lines.length, format: fmtInt, tone: 'neutral' },
        { key: 'genres', label: 'Genres in play',  value: `${genresInPlay}/${GENRES.length}`, tone: genresInPlay > 1 ? 'success' : 'neutral', sub: genresInPlay === 1 ? 'All lines in one market' : 'Spread across markets' },
        ...(avgCost != null ? [{ key: 'avg', label: 'Avg unit cost', num: avgCost, format: fmt$, tone: 'neutral' as Tone }] : []),
      ],
    },
    {
      key: 'output',
      icon: A.ui.pnl.operating_profit,
      title: 'Output / phase',
      rows: bp.length ? [
        { key: 'revenue',   label: 'Est. revenue',   num: totalRevenue!,   format: fmt$,   tone: 'revenue' as Tone },
        { key: 'customers', label: 'Est. customers', num: totalCustomers!, format: fmtInt, tone: 'neutral' as Tone },
      ] : [
        { key: 'pending', label: 'Awaiting projection…', value: '–', tone: 'neutral' as Tone },
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
