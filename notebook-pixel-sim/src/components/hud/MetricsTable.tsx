import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
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
import { useGamesimSession } from '@/gamesim/GamesimProvider';

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

/**
 * Where a row's per-round figure comes from. The named sources read the
 * server's OWN field; `{ costKey }` reads one aggregated `incurredCosts` entry.
 *
 * Nothing is recomputed locally. `grossProfit` and `operatingProfit` are taken
 * verbatim rather than re-derived from their parts — re-deriving is how a sheet
 * drifts from `calcFinancials` by arithmetic even when every input agrees.
 */
type RowSource =
  | 'revenue'
  | 'gross-profit'
  | 'op-ex'
  | 'op-profit'
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
}

/** One round's aggregated `incurredCosts` entry. */
interface CostCell {
  label: string;
  treatment: 'cogs' | 'opex';
  amount: number;
}

// The server emits two fixed entries with authored labels — `inventory` ("Cost
// of goods sold") and `holding` ("Inventory holding") — then one per globalInput
// CATEGORY. Categories are deliberately free-text and operator-owned, so they
// get a generic icon by side rather than a guessed one, and their label renders
// verbatim: it is the operator's own wording, not ours to normalise.
const COST_ICON: Record<string, string> = {
  inventory: A.ui.pnl.material_cost,
  holding: A.ui.pnl.fulfillment_cost,
};
const costIcon = (key: string, treatment: 'cogs' | 'opex'): string =>
  COST_ICON[key] ?? (treatment === 'cogs' ? A.ui.pnl.packaging_cost : A.ui.pnl.marketing_spend);

// The FIXED rows. Row order IS the sheet: derived `cogs` cost rows are spliced
// in ABOVE the Gross Profit subtotal and `opex` rows BELOW it, because that is
// exactly the partition `calcFinancials` computes, and a row on the wrong side
// of the line reads as a different formula than the server ran.
//
// The cost line items are NOT declared here — they come from each round's
// `incurredCosts`, whose categories are operator-configured and so cannot be
// known at build time. The former fixed Material / Labor / Packaging / Tools
// rows were local ledger `kind`s with no server equivalent, permanently $0.
const ROW_REVENUE: PnLRow = {
  label: 'Gross Revenue', icon: A.ui.pnl.gross_revenue, sign: 'plus',
  group: 'revenue', source: 'revenue', cause: 'Units sold × selling price',
};
const ROW_GROSS_PROFIT: PnLRow = {
  label: 'Gross Profit', icon: A.ui.metrics.profit, sign: 'plus', emphasis: 'subtotal',
  group: 'profit', source: 'gross-profit', cause: 'Revenue − COGS, as the server computed it',
};
const ROW_OPEX: PnLRow = {
  label: 'Operating Expenses', icon: A.ui.pnl.fulfillment_cost, sign: 'minus', emphasis: 'subtotal',
  group: 'profit', source: 'op-ex', cause: 'Holding on unsold stock plus every cost declared as opex',
};
const ROW_OP_PROFIT: PnLRow = {
  label: 'Operating Profit', icon: A.ui.pnl.operating_profit, sign: 'plus', emphasis: 'highlight',
  group: 'profit', source: 'op-profit', cause: 'Gross profit − operating expenses',
};
const ROW_CASH: PnLRow = {
  label: 'Cash Balance', icon: A.ui.pnl.net_revenue, sign: 'plus', emphasis: 'highlight',
  group: 'cash', source: 'cash', cause: 'Opening cash plus every scored round’s operating profit',
};

export function FinanceTable() {
  // `player.cash` is the run's OPENING balance — the route's starting capital
  // (self $1,000 / investor $2,500, `store.ts:447`). It is not "cash now":
  // nothing adds profit to it any more, because the running balance is derived
  // from the server's operating profit below. Cash is the one figure with no
  // server field and no other home.
  const openingCash = useGame((s) => s.player.cash);
  const phaseNow = useGame((s) => s.meta.phase);
  const reduced = useReducedMotion();
  // `totalRounds` so the sheet spans the whole run, and the server's per-round
  // financials — the ONLY source for every figure below except cash. Read from
  // the session rather than passed in: `FinanceTable` has two render sites
  // (`BottomStats` and `BusinessPage`) and neither threads props to it.
  const { bootstrap, financialsByRound } = useGamesimSession();
  const totalRounds = bootstrap?.simulation.config?.totalRounds;
  const officialFor = (p: number): OfficialFinancials | null => financialsByRound[p] ?? null;

  // EVERY configured round gets a column, played or not.
  //
  // This used to be the rounds with ledger entries plus the round being played,
  // which meant the sheet only grew a column after a round had been run — the
  // player could not see the shape of the run ahead of them.
  //
  // The empty cells are CORRECT, not a gap to fill. An *actual* figure cannot
  // exist until the administrator approves and calculates the round in the admin
  // panel, so a future round legitimately has nothing to show.
  //
  // When `totalRounds` is absent — standalone play with no server, or a
  // simulation configured before the field existed — this falls back to the
  // round being played, so the sheet still renders what it knows.
  const phases: number[] = (() => {
    const seen = new Set<number>();
    seen.add(phaseNow);
    for (let r = 1; r <= (totalRounds ?? 0); r++) seen.add(r);
    return [...seen].filter((p) => p >= 1).sort((a, b) => a - b);
  })();

  // Per-round cost breakdown, aggregated from the payload.
  //
  // `incurredCosts` is PER PRODUCT (`ProductProjectionDto`), so a round's row is
  // the sum across every product. The grouping key is `treatment:key` because a
  // single category can legitimately land on BOTH sides of the gross-profit line
  // — calcFinancials emits one entry per side — and `key` is already unique per
  // row (`inventory` / `holding` / the category itself).
  const costByRound = new Map<number, Map<string, CostCell>>();
  for (const p of phases) {
    const f = officialFor(p);
    if (!f) continue;
    const m = new Map<string, CostCell>();
    for (const prod of f.byProduct) {
      for (const c of prod.incurredCosts ?? []) {
        const k = c.treatment + ':' + c.key;
        const prev = m.get(k);
        m.set(k, {
          label: c.label,
          treatment: c.treatment,
          amount: (prev?.amount ?? 0) + (c.incurredCost ?? 0),
        });
      }
    }
    costByRound.set(p, m);
  }

  // Cost rows are the UNION across every scored round, so a category that
  // appears only in round 2 still gets a row for the whole sheet.
  const costRows: PnLRow[] = (() => {
    const seen = new Map<string, CostCell>();
    for (const m of costByRound.values()) {
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

  const rows: PnLRow[] = [
    ROW_REVENUE,
    ...costRows.filter((r) => r.group === 'cogs'),
    ROW_GROSS_PROFIT,
    ...costRows.filter((r) => r.group === 'opex'),
    ROW_OPEX,
    ROW_OP_PROFIT,
    ROW_CASH,
  ];

  // Cash is the running balance: opening capital plus every SCORED round's
  // operating profit, cumulative — so a negative operating profit drops it.
  // Unscored rounds contribute 0, which means the balance simply stops moving
  // until the administrator calculates the round.
  const cashThrough = (p: number) =>
    openingCash +
    phases
      .filter((r) => r <= p)
      .reduce((a, r) => a + (officialFor(r)?.operatingProfit ?? 0), 0);

  const computeRow = (r: PnLRow, p: number | 'total'): number | null => {
    if (r.source === 'cash') {
      // Total is the FINAL balance, not a sum of balances.
      const last = phases[phases.length - 1] ?? phaseNow;
      return cashThrough(p === 'total' ? last : p);
    }
    // Server figures are POSITIVE for costs as well as revenue, and `PnLCell`
    // renders the minus sign for a deduction row — which is why nothing here
    // negates. The old ledger convention stored costs negative and had to flip
    // them back; there is no sign juggling left to get wrong.
    const pick = (f: OfficialFinancials): number => {
      if (typeof r.source === 'object') {
        return costByRound.get(f.roundNumber)?.get(r.source.costKey)?.amount ?? 0;
      }
      switch (r.source) {
        case 'revenue':      return f.revenue;
        case 'gross-profit': return f.grossProfit;
        case 'op-ex':        return f.operatingExpenses;
        case 'op-profit':    return f.operatingProfit;
        default:             return 0;
      }
    };
    const at = (q: number) => {
      const f = officialFor(q);
      return f ? pick(f) : 0;
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
            {/* No zero-hiding filter any more. It existed to suppress the fixed
                Material / Labor / Packaging / Tools rows, which were always $0.
                Cost rows are now derived from the payload and only exist when a
                round actually emitted them — `calcFinancials` guards each push
                with `if (cogs !== 0)` / `if (opex !== 0)` — so there is nothing
                left to hide, and hiding would instead drop a real line item
                that happens to net to zero. */}
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
