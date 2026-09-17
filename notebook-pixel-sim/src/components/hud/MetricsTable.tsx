import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { NotebookCycler } from '@/components/canvas/NotebookCycler';
import { A } from '@/assets';
import { fmt$, fmtInt, fmtPct } from '@/utils/format';
import { CountUp } from '@/components/primitives/CountUp';
import { GENRES, type GenreId } from '@/data/finlit';
import type { LiveProjectionState } from '@/gamesim/useLiveProjection';
import type {
  ServerProjectionResult,
  ServerProductProjection,
  OfficialFinancials,
} from '@/gamesim/sync';
import { computeUserProjection } from '@/gamesim/computeUserProjection';
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
  | 'cogs-total'
  | 'gross-profit'
  | 'op-ex'
  | 'net-income'
  /** Net income ÷ revenue. The ONE derived figure on this sheet — see
   *  `computeRow`. Never sums across columns. */
  | 'margin'
  | { costKey: string };

interface PnLRow {
  label: string;
  icon: string;
  /** Kept per the QA ruling of 2026-09-17: every row on an income statement
   *  reads POSITIVE, expenses included — the reader knows a cost is a cost from
   *  the line it sits on, and a column of minus signs on a statement that is
   *  already ordered Revenue → COGS → Gross Profit is noise. Nothing is
   *  currently 'minus'; `PnLCell` still honours it if a row ever needs to be. */
  sign: 'plus' | 'minus';
  /** How the figure renders. `percent` is only Profit Margin. */
  format?: 'money' | 'percent';
  emphasis?: RowEmphasis;
  cause: string;
  group: 'revenue' | 'cogs' | 'opex' | 'profit';
  source: RowSource;
}

/** One round's aggregated `incurredCosts` entry. */
interface CostCell {
  label: string;
  treatment: 'cogs' | 'opex';
  amount: number;
}

// One fixed server entry (`inventory`) plus one per globalInput category, and
// the consignment pair. Categories are free-text and operator-owned: generic
// icon by side, label rendered VERBATIM — not ours to normalise.
//
// `holding` was the second fixed entry until 2026-09-17. Rounds scored before
// that date still carry the row in their stored `incurredCosts`, so it can
// still reach this map from history — it falls through to the generic opex
// icon, which is correct for an archived figure.
const COST_ICON: Record<string, string> = {
  inventory: A.ui.pnl.material_cost,
};
const costIcon = (key: string, treatment: 'cogs' | 'opex'): string =>
  COST_ICON[key] ?? (treatment === 'cogs' ? A.ui.pnl.packaging_cost : A.ui.pnl.marketing_spend);

/**
 * THE SHEET IS AN INCOME STATEMENT, NOT A CASH WALK.
 *
 * Ruled by QA on 2026-09-17, and it reverses several earlier passes — the
 * `Starting Cash` / `Cash before expenses` / `Cash Balance` chain that used to
 * bracket these rows is GONE, along with the `sub` machinery that paired each
 * cash position with its P&L counterpart. Two statements interleaved in one
 * column is what made the sheet hard to read; this is the standard order every
 * reader already knows:
 *
 *     Revenue − COGS = Gross Profit − OpEx = Net Income, then the margin.
 *
 * Cash position is the HUD chip's job. It is not re-derived here.
 *
 * ROW ORDER IS THE SHEET: `cogs` rows splice in above Gross Profit, `opex` rows
 * below it — the partition calcFinancials computes. A row on the wrong side
 * reads as a different formula. Cost line items are DERIVED from the round's
 * own categories, not declared here.
 */
const ROW_REVENUE: PnLRow = {
  label: 'Gross Revenue', icon: A.ui.pnl.gross_revenue, sign: 'plus',
  group: 'revenue', source: 'revenue', cause: 'Units sold × selling price',
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
  label: 'Cost of Goods Sold', icon: A.ui.pnl.material_cost, sign: 'plus',
  group: 'cogs', source: 'cogs-total',
  cause: 'Charged on units PRODUCED, not sold — it leaves when you commit the build',
};
const ROW_GROSS_PROFIT: PnLRow = {
  label: 'Gross Profit', icon: A.ui.pnl.net_revenue, sign: 'plus', emphasis: 'subtotal',
  group: 'profit', source: 'gross-profit',
  cause: 'Gross revenue − cost of goods sold. Taken verbatim from the server',
};
const ROW_OPEX: PnLRow = {
  label: 'Operating Expenses', icon: A.ui.pnl.fulfillment_cost, sign: 'plus', emphasis: 'subtotal',
  group: 'opex', source: 'op-ex',
  cause: 'The channel’s cut of each sale plus every cost declared as opex',
};
/**
 * The bottom line. This model has no tax and no interest, so net income IS the
 * server's `operatingProfit` — a RENAME, not a new calculation. It is read
 * verbatim from that field; nothing here re-derives it.
 */
const ROW_NET_INCOME: PnLRow = {
  label: 'Net Income', icon: A.ui.pnl.net_revenue, sign: 'plus', emphasis: 'highlight',
  group: 'profit', source: 'net-income',
  cause: 'Gross profit − operating expenses. The round’s result',
};
/**
 * Net income ÷ gross revenue, as a percentage — the ONE figure on this sheet
 * the server does not supply.
 *
 * A RATIO, so it never sums: the Total column is total net income ÷ total
 * revenue, not the sum (or the average) of the per-round margins. Blank rather
 * than 0% when revenue is zero — a round that sold nothing has no margin, and
 * "0%" would read as one that broke exactly even.
 */
const ROW_MARGIN: PnLRow = {
  label: 'Profit Margin', icon: A.ui.pnl.net_revenue, sign: 'plus', format: 'percent',
  group: 'profit', source: 'margin',
  cause: 'Net income as a share of gross revenue',
};

export function FinanceTable() {
  // NARROW subscriptions — never `useGame((s) => s)`, which subscribes to the
  // whole store and re-renders this table on every mutation, including ones it
  // does not display (a slider drag, a mascot push).
  //
  // `player.cash`, `cashOpeningByRound` and `ledger` were read here for the
  // cash walk. That walk is gone (2026-09-17), and so are they: this is an
  // income statement now and every figure on it is the server's.
  const phaseNow = useGame((s) => s.meta.phase);
  // The live containers, for NAMING the globalInput cost rows — see
  // `containerLabel`. Set once at bootstrap, so the array reference is stable
  // and this subscription does not churn.
  const availableGlobalInputs = useGame((s) => s.availableGlobalInputs);
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

  /**
   * A globalInput cost row's DISPLAY NAME, resolved at render from the live
   * container — never from the decision snapshot.
   *
   * The server titles these rows `label: category` (calcFinancials, "the
   * category IS the expense name"), and `category` is the operator's free-text
   * grouping string. The round CSV export titles the same container
   * `gi.label ?? gi.category ?? gi.key`, so the two reports printed different
   * names for one cost whenever a container's label and category differ.
   * The container's LABEL is the name the operator wrote to be read, so it
   * wins in both places.
   *
   * Resolved HERE rather than carried in the decision: a decision records what
   * was CHOSEN, not what it is called. Presentation is matched back by id at
   * render, so renaming a container in the console retitles every round at
   * once instead of leaving each round frozen with the name it was submitted
   * under.
   *
   * Falls back to the row's own text when no container matches — a container
   * the operator has since deleted still has costs in a scored round, and its
   * stored category is the only name left for them.
   *
   * Match is on `category` because that is the only container field the row
   * carries. Two containers sharing one category would collapse into one row
   * here — but they already do: `category` is the GROUPING key, so that is a
   * property of the server's aggregation, not something this introduces.
   */
  const containerLabel = (category: string): string =>
    availableGlobalInputs.find((g) => g.category === category)?.label ?? category;

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
        add(c.treatment + ':' + c.category, containerLabel(c.category), c.treatment, c.incurredCost ?? 0);
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
      // POSITIVE, like every other row — see `PnLRow.sign`. These were 'minus',
      // which printed a red −$907.70 under a heading that already says
      // Operating Expenses.
      sign: 'plus' as const,
      group: v.treatment,
      source: { costKey: k },
      cause:
        v.treatment === 'cogs'
          ? 'Charged above the gross-profit line, on units produced'
          : 'Period cost, charged below the gross-profit line',
    }));
  })();

  // Revenue → COGS → Gross Profit → OpEx → Net Income → margin. Every figure
  // above the margin is the server's OWN field, read verbatim, so the sheet
  // still reproduces from the competitor export.
  const rows: PnLRow[] = [
    ROW_REVENUE,
    ROW_COGS,
    ROW_GROSS_PROFIT,
    ...costRows.filter((r) => r.group === 'opex'),
    ROW_OPEX,
    ROW_NET_INCOME,
    ROW_MARGIN,
  ];

  const computeRow = (r: PnLRow, p: number | 'total'): number | null => {
    // A RATIO — it cannot be summed and it cannot be averaged. The run's margin
    // is total net income over total revenue, which is not the mean of three
    // round margins whenever the rounds differ in size.
    if (r.source === 'margin') {
      const span = p === 'total' ? phases : [p];
      let income = 0;
      let revenue = 0;
      for (const q of span) {
        const f = officialFor(q);
        if (!f) continue;
        income += f.operatingProfit;
        revenue += f.revenue;
      }
      // No revenue ⇒ no margin. NOT 0%, which reads as breaking even, and not
      // a division that would hand `Infinity` / `NaN` to the formatter.
      return revenue === 0 ? null : income / revenue;
    }
    // Server costs arrive POSITIVE and every row now RENDERS them positive, so
    // nothing here negates.
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
      switch (r.source) {
        case 'revenue':      return f.revenue;
        case 'gross-profit': return f.grossProfit;
        case 'op-ex':        return f.operatingExpenses;
        // A RENAME of the server's operating profit — no tax, no interest in
        // this model — not a figure derived here.
        case 'net-income':   return f.operatingProfit;
        // The server's own COGS — `revenue − grossProfit` is exactly what
        // `calcFinancials` subtracted, not a re-derivation from units × cost.
        case 'cogs-total':   return f.revenue - f.grossProfit;
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
                      <span className="flex flex-col min-w-0 leading-tight">
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
                    />
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

function PnLCell({
  value,
  row,
  emphasis,
  live,
}: {
  value: number | null;
  row: PnLRow;
  emphasis?: boolean;
  live?: boolean;
}) {
  const liveCls = live ? 'bg-primary-soft/55 border-x border-primary/45' : '';
  // Blank, not "$0.00" — an unscored round and a round that earned nothing are
  // different things. Also how Profit Margin renders a round with no revenue.
  if (value === null) {
    return <td className={clsx('py-2 px-2 text-right num-xs text-text-3', liveCls)}>-</td>;
  }
  // Retained for a row that ever needs to print a leading minus. Nothing does
  // since the 2026-09-17 QA ruling — expenses read positive, and the line they
  // sit on is what says they are costs.
  const isDeduction = row.sign === 'minus';

  let color = 'text-text';
  if (isDeduction) color = value !== 0 ? 'text-fin-cost' : 'text-text-3';
  else if (row.group === 'revenue') color = value > 0 ? 'text-fin-revenue' : 'text-text-3';
  else if (row.group === 'profit')
    // A NEGATIVE result still reads red here — that is the round's outcome, not
    // a deduction, and hiding it would be the one place this sheet lies.
    color = value > 0 ? 'text-fin-profit' : value < 0 ? 'text-danger' : 'text-text';

  const display =
    row.format === 'percent'
      // One decimal: at 0dp a 5.5% and a 5.4% round print identically, which is
      // the comparison this row exists to support.
      ? fmtPct(value, 1)
      : isDeduction && value !== 0
        ? `−${fmt$(Math.abs(value))}`
        : fmt$(value);

  return (
    <td className={clsx('py-2 px-2 text-right whitespace-nowrap', liveCls, emphasis && 'pr-3')}>
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
