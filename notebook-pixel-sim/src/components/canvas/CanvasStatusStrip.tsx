import { useGame } from '@/state/store';
import { fmt$, fmtInt } from '@/utils/format';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';
import { computeUserProjection } from '@/gamesim/computeUserProjection';
import { productScoreFromDynamicPrice } from '@/engine/finlit/core/config/fieldConfig';
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
  const activeLineId = useGame((s) => s.portfolio.activeLineId);
  if (lines.length === 0) return null;

  const { revenue, profit } = computeUserProjection(lines, liveProjection?.byProduct);
  const profitTone: Tone = profit == null ? 'warn' : profit >= 0 ? 'good' : 'bad';

  /**
   * PRODUCT SCORE — the ACTIVE notebook's `dynamicPrice`, ×4.
   *
   * `dynamicPrice` is what the spec decisions are worth: `calcFinancials`
   * builds it as `Σ (resolved × bellFactor × direction)` over the priced
   * fields, and `Σ productScoreBreakdown === dynamicPrice` by construction.
   *
   * It is the CENTER the pricing curve pivots on, and pricing AT it is very
   * close to optimal: `productScore` falls as price rises, but revenue is
   * `price × productScore`, and that product peaks just above the center.
   * Solving it on the overpricing branch gives `p(p − D) = σ²` with
   * `σ = (max − D) / 4` — about 6% above `D`, on a curve flat enough either
   * side that the center is the right thing to aim a player at. Pricing at the
   * FLOOR maximises customer COUNT and roughly halves the money.
   *
   * ⚠ It is NOT the server's `productScore` field, which is a different number
   * (0..1, how the asking price sits against that center). Both ride on the
   * same DTO. The label here is the owner's.
   *
   * Keyed by `productId`, never by position — `byProduct` follows the SERVER's
   * pairing, not portfolio order.
   */
  const activeProductId = (lines.find((l) => l.id === activeLineId) ?? lines[0])?.productId;
  const dynamicPrice = liveProjection?.byProduct
    ?.find((p) => p.productId === activeProductId)?.dynamicPrice;
  // The scale lives with the formula now — the round debrief shows this same
  // figure, and two copies of `* 8` is how they would come to disagree.
  const productScore = productScoreFromDynamicPrice(dynamicPrice);

  return (
    // `gap-2`, matching the Energy/Cash group in TopHUD — these are the same
    // kind of chip now and sit at the same rhythm.
    <div className="flex items-center gap-2 min-w-0">
      <Kpi
        icon="revenue"
        // "Proj. Revenue" / "Proj. Profit" — the qualifier cost more width than
        // it earned in a bar this narrow, and every figure up here is a
        // projection anyway. The tooltip still says so in full.
        label="Revenue"
        value={fmt$(Math.round(revenue))}
        tone="revenue"
        tip="Your price against your own demand estimate, capped by what each line can produce. Same figure as Est. revenue in User Projection below."
      />
      <Kpi
        icon="profit"
        label="Profit"
        value={profit == null ? '–' : `${profit >= 0 ? '' : '−'}${fmt$(Math.abs(profit))}`}
        tone={profitTone}
        tip={
          profit == null
            ? 'Waiting for the server projection — the per-unit cost comes from there.'
            : 'Gross profit: projected revenue minus the cost of the same units. Operating expenses are not deducted — those land in Actual Results.'
        }
      />
      <Kpi
        icon="fit"
        label="Score"
        value={productScore == null ? '–' : fmtInt(Math.round(productScore))}
        tone="warn"
        tip={
          productScore == null
            ? 'Waiting for the server projection — this comes from there.'
            : 'What your design decisions are worth on this notebook. Build more of what its market weighs heavily and it rises — and the more it is worth, the more you can charge before buyers walk.'
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
      {/* SAME SHAPE AS THE ENERGY CHIP — `.game-hud-chip`, then icon, label,
          value as three siblings on one row. It was a taller bespoke card: a
          7x7 bordered icon TILE beside a vertical label-over-value stack, which
          made these two readouts a different height and a different anatomy
          from the chips sitting next to them.

          `.game-hud-chip`'s own background IS `var(--c-surface)` — the same
          `bg-surface` this card already used — so adopting it changes the shape
          and nothing about the colour. NO `-warm` / `-success` variant here:
          those are Energy's caramel and Cash's green, and the tone on these two
          belongs to the VALUE, not the fill. */}
      {/* NOT `shrink-0`. Every chip on this bar was, so the row could not
          compress and simply overflowed its clipped track — chips sliced in
          half, which is the "destroyed" display. These three are the ones that
          should give way: `min-w-0` lets the chip shrink and the LABEL
          truncates, while the icon and the value stay whole. The value is the
          only part anyone is actually reading. */}
      <div className="game-hud-chip min-w-0" role="status" aria-label={`${label}: ${value}`}>
        <PixelIcon kind={icon} size={14} color={t.icon} />
        <span className="stat-label text-text-3 truncate">{label}</span>
        {/* keyed pop — the number ticks whenever the projection changes. */}
        <motion.span
          key={value}
          initial={reduced ? false : { scale: 1.22 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className={clsx('num-xs inline-block shrink-0', t.value)}
        >
          {value}
        </motion.span>
      </div>
    </Tooltip>
  );
}
