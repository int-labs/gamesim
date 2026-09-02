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
import { computeUserProjection } from '@/gamesim/computeUserProjection';

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

/** Desk dressing — faint scattered blank sheets behind the documents. */
function DeskDressing() {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <div className="absolute left-[6%] top-24 w-64 h-44 bg-cream-100/[0.05] border border-cream-100/10 -rotate-6" />
      <div className="absolute right-[8%] top-16 w-72 h-48 bg-cream-100/[0.05] border border-cream-100/10 rotate-3" />
      <div className="absolute left-[38%] bottom-10 w-80 h-40 bg-cream-100/[0.04] border border-cream-100/10 rotate-1" />
    </div>
  );
}

/** Section heading — icon, title, and a line saying where the numbers came from. */
function DeskHeader({ icon, title, blurb, note }: { icon: string; title: string; blurb: string; note?: React.ReactNode }) {
  return (
    <header className="relative flex items-center gap-2.5 mb-6">
      <span className="inline-flex items-center justify-center w-9 h-9 border border-cream-100/25 bg-black/25">
        <img src={icon} alt="" className="w-6 h-6 object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
      </span>
      <div className="min-w-0">
        <div className="pixel-caption text-cream-100">{title}</div>
        <div className="body-xs text-cream-100/80 hidden md:block mt-1">{blurb}</div>
      </div>
      {note}
    </header>
  );
}

/**
 * BottomStats — the paperwork as DOCUMENTS ON A DESK. Scrolling down the page
 * reveals paper sheets that LIFT off the desk as they enter view — rising,
 * straightening from a scattered tilt, each held down by tape strips — like
 * picking up paperwork to read it. Reduced-motion renders everything settled
 * instantly.
 *
 * TWO sections, deliberately not one. `User Projection` holds what the player
 * expects — their own demand estimates and the revenue those imply. `Actual
 * Results` holds what happened once the round was scored. The figures do not
 * match and are not supposed to: they answer different questions, and running
 * them under one heading read as a single ledger disagreeing with itself.
 *
 * `id="stats-section"` stays the scroll anchor for the canvas chip, landing on
 * the projection; `id="pnl-section"` anchors the results.
 */
export function BottomStats({ liveProjectionState }: { liveProjectionState: LiveProjectionState }) {
  const { liveProjection, loading } = liveProjectionState;

  return (
    <>
      <section
        id="stats-section"
        aria-label="User projection"
        className="relative shrink-0 px-3 sm:px-8 pt-8 pb-10 overflow-hidden"
      >
        <DeskDressing />
        <DeskHeader
          icon={A.ui.sidebar.metrics}
          title="User Projection"
          blurb="What you expect this phase - your own estimates for the active notebook and the whole portfolio"
          note={loading ? <span className="body-xs text-cream-100/50 ml-2">Updating…</span> : undefined}
        />

        <div className="relative grid gap-5 lg:grid-cols-2 items-start">
          <PaperSheet title="Active Notebook" icon={A.ui.sidebar.product} tilt={-0.6}>
            <NotebookMetrics liveProjection={liveProjection} />
          </PaperSheet>
          <PaperSheet title="Portfolio" icon={A.ui.sidebar.metrics} tilt={0.5} delay={0.08}>
            <PortfolioMetrics liveProjection={liveProjection} />
          </PaperSheet>
        </div>
      </section>

      {/* A separate section, with its own heading and its own rule above it —
          the divider is the point. Everything below it is recorded outcome. */}
      <section
        id="pnl-section"
        aria-label="Actual results"
        className="relative shrink-0 px-3 sm:px-8 pt-8 pb-16 overflow-hidden border-t border-cream-100/15"
      >
        <DeskDressing />
        <DeskHeader
          icon={A.ui.pnl.operating_profit}
          title="Actual Results"
          blurb="What actually happened - recorded once each phase was scored, not an estimate"
        />

        <PaperSheet title="Profit & Loss · by phase" icon={A.ui.pnl.operating_profit} tilt={0.35} delay={0.05} className="relative">
          <FinanceTable />
        </PaperSheet>
      </section>
    </>
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
  const channelCount = useGame((s) =>
    s.globalInputSelections.filter((sel) => sel.key === 'channel' && sel.selectedStepKey != null).length,
  );

  if (!line) return <EmptyMetrics text="No notebook selected. Open Notebook Items to add one." />;

  const genre: GenreId = line.genre ?? 'indie';
  const genreName = GENRES.find((g) => g.id === genre)?.name ?? genre;

  // Server projection for this specific line (index-aligned with portfolio order).
  const proj: ServerProductProjection | null = liveProjection?.byProduct[lineIndex] ?? liveProjection?.byProduct[0] ?? null;

  const unitCost = proj?.dynamicCost;
  const capacity = proj?.inventoryQty;
  const price = proj?.sellingPrice ?? line.price;

  const marginPct = unitCost != null && price > 0 ? Math.round(((price - unitCost) / price) * 100) : null;
  const marginTone: Tone = marginPct == null ? 'neutral' : marginPct >= 40 ? 'success' : marginPct >= 15 ? 'info' : 'warn';

  // Projected demand is the PLAYER's figure — the produce target set on the
  // Business panel, which IS their demand estimate now that the separate
  // estimate input is gone. NOT the server's `customersObtained`: that is the
  // model's own forecast, and showing it under this label put a number the
  // player never entered where they expect to read back their own. Being local,
  // it renders with or without a server projection.
  const demandEst = line.targetPerPhase ?? 0;

  // Projected revenue is the PLAYER's arithmetic, not the server's: their price
  // against their own demand estimate, clamped to the production capacity the
  // current spec can actually deliver. Above capacity the extra demand is
  // unsellable, so the ceiling — never the estimate — sets the revenue.
  // With no server projection there is no known ceiling, so the estimate stands
  // unclamped rather than being silently treated as zero capacity.
  const sellableUnits = capacity != null ? Math.min(demandEst, capacity) : demandEst;
  const projRevenue = price * sellableUnits;
  const cappedByCapacity = capacity != null && demandEst > capacity;

  // Gross profit on the projection's own terms: cost charged against the very
  // units the revenue came from. Operating expenses stay out — they are the
  // server's to compute and belong to Actual Results, not to a forecast.
  const projProfit = unitCost != null ? sellableUnits * (price - unitCost) : null;

  const demandRow: KVRow = {
    key: 'demand',
    label: 'Projected demand',
    num: demandEst,
    format: fmtInt,
    tone: demandEst === 0 ? 'warn' : 'neutral',
    sub: demandEst === 0
      ? 'set how many to produce in the Business panel'
      : 'how many you plan to produce this phase',
  };

  // Three figures only. The full breakdown lives in the Finance tab; repeating
  // COGS / gross profit / opex here was the redundancy that let two panels tell
  // two stories about the same round. Profit is the OPERATING profit — the
  // server's bottom line, not the gross-profit midpoint.
  const projRows: KVRow[] = proj ? [
    { key: 'revenue',  label: 'Projected revenue', num: Math.round(projRevenue), format: fmt$, tone: 'revenue',
      sub: cappedByCapacity
        ? `capacity caps this at ${Math.round(sellableUnits).toLocaleString()} × ${fmt$(price)}`
        : `${Math.round(sellableUnits).toLocaleString()} × ${fmt$(price)}` },
    demandRow,
    { key: 'gprofit', label: 'Projected profit', num: Math.round(projProfit ?? 0), format: fmt$,
      tone: (projProfit ?? 0) >= 0 ? 'profit' : 'danger',
      emphasis: 'highlight', sub: 'revenue − COGS on the same units' },
  ] : [
    demandRow,
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
        // Price → unit cost → margin, in the order the margin is worked out.
        // The Portfolio sheet shows the average across lines; this is the one
        // line the player is editing, which is the figure that average is made
        // of and the one the design choices actually move.
        ...(unitCost != null
          ? [{ key: 'ucost', label: 'Unit cost', num: unitCost, format: fmt$, tone: 'cost' as Tone, sub: 'per notebook, from this spec' } as KVRow]
          : []),
        ...(marginPct != null ? [{ key: 'margin', label: 'Margin', value: `${marginPct}%`, tone: marginTone } as KVRow] : []),
        { key: 'channels', label: 'Channels active', value: `${channelCount}/3`,                   tone: channelCount === 0 ? 'warn' : 'neutral' },
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
      // Capacity, not local finished stock. The server derives this ceiling from
      // the product's own field values and clamps units sold to it, so it is the
      // only figure that explains the projection above. The local engine's
      // prodPerDay / targetPerDay do NOT feed it.
      rows: [
        capacity != null
          ? { key: 'capacity', label: 'Capacity', num: Math.round(capacity), format: fmtInt, tone: capacity === 0 ? 'danger' : 'neutral', sub: 'units this line can make this phase' }
          : { key: 'capacity', label: 'Capacity', value: '–', tone: 'neutral', sub: 'waiting for server projection' },
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
  computed?: 'gross-profit' | 'op-ex' | 'op-profit' | 'cash';
  cause: string;
  group: 'revenue' | 'cogs' | 'opex' | 'profit' | 'cash';
}

// Row order IS the sheet. `cogs` rows must precede the Gross Profit subtotal and
// `opex` rows must follow it — the server's calcFinancials computes exactly this
// partition (COGS on units sold; holding + period costs below the line), and a
// row rendered on the wrong side reads as a different formula than it computes.
const PNL_ROWS: PnLRow[] = [
  { label: 'Gross Revenue',        icon: A.ui.pnl.gross_revenue,    kinds: ['revenue'],       sign: 'plus',  group: 'revenue', cause: 'Units sold × price' },
  { label: 'Material Cost',        icon: A.ui.pnl.material_cost,    kinds: ['cogs-material'], sign: 'minus', group: 'cogs',    cause: 'Paper, cover, binding, add-ons' },
  { label: 'Labor Cost',           icon: A.ui.pnl.labor_cost,       kinds: ['cogs-labor'],    sign: 'minus', group: 'cogs',    cause: 'Wages × hires — direct labor' },
  { label: 'Packaging / Fulfill.', icon: A.ui.pnl.packaging_cost,   kinds: ['cogs-packaging','cogs-fulfillment'], sign: 'minus', group: 'cogs', cause: 'Per-unit packaging + shipping' },
  { label: 'Gross Profit',         icon: A.ui.metrics.profit,       kinds: [], sign: 'plus', emphasis: 'subtotal',  computed: 'gross-profit', group: 'profit', cause: 'Revenue − COGS' },
  // Channel & holding is NOT itemised separately: in the V3 economy the other
  // two opex kinds are $0, so a `Channel & Holding` line item and an
  // `Operating Expenses` subtotal rendered the identical figure twice. The
  // subtotal absorbs it, and stays correct if marketing/tools ever go live.
  { label: 'Marketing / Ops',      icon: A.ui.pnl.marketing_spend,  kinds: ['opex-marketing'],sign: 'minus', group: 'opex',    cause: 'Marketing team + hiring cost' },
  { label: 'Tools / Upgrades',     icon: A.ui.sidebar.studio,       kinds: ['opex-tool'],     sign: 'minus', group: 'opex',    cause: 'One-off equipment, supplier deals' },
  { label: 'Operating Expenses',   icon: A.ui.pnl.fulfillment_cost, kinds: [], sign: 'minus', emphasis: 'subtotal',  computed: 'op-ex',     group: 'profit', cause: 'Channel maintenance + consignment + holding on unsold stock, plus marketing and tools' },
  { label: 'Operating Profit',     icon: A.ui.pnl.operating_profit, kinds: [], sign: 'plus', emphasis: 'highlight', computed: 'op-profit', group: 'profit', cause: 'Gross profit − operating expenses' },
  { label: 'Cash Balance',         icon: A.ui.pnl.net_revenue,      kinds: [], sign: 'plus', emphasis: 'highlight', computed: 'cash',      group: 'cash',   cause: 'Cash on hand right now (timing-aware)' },
];

export function FinanceTable() {
  const ledger = useGame((s) => s.ledger);
  const cash = useGame((s) => s.player.cash);
  const phaseNow = useGame((s) => s.meta.phase);
  const reduced = useReducedMotion();

  // Bucket ledger entries by ROUND. Entries carry `roundNumber`; this used to
  // read `e.day <= 30 ? 1 : e.day <= 60 ? 2 : 3`, which both depended on a day
  // counter that no longer advances AND capped the sheet at three columns no
  // matter how many rounds the operator configured.
  const byPhase: Record<number, Record<string, number>> = {};
  for (const e of ledger) {
    (byPhase[e.roundNumber] ??= {})[e.kind] =
      (byPhase[e.roundNumber]?.[e.kind] ?? 0) + e.amount;
  }
  // Columns follow the rounds that actually have entries, plus the round being
  // played — so a fourth round gets a column the moment it exists.
  const phases: number[] = (() => {
    const seen = new Set<number>(Object.keys(byPhase).map(Number));
    seen.add(phaseNow);
    return [...seen].filter((p) => p >= 1).sort((a, b) => a - b);
  })();
  const sumKindForPhase = (kinds: string[], p: number) =>
    kinds.reduce((a, k) => a + (byPhase[p]?.[k] ?? 0), 0);
  // Every round that has entries, not a hardcoded three.
  const sumKindAll = (kinds: string[]) =>
    phases.reduce((a, p) => a + sumKindForPhase(kinds, p), 0);

  const computeRow = (r: PnLRow, p: number | 'total'): number | null => {
    if (r.computed === 'cash') return p === 'total' ? cash : null;
    if (r.computed === 'gross-profit') {
      const get = (ph: number) =>
        sumKindForPhase(['revenue'], ph) +
        sumKindForPhase(['cogs-material', 'cogs-packaging', 'cogs-fulfillment', 'cogs-labor'], ph);
      return p === 'total' ? phases.reduce((a, ph) => a + get(ph), 0) : get(p);
    }
    if (r.computed === 'op-ex') {
      // Shown as a positive expense figure, to read as a deduction under Gross
      // Profit. Ledger costs are stored negative, hence the leading minus.
      const get = (ph: number) =>
        -sumKindForPhase(['opex-marketing', 'opex-rent', 'opex-tool'], ph);
      return p === 'total' ? phases.reduce((a, ph) => a + get(ph), 0) : get(p);
    }
    if (r.computed === 'op-profit') {
      const get = (ph: number) =>
        sumKindForPhase(['revenue'], ph) +
        sumKindForPhase(
          ['cogs-material','cogs-labor','cogs-packaging','cogs-fulfillment','opex-marketing','opex-rent','opex-tool'],
          ph,
        );
      return p === 'total' ? phases.reduce((a, ph) => a + get(ph), 0) : get(p);
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
              {phases.map((p) => (
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
              .filter(
                (r) =>
                  (r.group !== 'cogs' && r.group !== 'opex') ||
                  Math.abs(computeRow(r, 'total') ?? 0) > 0.005,
              )
              .map((r, i, arr) => {
              const values = {
                perPhase: phases.map((p) => computeRow(r, p)),
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
                  <td className={clsx('py-2 pl-3 pr-2', r.group === 'cogs' || r.group === 'opex' ? 'text-text-2' : 'text-text')}>
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
                  {phases.map((p, ci) => (
                    <PnLCell key={p} value={values.perPhase[ci]} row={r} live={phaseNow === p} />
                  ))}
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
  // `sign` rather than `group`: it catches the COGS and OpEx line items AND the
  // Operating Expenses subtotal, which sits in the `profit` group structurally
  // but must read as a deduction.
  const isDeduction = row.sign === 'minus';

  let color = 'text-text';
  if (isDeduction) color = value !== 0 ? 'text-fin-cost' : 'text-text-3';
  else if (row.group === 'revenue') color = value > 0 ? 'text-fin-revenue' : 'text-text-3';
  else if (row.group === 'profit')
    color = value > 0 ? 'text-fin-profit' : value < 0 ? 'text-danger' : 'text-text';
  else if (row.group === 'cash') color = value < 0 ? 'text-danger' : 'text-fin-cash';

  const display = isDeduction && value !== 0 ? `−${fmt$(Math.abs(value))}` : fmt$(value);

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
  const { revenue: totalRevenue, demand: totalCustomers } = computeUserProjection(lines, bp);

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
      // No projection gate: both figures come from the player's own estimates,
      // so they stand on their own. A server projection only sharpens them, by
      // supplying each line's capacity ceiling and its modified selling price.
      rows: [
        { key: 'revenue',   label: 'Est. revenue',   num: Math.round(totalRevenue),   format: fmt$,   tone: 'revenue' as Tone },
        { key: 'customers', label: 'Est. customers', num: Math.round(totalCustomers), format: fmtInt, tone: totalCustomers === 0 ? 'warn' : 'neutral' as Tone,
          sub: totalCustomers === 0 ? 'no demand estimates set yet' : 'sum of your per-line estimates' },
      ],
    },
    {
      key: 'inventory',
      icon: A.ui.metrics.inventory,
      title: 'Inventory',
      rows: [
        { key: 'stock', label: 'Stock on hand', num: finished, format: fmtInt,
          tone: finished === 0 ? 'danger' : 'neutral',
          sub: finished === 0 ? 'Confirm the phase to produce' : undefined },
      ],
    },
  ];

  return <KVTable groups={groups} />;
}
