// The "who wants this" and "how big is it" halves of the Notebook Details
// modal.
//
// EVERY NUMBER HERE IS LIVE ENGINE DATA, not illustration:
//   • GENRES[].voc      — the exact weights `vocFit()` uses to score a design,
//                         so the preference bars literally show what the demand
//                         multiplier is built from.
//   • GENRES[].demand   — the per-phase addressable market curve.
//   • SEGMENTS[]        — buyer economics (price anchor, sensitivity, pull).
// The genre/segment bridge is GENRE_TO_SEGMENT from the engine facade, so this
// UI can never drift from what the simulation actually rewards.
//
// TYPOGRAPHY: use the shared scale in src/styles/index.css, never ad-hoc sizes.
//   .h3 / .section-title  headings (VT323, 16-18px)
//   .eyebrow-*            uppercase labels (Inter 700, tracked)
//   .num-*                ALL numerals (Inter 700, tabular-nums)
//   .body-*               sentences (Jura 600)
// Numerals are never set in a pixel face: digits like 9,752 turn to mush.

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { GENRES, genreGrowth, type GenreDef, type GenreId } from '@/engine/finlit/core/config/genres';
import { GENRE_TO_SEGMENT } from '@/engine/mockEngine';
import { segmentById } from '@/data/segments';
import { ARCHETYPE_INFO } from '@/data/notebookArchetypes';
import { PixelBadge } from '@/components/primitives';
import type { Archetype } from '@/types';

/** The five decision axes every market weighs, in the engine's own order. */
const VOC_AXES = [
  { key: 'design', label: 'Design', hint: 'Cover, page design and add-ons' },
  { key: 'paper', label: 'Paper', hint: 'Paper stock quality' },
  { key: 'price', label: 'Price', hint: 'How hard price mismatch is punished' },
  { key: 'size', label: 'Size', hint: 'Format and page count' },
  { key: 'channel', label: 'Channel', hint: 'Where it is actually stocked' },
] as const;

const PHASES = [
  { key: 'pMinus1', label: 'Pre' },
  { key: 'p0', label: 'Now' },
  { key: 'p1', label: 'P1' },
  { key: 'p2', label: 'P2' },
  { key: 'p3', label: 'P3' },
] as const;

/**
 * Curated fit: does this notebook's `bestFor` list include the segment this
 * market maps to? Deliberately a two-state answer rather than a fabricated
 * score. The honest numbers are on the card, and reading them is the lesson.
 */
function fitsArchetype(genre: GenreId, arch: Archetype): boolean {
  return ARCHETYPE_INFO[arch].bestFor.includes(GENRE_TO_SEGMENT[genre]);
}

const fmt = (n: number) => n.toLocaleString('en-US');

// ── Tab 2 · Buyer Interest ───────────────────────────────────────────────────

export function BuyerInterestTab({ arch }: { arch: Archetype }) {
  const ranked = [...GENRES].sort(
    (a, b) => Number(fitsArchetype(b.id, arch)) - Number(fitsArchetype(a.id, arch)),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="body-xs text-text-2">
        Four markets buy notebooks, and each one weighs your decisions differently. The bars show how
        much a market cares about each axis. Align the tall bars and the same notebook sells more.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {ranked.map((g, i) => (
          <MarketCard key={g.id} genre={g} arch={arch} index={i} />
        ))}
      </div>
    </div>
  );
}

function MarketCard({ genre, arch, index }: { genre: GenreDef; arch: Archetype; index: number }) {
  const seg = segmentById(GENRE_TO_SEGMENT[genre.id]);
  const fit = fitsArchetype(genre.id, arch);

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
        <PixelBadge tone={fit ? 'success' : 'neutral'}>{fit ? 'Best for' : 'Stretch'}</PixelBadge>
      </div>

      <div className="p-3.5 flex flex-col gap-3.5">
        <p className="body-xs text-text-2">{genre.blurb}</p>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Market now" value={fmt(genre.demand.p0)} note="units of demand" delay={0.05 * index} />
          <Stat label="Price anchor" value={`$${seg.preferredPriceRef}`} note="what feels right" delay={0.05 * index + 0.05} />
          <Stat
            label="Price sens."
            value={`${seg.priceSensitivity}x`}
            note={seg.priceSensitivity >= 1.3 ? 'very picky' : seg.priceSensitivity >= 0.9 ? 'moderate' : 'tolerant'}
            delay={0.05 * index + 0.1}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="stat-label">What they weigh</div>
          {VOC_AXES.map((axis, i) => (
            <VocBar
              key={axis.key}
              label={axis.label}
              hint={axis.hint}
              value={genre.voc[axis.key]}
              delay={0.05 * index + 0.04 * i}
            />
          ))}
        </div>

        <div className="body-xs text-text-2 border-t-2 border-border-soft pt-2.5">
          <span className="strong text-text">{seg.name}.</span> {seg.description}
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, note, delay = 0 }: { label: string; value: string; note: string; delay?: number }) {
  return (
    <motion.div
      className="bg-surface-2 border-2 border-border-soft px-2.5 py-2.5 min-w-0"
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
function VocBar({ label, hint, value, delay }: { label: string; hint: string; value: number; delay: number }) {
  const pips = 10;
  const filled = Math.round(Math.max(0, Math.min(1, value)) * pips);
  return (
    <div className="flex items-center gap-3" title={hint}>
      <div className="stat-label text-text w-[74px] shrink-0">{label}</div>
      {/* Light 1px frame on a soft track. A heavy black box around every row
          made the meters shout louder than the numbers beside them. */}
      <div className="flex gap-[1px] p-[1px] bg-border-soft border border-border-soft flex-1 min-w-0">
        {Array.from({ length: pips }).map((_, i) => (
          <motion.div
            key={i}
            // A filled pip has to be obviously darker than an empty one. The
            // pastel green on the caramel track measured 1.33:1 — well under
            // the 3:1 that adjacent UI needs — so at a glance the meter read as
            // one continuous bar and the value was impossible to eyeball.
            // primary-strong on a cream track is 3.78:1.
            className={clsx('flex-1 h-2.5', i < filled ? 'bg-primary-strong' : 'bg-cream-200')}
            style={{ transformOrigin: 'left' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: delay + i * 0.02, type: 'spring', stiffness: 420, damping: 24 }}
          />
        ))}
      </div>
      <div className="num-xs text-ink-900 w-[32px] text-right shrink-0">{Math.round(value * 100)}</div>
    </div>
  );
}

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
        <Stat label="Markets" value="4" note="all sellable" delay={0} />
        <Stat label="Demand now" value={fmt(totalNow)} note="all markets" delay={0.05} />
        <Stat label="By Phase 3" value={fmt(totalEnd)} note="all markets" delay={0.1} />
        <Stat
          label="Total growth"
          value={`+${Math.round((totalEnd / totalNow - 1) * 100)}%`}
          note="now to P3"
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
  const fit = fitsArchetype(genre.id, arch);
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
          <tr className="bg-cream-200 border-b-2 border-ink-900">
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
            const fit = fitsArchetype(g.id, arch);
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
