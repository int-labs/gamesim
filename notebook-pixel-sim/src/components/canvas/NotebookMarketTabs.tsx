// The "who wants this" and "how big is it" halves of the Notebook Details
// modal.
//
// EVERY NUMBER HERE IS LIVE DATA, not illustration:
//   • FIELD_CONFIG[genre][field].direction — the operator's Voice-of-Customer
//                         weight, read off the real Product documents by
//                         `hydrateFieldConfig`. This is what the SERVER scores
//                         with, in `calcFinancials`' dynamicPrice:
//                             sum += resolved × bellFactor × field.direction
//                         Plotted as an interest LINE on a scale shared by every
//                         market, plus a rank. NOT as a share: these weights do
//                         not sum to 1 (live sums run 0.62-0.94), so a per-market
//                         percentage inflated whichever market summed lowest.
//   • GENRES[].demand   — the per-phase addressable market curve.
//
// The V2 SEGMENT axis is GONE (2026-09-14) — `data/segments.ts`,
// `GENRE_TO_SEGMENT` and the `students | creators | professionals | gift` union
// had no backend counterpart to re-source from, and a notebook IS its market
// now. Do not reintroduce a frontend table to name the buyers; if segments
// return they come from the SEGMENTS collection.
//
// This header used to claim the bars came from `GENRES[].voc`, "the exact
// weights vocFit() uses". That was already false: the code reads FIELD_CONFIG,
// and `vocFit()` is the obsolete local VoC model the server does not use. Do
// not point these bars back at it.
//
// TYPOGRAPHY: use the shared scale in src/styles/index.css, never ad-hoc sizes.
//   .h3 / .section-title  headings (VT323, 16-18px)
//   .eyebrow-*            uppercase labels (Inter 700, tracked)
//   .num-*                ALL numerals (Inter 700, tabular-nums)
//   .body-*               sentences (Jura 600)
// Numerals are never set in a pixel face: digits like 9,752 turn to mush.

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { GENRES, genreGrowth, growthCoefficient, type GenreDef, type GenreId } from '@/engine/finlit/core/config/genres';
import {
  driverAxes,
  priceAnchorCost,
  priceSensitivity,
  type DriverAxis,
} from '@/engine/finlit/core/config/fieldConfig';
import { fmt$ } from '@/utils/format';
import { driverCopy } from '@/engine/finlit/core/config/drivers';
import { PixelBadge } from '@/components/primitives';
import type { Archetype } from '@/types';

// The "What they weigh" rows are DERIVED — `driverAxes(genreId)` reads the
// product's own fields, in the operator's `order`, labelled with their own
// `label`. A hardcoded six-key list used to live here; see the note on
// `driverAxes` for what that broke. Hints come from the operator too, via
// PlayerConfig's `drivers` section.

// `p0` is labelled "Pre" — it is the market BEFORE the run starts, which is what
// the player is reading it as. There used to be a fifth column ahead of it for
// the sheet's year −1; that column belongs to a printed edition of the copy and
// said nothing here, so two adjacent columns both read as "before we began".
const PHASES = [
  { key: 'p0', label: 'Pre' },
  { key: 'p1', label: 'P1' },
  { key: 'p2', label: 'P2' },
  { key: 'p3', label: 'P3' },
] as const;

/**
 * Is this card the notebook currently being designed?
 *
 * It used to ask whether the notebook's `bestFor` segment list included the
 * segment this market mapped to — a curated fit across two axes. Those axes have
 * collapsed: a notebook IS its market, so the only honest comparison left is
 * identity. The numbers on the card are what distinguish the markets; this only
 * says which one you are looking at from.
 */
function isSameMarket(genre: GenreId, arch: Archetype): boolean {
  return genre === arch;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * The tallest driver weight across EVERY market — the shared y-scale for the
 * interest lines.
 *
 * Shared on purpose: it is what makes the four cards comparable. This replaced a
 * `weightShare()` that normalised each market's weights to sum to 100%, which
 * looked tidy and was wrong — `direction` values do NOT sum to 1 (live sums run
 * 0.62 to 0.94), so dividing by each market's own total inflated the small-sum
 * markets. `paper_material` is 0.091 on both Anime and Cutesy, and rendered as
 * 14.7% on one card and 9.7% on the other. Cross-market comparison is the whole
 * point of this tab, and the percentage was the part that broke it.
 *
 * Lazy, never memoised at module scope — FIELD_CONFIG is filled at boot.
 */
function maxDriverWeight(): number {
  let max = 0;
  for (const g of GENRES) {
    for (const a of driverAxes(g.id)) max = Math.max(max, a.direction);
  }
  return max;
}

/** Axis keys ordered strongest-first, so a driver's RANK within its market is
 *  its index here. Ties keep the operator's own field order. */
function rankOrder(axes: DriverAxis[]): string[] {
  return [...axes].sort((a, b) => b.direction - a.direction).map((a) => a.key);
}

// ── Tab 2 · Buyer Interest ───────────────────────────────────────────────────

export function BuyerInterestTab({ arch }: { arch: Archetype }) {
  const ranked = [...GENRES].sort(
    (a, b) => Number(isSameMarket(b.id, arch)) - Number(isSameMarket(a.id, arch)),
  );
  const scaleMax = maxDriverWeight();

  return (
    <div className="flex flex-col gap-4">
      <p className="body-xs text-text-2">
        Every market buys notebooks, and each one weighs your decisions differently. The line traces
        how much a market cares about each axis, on the same scale across all of them — a higher peak
        really is a stronger preference. Build toward a market's #1 and the same notebook sells more.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {ranked.map((g, i) => (
          <MarketCard key={g.id} genre={g} arch={arch} index={i} scaleMax={scaleMax} />
        ))}
      </div>
    </div>
  );
}

function MarketCard({
  genre,
  arch,
  index,
  scaleMax,
}: {
  genre: GenreDef;
  arch: Archetype;
  index: number;
  /** Shared across all four cards — see `maxDriverWeight`. */
  scaleMax: number;
}) {
  const fit = isSameMarket(genre.id, arch);
  // Derived per render, never memoised at module scope: `FIELD_CONFIG` is filled
  // at boot by `hydrateFieldConfig`, so a snapshot taken on import would freeze
  // an empty table. See the container-hydration rule in CLAUDE.md.
  const axes = driverAxes(genre.id);

  return (
    <motion.div
      className={clsx(
        'border-2 bg-cream-50 shadow-pixel-1 flex flex-col',
        fit ? 'border-ink-900' : 'border-ink-700/35',
      )}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 260, damping: 20 }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 320, damping: 16 } }}
    >
      <div
        className={clsx(
          'flex items-center justify-between gap-2 px-3.5 py-2.5 border-b-2',
          fit ? 'border-ink-900 bg-success-soft' : 'border-ink-700/35 bg-cream-200',
        )}
      >
        <div className="h3 uppercase text-ink-900">{genre.name}</div>
        <PixelBadge tone={fit ? 'success' : 'neutral'}>{fit ? 'This notebook' : 'Other market'}</PixelBadge>
      </div>

      <div className="p-3.5 flex flex-col gap-3.5">
        <p className="body-xs text-text-2">{genre.blurb}</p>

        {/* All three read the operator's PRODUCT FIELDS. They previously read a
            bundled `data/segments.ts` table, for a segment `GENRE_TO_SEGMENT`
            may only have guessed at — neither exists now. */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Market now" value={fmt(genre.demand.p0)} note="units of demand" delay={0.05 * index} />
          <Stat
            label="Price anchor"
            value={fmt$(priceAnchorCost(genre.id))}
            note="costs, at a lean build"
            delay={0.05 * index + 0.05}
          />
          {/* No figure here on purpose — whether a market tolerates a price
              change is the whole decision; a "±$X" would invite arithmetic
              against a curve that pivots on a server-side `dynamicPrice`. */}
          <Stat
            label="Price sens."
            value={priceSensitivity(genre.id).label}
            note="how much price matters"
            delay={0.05 * index + 0.1}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="stat-label">What they weigh</div>
          {axes.length === 0 ? (
            // No fields for this genre means `hydrateFieldConfig` matched no
            // product to it — say so, rather than render an empty chart that
            // reads as "buyers weigh nothing".
            <div className="body-xs text-text-3 italic">No decision axes configured for this market.</div>
          ) : (
            <VocInterestChart axes={axes} scaleMax={scaleMax} delay={0.05 * index} />
          )}
        </div>

        {/* The buyer description that sat here came from the deleted
            `data/segments.ts`. `genre.blurb` above says who wants this
            notebook, from the operator's own copy. */}
      </div>
    </motion.div>
  );
}

function Stat({ label, value, note, delay = 0 }: { label: string; value: string; note: string; delay?: number }) {
  return (
    <motion.div
      className="bg-surface-2 border border-border-soft px-2.5 py-2.5 min-w-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
    >
      <div className="stat-label truncate">{label}</div>
      <div className="num-md text-ink-900 mt-1.5 truncate">{value}</div>
      <div className="body-xs text-text-3 truncate">{note}</div>
    </motion.div>
  );
}

/** A 10-pip pixel meter, same visual language as the HUD's energy/cash bars. */
/**
 * FLAGGED — the meter form is wrong for this data, and it is not a tuning issue.
 *
 * `value` is a share of a market's total weight across SIX axes, so the shares
 * sum to 1 and the average is ~0.167. Against a 0–1 pip scale that is 1–2 pips
 * filled, and even a dominant axis at 40% only reaches 4 of 10. The bar can
 * never fill, which reads as "everything is low" rather than "this is the split".
 *
 * The numbers and the distribution are correct; the CONTAINER is the problem.
 * Candidates, not yet decided:
 *
 *   • A single stacked 100% bar — six segments in one track. This is what a
 *     share-of-total actually is, it fills by construction, and
 *     `PixelStackedBar` already exists (used for the cost mix).
 *   • Normalise each bar against the market's largest axis, so the top axis is
 *     always full. Shows shape within a market, but loses comparability BETWEEN
 *     markets — two markets with identical shapes look identical even if one
 *     weighs everything twice as hard.
 *   • Drop the meter and rank the axes with percentages only.
 *
 * Do NOT "fix" this by scaling `value` up — that would misreport the share.
 */
/**
 * The interest graph: one point per decision axis, in the operator's own field
 * order, joined into a line.
 *
 * NO figure is printed. `direction` is a coefficient `calcFinancials` feeds into
 * dynamicPrice — not a share, not a percentage, and not something a player can
 * do arithmetic with. What they can act on is the SHAPE (which axes this market
 * spikes on) and the RANK (#1 is where the money goes first), so that is what
 * this shows. Same reasoning as the price-sensitivity chip next to it.
 *
 * The y-scale is shared across all four cards, so a peak that looks taller IS
 * taller — the comparison the tab is for.
 */
function VocInterestChart({
  axes,
  scaleMax,
  delay,
}: {
  axes: DriverAxis[];
  scaleMax: number;
  delay: number;
}) {
  const order = rankOrder(axes);
  const W = 300;
  const H = 74;
  const padX = 6;
  const padY = 8;
  const span = W - padX * 2;
  const step = axes.length > 1 ? span / (axes.length - 1) : 0;
  const x = (i: number) => padX + i * step;
  const y = (v: number) => padY + (H - padY * 2) * (1 - (scaleMax > 0 ? v / scaleMax : 0));

  const pts = axes.map((a, i) => `${x(i)},${y(a.direction)}`).join(' ');
  const area = `${padX},${H - padY} ${pts} ${padX + (axes.length - 1) * step},${H - padY}`;

  return (
    <div className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        role="img"
        aria-label="Relative buyer interest across each decision axis"
      >
        <polygon points={area} fill="rgba(154,107,58,0.14)" />
        <motion.polyline
          points={pts}
          fill="none"
          stroke="var(--c-primary-strong)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay, duration: 0.5, ease: 'easeOut' }}
        />
        {axes.map((a, i) => (
          <circle
            key={a.key}
            cx={x(i)}
            cy={y(a.direction)}
            r={order[0] === a.key ? 4 : 2.5}
            fill={order[0] === a.key ? 'var(--c-primary-strong)' : 'var(--c-surface)'}
            stroke="var(--c-primary-strong)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* The axis legend carries the rank — the chart shows shape, this says
          which point is which and where it places. */}
      <div className="flex flex-col gap-[3px]">
        {axes.map((a) => {
          const copy = driverCopy(a.key);
          const rank = order.indexOf(a.key) + 1;
          return (
            <div key={a.key} className="flex items-center gap-2 hint text-text-2" title={copy.hint}>
              <span
                className={clsx(
                  'num-xs w-[22px] shrink-0 text-right',
                  rank === 1 ? 'text-primary-strong' : 'text-text-3',
                )}
              >
                #{rank}
              </span>
              <span className={clsx('truncate', rank === 1 && 'text-text strong')}>
                {copy.label ?? a.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// `VocBar` was DELETED here on 2026-09-14 with the normalised share it drew.
// `VocInterestChart` above replaces it: shape + rank on a shared scale, no
// percentage, because `direction` is a coefficient and not a share of a whole.


// ── Tab 3 · Market Data ──────────────────────────────────────────────────────

export function MarketDataTab({ arch }: { arch: Archetype }) {
  const maxDemand = Math.max(...GENRES.flatMap((g) => PHASES.map((p) => g.demand[p.key])));
  const totalNow = GENRES.reduce((sum, g) => sum + g.demand.p0, 0);
  const totalEnd = GENRES.reduce((sum, g) => sum + g.demand.p3, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="body-xs text-text-2">
        Addressable demand per market across the run. Every market grows. The question is which one
        grows fastest, and whether this notebook is built for it.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Counted, not hardcoded: `4` was a frontend baseline that would have
            kept saying 4 the moment an operator published a fifth notebook. */}
        <Stat label="Markets" value={String(GENRES.length)} note="all sellable" delay={0} />
        {/* "Pre", matching the column label — this reads the same `p0`. */}
        <Stat label="Demand pre" value={fmt(totalNow)} note="all markets" delay={0.05} />
        <Stat label="By Phase 3" value={fmt(totalEnd)} note="all markets" delay={0.1} />
        <Stat
          label="Total growth"
          value={totalEnd > 0 ? `+${Math.round(growthCoefficient(totalNow, totalEnd) * 100)}%` : '—'}
          note="pre to P3"
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GENRES.map((g, i) => (
          <DemandChart key={g.id} genre={g} max={maxDemand} arch={arch} index={i} />
        ))}
      </div>

      <DemandTable arch={arch} />
    </div>
  );
}

/** Hand-built bars. The codebase deliberately ships no chart library. */
function DemandChart({ genre, max, arch, index }: { genre: GenreDef; max: number; arch: Archetype; index: number }) {
  const fit = isSameMarket(genre.id, arch);
  const growth = Math.round(genreGrowth(genre, 'p0', 'p3') * 100);

  return (
    <motion.div
      className={clsx('border-2 bg-cream-50 shadow-pixel-1 p-3.5', fit ? 'border-ink-900' : 'border-ink-700/35')}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, type: 'spring', stiffness: 260, damping: 20 }}
      whileHover={{ y: -3, transition: { type: 'spring', stiffness: 320, damping: 16 } }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h3 uppercase text-ink-900">{genre.name}</div>
        <PixelBadge tone={fit ? 'success' : 'neutral'}>+{growth}%</PixelBadge>
      </div>

      {/* items-stretch (not items-end) is required: with items-end the columns
          size to their content, so the flex-1 track has no free space to grow
          into and every bar collapses to its borders. */}
      <div className="flex items-stretch gap-2 h-[108px]">
        {PHASES.map((p, i) => {
          const v = genre.demand[p.key];
          const pct = Math.max(0.04, v / max);
          return (
            <div key={p.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className="num-xs text-ink-900">{Math.round(v / 1000)}k</div>
              {/* `relative` + an absolutely-positioned bar is load-bearing: a
                  percentage height on a normal-flow child of a flex-1 track
                  resolves against `auto`, and since the bar is an empty div
                  that collapses to 0 (you see only its borders). Absolute
                  positioning resolves the % against the track's real box. */}
              <div className="w-full flex-1 relative min-h-0">
                {/* Height is static and only scaleY animates: it keeps the
                    grow-up motion off the layout path (compositor-only). */}
                <motion.div
                  className={clsx('absolute inset-x-0 bottom-0 border-2 border-ink-900', fit ? 'bg-ui-primary' : 'bg-cream-200')}
                  style={{ height: `${pct * 100}%`, transformOrigin: 'bottom' }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.06 * index + i * 0.06, type: 'spring', stiffness: 220, damping: 18 }}
                />
              </div>
              <div className="stat-label">{p.label}</div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function DemandTable({ arch }: { arch: Archetype }) {
  return (
    <div className="border-2 border-ink-900 bg-cream-50 shadow-pixel-1 overflow-x-auto">
      <table className="w-full border-collapse min-w-[520px]">
        <thead>
          <tr className="bg-cream-200 border-b border-border-soft">
            <th className="stat-label text-left px-3.5 py-3">Market</th>
            {PHASES.map((p) => (
              <th key={p.key} className="stat-label text-right px-3.5 py-3">
                {p.label}
              </th>
            ))}
            <th className="stat-label text-right px-3.5 py-3">Growth</th>
          </tr>
        </thead>
        <tbody>
          {GENRES.map((g) => {
            const fit = isSameMarket(g.id, arch);
            return (
              <tr
                key={g.id}
                className={clsx('border-b border-border-soft last:border-b-0', fit && 'bg-success-soft/40')}
              >
                <td className="px-3.5 py-2.5 item-name text-text whitespace-nowrap">{g.name}</td>
                {PHASES.map((p) => (
                  <td key={p.key} className="px-3.5 py-2.5 text-right num-xs text-ink-900">
                    {fmt(g.demand[p.key])}
                  </td>
                ))}
                <td className="px-3.5 py-2.5 text-right num-xs text-success">
                  +{Math.round(genreGrowth(g, 'p0', 'p3') * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
