import { useGame } from '@/state/store';
import { fmt$ } from '@/utils/format';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';
import { computeUserProjection } from '@/gamesim/computeUserProjection';
import type { ServerProjectionResult } from '@/gamesim/sync';
import { motion, useReducedMotion } from 'framer-motion';
import { Tooltip } from '@/components/primitives/Tooltip';
import clsx from 'clsx';

/**
 * Top-bar dashboard — a SUMMARY of the "User Projection" section below the
 * canvas, never a second opinion on it. Both call `computeUserProjection`, so
 * the chip and the sheet are the same numbers by construction.
 *
 * This used to run the local FinLit engine (`previewFinlitPhase`) at the
 * player's current settings, which gave the header its own demand model, its
 * own price and its own unit cost — none of them the ones the section showed,
 * and none of them aware of the business page's `dynamic_cost` impacts. That
 * engine is no longer read here.
 *
 * The old Customer Satisfaction figure went with it: it was computed from the
 * FinLit fit model and never rendered.
 */
export function CanvasStatusStrip({ liveProjection }: { liveProjection: ServerProjectionResult | null }) {
  const lines = useGame((s) => s.portfolio.productLines);
  if (lines.length === 0) return null;

  const { revenue, profit } = computeUserProjection(lines, liveProjection?.byProduct);
  const profitTone: Tone = profit == null ? 'warn' : profit >= 0 ? 'good' : 'bad';

  return (
    <div className="flex items-stretch gap-1.5 min-w-0">
      <Kpi
        icon="revenue"
        label="Proj. Revenue"
        value={fmt$(Math.round(revenue))}
        tone="revenue"
        tip="Your price against your own demand estimate, capped by what each line can produce. Same figure as Est. revenue in User Projection below."
      />
      <Kpi
        icon="profit"
        label="Proj. Profit"
        value={profit == null ? '–' : `${profit >= 0 ? '' : '−'}${fmt$(Math.abs(profit))}`}
        tone={profitTone}
        tip={
          profit == null
            ? 'Waiting for the server projection — the per-unit cost comes from there.'
            : 'Gross profit: projected revenue minus the cost of the same units. Operating expenses are not deducted — those land in Actual Results.'
        }
      />
    </div>
  );
}

type Tone = 'good' | 'bad' | 'warn' | 'revenue';

// High-contrast light cards on the dark HUD bar. Value colour carries the
// signal; the label stays quiet so the number reads first.
// The -INK weights, not the bright pastels. The three-weight rule was written
// for TEXT and never applied to icon strokes, and these icons sit on a caramel
// (#DEC189) tile: --c-warning is #DDA655, which is the same colour as its own
// background to within a few percent, and --c-fin-revenue fared little better.
// A 2px stroke is thinner than a letterform, so if anything it needs MORE
// contrast than text, not less.
const tones: Record<Tone, { value: string; icon: string }> = {
  good:    { value: 'text-success',     icon: 'var(--c-success-ink)' },
  bad:     { value: 'text-danger',      icon: 'var(--c-danger-ink)' },
  warn:    { value: 'text-warning',     icon: 'var(--c-warning-ink)' },
  revenue: { value: 'text-fin-revenue', icon: 'var(--c-fin-revenue-ink)' },
};

function Kpi({
  icon,
  label,
  value,
  tone,
  tip,
}: {
  icon: PixelIconKind;
  label: string;
  value: string;
  tone: Tone;
  tip: string;
}) {
  const t = tones[tone];
  const reduced = useReducedMotion();
  return (
    <Tooltip content={tip} placement="bottom">
      {/* READOUT card — recessed (inset shadow), not a button. */}
      <div className="inline-flex items-center gap-2 border border-border-soft bg-surface px-3 py-1.5 leading-none shadow-[inset_1.5px_1.5px_0_rgba(0,0,0,0.09)] min-w-0">
        <span className="inline-flex items-center justify-center w-7 h-7 border border-border-soft bg-surface-2 shrink-0">
          <PixelIcon kind={icon} size={14} color={t.icon} />
        </span>
        <span className="flex flex-col gap-0.5 min-w-0">
          {/* The label DROPS below xl rather than truncating. Three cards with
              their full labels need ~530px of track; below xl there is closer
              to 340px, which squeezed "Proj. Revenue" down to "Proj. R…" on
              every card. A mangled word is worse than no word when the icon
              already says which metric this is and the tooltip spells it out.
              The VALUE is never hidden and never truncated — it is the only
              thing on the card the player is actually reading. */}
          <span className="hidden xl:block eyebrow eyebrow-sm text-text-2 truncate">{label}</span>
          {/* keyed pop — the number ticks whenever the projection changes.
              Clean bold numerals (not the blocky arcade font) so the value
              stays prominent without overpowering its label. */}
          <motion.span
            key={value}
            initial={reduced ? false : { scale: 1.22 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={clsx('num-xs leading-none inline-block', t.value)}
          >
            {value}
          </motion.span>
        </span>
      </div>
    </Tooltip>
  );
}
