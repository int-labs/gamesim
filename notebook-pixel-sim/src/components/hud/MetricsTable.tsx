import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { NotebookCycler } from '@/components/canvas/NotebookCycler';
import { A } from '@/assets';
import { fmt$, fmtInt } from '@/utils/format';
import { CountUp } from '@/components/primitives/CountUp';
import { GENRES, type GenreId } from '@/data/finlit';
import type { LiveProjectionState } from '@/gamesim/useLiveProjection';
import type {
  ServerProjectionResult,
  ServerProductProjection,
  OfficialFinancials,
} from '@/gamesim/sync';
import { computeUserProjection } from '@/gamesim/computeUserProjection';
import { selectCashBalance } from '@/engine/selectors';
import { useGamesimSession, roundNumberFromPhase } from '@/gamesim/GamesimProvider';

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

        {/* Paging the ACTIVE notebook belongs to the section, not to either
            sheet: it changes what the Active Notebook sheet shows, so putting
            it inside the Portfolio rollup made it look like a portfolio
            control. Centred under both. */}
        <NotebookCycler className="relative justify-center mt-6" />
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
  // Channels are BINARY: stored with `selectedStepKey: null` by design, so
  // PRESENCE is the selection. Filtering on a non-null step key counts zero.
  const channelCount = useGame((s) =>
    s.globalInputSelections.filter((sel) => sel.key === 'channel' && !!sel.inputId).length,
  );
  /** The operator's cap — the same one `toggleFinlitChannelAll` enforces. */
  const channelMax = useGame(
    (s) => s.availableGlobalInputs.find((g) => g.key === 'channel')?.maxSelections ?? 1,
  );

  if (!line) return <EmptyMetrics text="No notebook selected. Open Notebook Items to add one." />;

  const genre: GenreId = line.productId;
  const genreName = GENRES.find((g) => g.id === genre)?.name ?? genre;

  // Server projection for THIS line, keyed by productId. `byProduct` follows the
  // server's own pairing, not portfolio order, so an index read showed another
  // notebook's unit cost and capacity whenever the two diverged.
  const proj: ServerProductProjection | null =
    liveProjection?.byProduct.find((p) => p.productId === line.productId) ?? null;

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
        { key: 'channels', label: 'Channels active', value: `${channelCount}/${channelMax}`,        tone: channelCount === 0 ? 'warn' : 'neutral' },
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

/**
 * Where a row's figure comes from. Named sources read the server's OWN field;
 * `{ costKey }` reads one aggregated `incurredCosts` entry. Subtotals are taken
 * VERBATIM, never re-derived — re-deriving is how a sheet drifts from
 * calcFinancials by arithmetic while every input still agrees.
 */
type RowSource =
  | 'revenue'
  | 'gross-profit'
  | 'op-ex'
  | 'op-profit'
  // ── The cash walk ──────────────────────────────────────────────────────
  // Endpoints alone ('cash-opening' → 'cash-closing') hide the part that
  // matters: cash LEAVES on the build and only returns if the stock sells.
  // These four rows put that swing on the page.
  | 'cash-opening'
  | 'cogs-total'
  | 'cash-before-opex'
  | 'cash'
  | { costKey: string };

interface PnLRow {
  label: string;
  icon: string;
  sign: 'plus' | 'minus';
  emphasis?: RowEmphasis;
  cause: string;
  group: 'revenue' | 'cogs' | 'opex' | 'profit' | 'cash';
  source: RowSource;
  /** A second figure tucked under this row's own, smaller and muted. For a
   *  P&L subtotal that belongs BESIDE a cash position rather than in the cash
   *  chain — it would otherwise read as another step in the running total. */
  sub?: { source: RowSource; label: string };
}

/** One round's aggregated `incurredCosts` entry. */
interface CostCell {
  label: string;
  treatment: 'cogs' | 'opex';
  amount: number;
}

// Two fixed server entries (`inventory`, `holding`) plus one per globalInput
// category. Categories are free-text and operator-owned: generic icon by side,
// label rendered VERBATIM — not ours to normalise.
const COST_ICON: Record<string, string> = {
  inventory: A.ui.pnl.material_cost,
  holding: A.ui.pnl.fulfillment_cost,
};
const costIcon = (key: string, treatment: 'cogs' | 'opex'): string =>
  COST_ICON[key] ?? (treatment === 'cogs' ? A.ui.pnl.packaging_cost : A.ui.pnl.marketing_spend);

// The FIXED rows. ROW ORDER IS THE SHEET: `cogs` cost rows splice in ABOVE the
// Gross Profit subtotal, `opex` rows BELOW — the partition calcFinancials
// computes. A row on the wrong side reads as a different formula.
// Cost line items are derived, not declared: categories are operator-config.
const ROW_REVENUE: PnLRow = {
  label: 'Gross Revenue', icon: A.ui.pnl.gross_revenue, sign: 'plus',
  group: 'revenue', source: 'revenue', cause: 'Units sold × selling price',
};
/**
 * The running CASH position once production is paid for and the stock has sold,
 * before period costs — `starting − COGS + revenue`.
 *
 * Equivalently `cash left after the build + sales`: for round 0 that is
 * 322.73 + 5,907.00. The 322.73 is the money tied up in stock and the figure
 * the HUD chip gates spending on, so this row carries that information without
 * needing a line of its own.
 *
 * Sits ABOVE Gross Profit so the column's cash chain stays unbroken —
 * Starting Cash → here → Cash Balance — with the P&L subtotals reading as the
 * aside they are.
 */
const ROW_CASH_BEFORE_OPEX: PnLRow = {
  label: 'Cash before expenses', icon: A.ui.pnl.net_revenue, sign: 'plus', emphasis: 'subtotal',
  group: 'cash', source: 'cash-before-opex',
  cause:
    'Starting cash − cost of goods sold + gross revenue. What you hold before operating expenses. ' +
    'Gross profit (revenue − COGS) is shown above it — the trading result, not a step in the cash chain',
  sub: { source: 'gross-profit', label: 'Gross Profit' },
};
// Gross Profit has no row of its own — it is the `sub` on Cash before expenses
// above, so the column reads as one cash chain rather than two interleaved.
const ROW_OPEX: PnLRow = {
  label: 'Operating Expenses', icon: A.ui.pnl.fulfillment_cost, sign: 'minus', emphasis: 'subtotal',
  group: 'profit', source: 'op-ex', cause: 'Holding on unsold stock plus every cost declared as opex',
};
// Operating Profit has no row of its own — it is the `sub` on Cash Balance, the
// same way Gross Profit sits over Cash before expenses. Each cash position
// carries its P&L counterpart directly above it, so the column is one cash chain with
// the trading result read alongside rather than interleaved into it.
/**
 * The P&L, BRACKETED BY CASH.
 *
 * Opening and closing cash top and tail the statement, so the round reads as
 * "I had 5,000, I earned 322, I now hold 5,322" — the sheet previously showed
 * only the middle and looked like a collapse (5,907 → 322) on a round that
 * gained.
 *
 * COGS sits ABOVE revenue on purpose: money leaves on the build before any
 * comes back on the sale, and that order is the working-capital lesson. The
 * profit rows are P&L subtotals, not a running cash total — `Gross Profit` is
 * `revenue − COGS`, while the cash chain is `opening + operating profit`.
 */
/**
 * THE BRIDGE ACROSS ROUNDS. Every column's Starting Cash is the PREVIOUS
 * column's Cash Balance, so the sheet joins up round to round instead of each
 * one opening on an unexplained figure. Round 1 has no prior round and starts
 * on the operator's starting capital.
 */
const ROW_CASH_OPENING: PnLRow = {
  label: 'Starting Cash', icon: A.ui.pnl.net_revenue, sign: 'plus',
  group: 'cash', source: 'cash-opening',
  cause: 'Last round’s cash balance — its closing cash plus its operating profit',
};
/**
 * ONE row, not a breakdown — unlike OpEx below it.
 *
 * The cogs side of `incurredCosts` is production cost and reads as a single
 * idea; itemising it alongside an aggregate printed the same figure twice.
 * OpEx stays itemised because its categories are operator-authored and
 * genuinely distinct.
 */
const ROW_COGS: PnLRow = {
  label: 'Cost of Goods Sold', icon: A.ui.pnl.material_cost, sign: "minus",
  group: 'cogs', source: 'cogs-total',
  cause: 'Charged on units PRODUCED, not sold — it leaves when you commit the build',
};
/**
 * Must account for EVERY row above it — that is what lets `Tied up in stock`
 * stay off the sheet and be inferred instead. Both derivations are named
 * because the column carries two chains: walk the cash rows, or take the P&L's
 * bottom line. They agree by definition.
 */
const ROW_CASH: PnLRow = {
  label: 'Cash Balance', icon: A.ui.pnl.net_revenue, sign: 'plus', emphasis: 'highlight',
  group: 'cash', source: 'cash',
  cause:
    'Starting cash − cost of goods sold + gross revenue − operating expenses. ' +
    'Same thing as starting cash + operating profit — which is the figure above it.',
  sub: { source: 'op-profit', label: 'Operating Profit' },
};

export function FinanceTable() {
  // The three slices `selectCashBalance` reads — NOT `useGame((s) => s)`, which
  // subscribes to the whole store and re-renders this table on every mutation,
  // including ones it does not display (a slider drag, a mascot push).
  const playerCash = useGame((s) => s.player.cash);
  const cashOpeningByRound = useGame((s) => s.cashOpeningByRound);
  const ledger = useGame((s) => s.ledger);
  const phaseNow = useGame((s) => s.meta.phase);
  const reduced = useReducedMotion();
  // Hooked, not passed: two render sites (BottomStats, BusinessPage), neither
  // threads props.
  const { bootstrap, financialsByRound } = useGamesimSession();
  const totalRounds = bootstrap?.simulation.config?.totalRounds;
  // `financialsByRound` is keyed 0-BASED; `p` is a 1-based display phase.
  const officialFor = (p: number): OfficialFinancials | null =>
    financialsByRound[roundNumberFromPhase(p)] ?? null;

  // EVERY configured round gets a column. Empty cells are CORRECT: an actual
  // cannot exist until the operator calculates the round. Falls back to the
  // current round when `totalRounds` is unknown (standalone play).
  const phases: number[] = (() => {
    const seen = new Set<number>();
    seen.add(phaseNow);
    for (let r = 1; r <= (totalRounds ?? 0); r++) seen.add(r);
    return [...seen].filter((p) => p >= 1).sort((a, b) => a - b);
  })();

  // Keyed by the 1-BASED display PHASE, which is what `phases` holds — hence
  // `costByPhase`, not `costByRound`. It was the latter, and `computeRow` then
  // looked it up by the 0-based `f.roundNumber`, shifting every cost row one
  // column left. See [[project-round-numbering]]: `roundNumberFromPhase` is the
  // ONLY place the two counters may be converted.
  //
  // Costs are PER PRODUCT, so a phase's row sums across products.
  // Key is `treatment:key` — one category can land on BOTH sides of the line.
  //
  // BOTH arrays: unit-charged rows in `incurredCosts`, globalInput spend in
  // `globalInputCosts`. Rounds scored before the split carry globalInput rows
  // in the first array with `key === category`, which is the key the second
  // array produces — so old and new documents merge into the same row.
  const costByPhase = new Map<number, Map<string, CostCell>>();
  for (const p of phases) {
    const f = officialFor(p);
    if (!f) continue;
    const m = new Map<string, CostCell>();
    const add = (k: string, label: string, treatment: 'cogs' | 'opex', amount: number) => {
      const prev = m.get(k);
      m.set(k, { label, treatment, amount: (prev?.amount ?? 0) + amount });
    };
    for (const prod of f.byProduct) {
      for (const c of prod.incurredCosts ?? []) {
        add(c.treatment + ':' + c.key, c.label, c.treatment, c.incurredCost ?? 0);
      }
      for (const c of prod.globalInputCosts ?? []) {
        add(c.treatment + ':' + c.category, c.label, c.treatment, c.incurredCost ?? 0);
      }
    }
    costByPhase.set(p, m);
  }

  // Cost rows are the UNION across every scored round, so a category that
  // appears only in round 2 still gets a row for the whole sheet.
  const costRows: PnLRow[] = (() => {
    const seen = new Map<string, CostCell>();
    for (const m of costByPhase.values()) {
      for (const [k, v] of m) if (!seen.has(k)) seen.set(k, v);
    }
    return [...seen.entries()].map(([k, v]) => ({
      label: v.label,
      icon: costIcon(k.slice(k.indexOf(':') + 1), v.treatment),
      sign: 'minus' as const,
      group: v.treatment,
      source: { costKey: k },
      cause:
        v.treatment === 'cogs'
          ? 'Charged above the gross-profit line, on units produced'
          : 'Period cost, charged below the gross-profit line',
    }));
  })();

  // Opening cash → the P&L → closing cash, in one column.
  //
  // Every label stays true to what the server computed, so the sheet still
  // reproduces from the competitor export. Folding opening cash (or COGS) INTO
  // revenue was tried and rejected: it balances arithmetically but prints a
  // "Gross Revenue" no export can reproduce, and a losing round still shows a
  // large positive while capital remains.
  const rows: PnLRow[] = [
    ROW_CASH_OPENING,
    ROW_COGS,
    ROW_REVENUE,
    // No standalone Gross Profit row — it sits over Cash before expenses as
    // a sub-figure, so the column reads as one cash chain.
    ROW_CASH_BEFORE_OPEX,
    ...costRows.filter((r) => r.group === 'opex'),
    ROW_OPEX,
    ROW_CASH,
  ];

  // PER ROUND, from that round's own write-once opening plus its scored profit.
  // Never a cumulative sum over a live base, and never net of committed spend:
  // this is the BALANCE, and it is the definition the HUD chip adopts.
  const cashInputs = { player: { cash: playerCash }, cashOpeningByRound, ledger };
  const cashThrough = (p: number) =>
    selectCashBalance(cashInputs, p, (r) => officialFor(r)?.operatingProfit);

  const computeRow = (r: PnLRow, p: number | 'total'): number | null => {
    if (r.source === 'cash') {
      // Total is the FINAL balance, not a sum of balances.
      const last = phases[phases.length - 1] ?? phaseNow;
      return cashThrough(p === 'total' ? last : p);
    }
    // A BALANCE does not add up across columns — only flows do. The run's
    // opening is the FIRST phase's, not the sum of three openings, which would
    // print a number with no meaning. (Closing is handled above; COGS, revenue
    // and the expense rows are flows and sum correctly below.)
    if (p === 'total' && r.source === 'cash-opening') {
      const first = phases[0] ?? phaseNow;
      return cashThrough(first - 1);
    }
    // Also a balance: the run's figure is the LAST phase's, matching Cash
    // Balance's own total, not a sum of three positions.
    if (p === 'total' && r.source === 'cash-before-opex') {
      const last = phases[phases.length - 1] ?? phaseNow;
      const f = officialFor(last);
      return f ? cashThrough(last - 1) - (f.revenue - f.grossProfit) + f.revenue : null;
    }
    // Server costs arrive POSITIVE and `PnLCell` renders the minus, so nothing
    // here negates.
    //
    // `costByPhase` is keyed by the 1-BASED display PHASE, because that is what
    // it was built from — NOT by `f.roundNumber`, which is 0-based. Reading it
    // with the round number shifted every cost row one column left: P1 read a
    // key that did not exist and showed $0, P2 showed P1's costs, and the sheet
    // stopped reconciling against its own verbatim subtotals.
    const pick = (f: OfficialFinancials, phase: number): number => {
      if (typeof r.source === 'object') {
        return costByPhase.get(phase)?.get(r.source.costKey)?.amount ?? 0;
      }
      // What the team held when this phase OPENED — the previous phase's closing
      // balance, from the same function the Closing Cash row uses, so the two
      // ends of the walk cannot drift apart. `phase` is 1-based, so phase 1
      // opens on `cashThrough(0)`: the starting capital, no scored round added.
      const opening = () => cashThrough(phase - 1);
      switch (r.source) {
        case 'revenue':      return f.revenue;
        case 'gross-profit': return f.grossProfit;
        case 'op-ex':        return f.operatingExpenses;
        case 'op-profit':    return f.operatingProfit;
        case 'cash-opening': return opening();
        // The server's own COGS — `revenue − grossProfit` is exactly what
        // `calcFinancials` subtracted, not a re-derivation from units × cost.
        case 'cogs-total':   return f.revenue - f.grossProfit;
        // starting − COGS + revenue. Equals Cash Balance + operating expenses,
        // so the two cash rows cannot disagree.
        case 'cash-before-opex':
          return opening() - (f.revenue - f.grossProfit) + f.revenue;
        default:             return 0;
      }
    };
    const at = (q: number) => {
      const f = officialFor(q);
      return f ? pick(f, q) : 0;
    };
    return p === 'total' ? phases.reduce((a, q) => a + at(q), 0) : at(p);
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
            {/* No zero-hiding filter: derived rows only exist when a round
                emitted them, so hiding would drop a real line item. */}
            {rows
              .map((r, i, arr) => {
              const values = {
                perPhase: phases.map((p) => computeRow(r, p)),
                total: computeRow(r, 'total'),
              };
              // Same resolver, so a sub-figure can never drift from the row it
              // sits under.
              const subRow = r.sub ? { ...r, source: r.sub.source } : null;
              const subValues = subRow
                ? {
                    perPhase: phases.map((p) => computeRow(subRow, p)),
                    total: computeRow(subRow, 'total'),
                  }
                : null;
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
                      {/* Two lines when the row carries a sub-figure, so the
                          label column mirrors the value column's shape. The
                          sub sits ABOVE: it is the input the cash position
                          below it lands on, so it reads in that order. */}
                      <span className="flex flex-col min-w-0 leading-tight">
                        {r.sub && (
                          <span className="hint text-text-3 truncate">{r.sub.label}</span>
                        )}
                        <span className={clsx('truncate', r.emphasis ? 'item-name' : 'body-xs')}>{r.label}</span>
                      </span>
                    </span>
                  </td>
                  {/* The live phase is marked down the whole COLUMN. A 4px
                      rule under one header cell is invisible once your eye is
                      three rows into the numbers, which is where you actually
                      read - so the column you are playing carries a tint and
                      side rules for its full height. */}
                  {phases.map((p, ci) => (
                    <PnLCell
                      key={p}
                      value={values.perPhase[ci]}
                      row={r}
                      live={phaseNow === p}
                      subValue={subValues?.perPhase[ci] ?? null}
                    />
                  ))}
                  <PnLCell
                    value={values.total}
                    row={r}
                    emphasis
                    subValue={subValues?.total ?? null}
                  />
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PnLCell({
  value,
  row,
  emphasis,
  live,
  subValue,
}: {
  value: number | null;
  row: PnLRow;
  emphasis?: boolean;
  live?: boolean;
  /** Rendered under the figure, smaller and muted. See `PnLRow.sub`. */
  subValue?: number | null;
}) {
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
    <td className={clsx('py-2 px-2 text-right whitespace-nowrap', liveCls, emphasis && 'pr-3')}>
      {subValue != null && (
        // ABOVE its parent, matching the label column. A step down in SIZE
        // only — it keeps the profit palette, because whether the trading
        // result is positive or negative is the whole point of showing it.
        // Muting the colour would hide a loss.
        <div
          className={clsx(
            // `num-xs`, not `hint`: every numeral keeps Inter 700 + tabular
            // figures so the column still aligns. Only the SIZE steps down —
            // `text-[12px]` overrides the 15px baked into `.num-xs`.
            'num-xs text-[12px] leading-tight mb-0.5',
            subValue > 0 ? 'text-fin-profit' : subValue < 0 ? 'text-danger' : 'text-text-3',
          )}
        >
          {subValue < 0 ? `−${fmt$(Math.abs(subValue))}` : fmt$(subValue)}
        </div>
      )}
      <div className={clsx('num-xs', color)}>{display}</div>
    </td>
  );
}

/* ── Portfolio tab (all-notebooks rollup) ────────────────────────────── */

export function PortfolioMetrics({ liveProjection }: { liveProjection?: ServerProjectionResult | null }) {
  const lines = useGame((s) => s.portfolio.productLines);

  if (lines.length === 0) return <EmptyMetrics text="No notebooks yet. Open Notebook Items to add one." />;

  const genresInPlay = new Set(lines.map((l) => l.productId)).size;

  const bp = liveProjection?.byProduct ?? [];
  const avgCost = bp.length
    ? bp.reduce((a, p) => a + (p.dynamicCost ?? 0), 0) / bp.length
    : null;
  const { revenue: totalRevenue, demand: totalCustomers } = computeUserProjection(lines, bp);

  // Server CLOSING STOCK — the same figure the next round opens with.
  const finished = bp.length
    ? Math.round(bp.reduce((a, p) => a + (p.closingStock ?? 0), 0))
    : null;

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
        finished == null
          ? { key: 'stock', label: 'Stock on hand', value: '–', tone: 'neutral' as Tone,
              sub: 'waiting for server projection' }
          : { key: 'stock', label: 'Stock on hand', num: finished, format: fmtInt,
              tone: finished === 0 ? 'danger' : 'neutral' as Tone,
              sub: finished === 0 ? 'nothing carried into the next phase' : 'unsold units carried forward' },
      ],
    },
  ];

  return <KVTable groups={groups} />;
}
