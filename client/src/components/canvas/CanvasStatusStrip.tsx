import { useMemo } from 'react';
import { useGame } from '@/state/store';
import { fmt$ } from '@/utils/format';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';
import { previewFinlitPhase } from '@/engine/mockEngine';
import { vocFit } from '@/engine/finlit/fit';
import type { GenreId, ProductionSpec, ChannelId } from '@/data/finlit';
import { motion, useReducedMotion } from 'framer-motion';
import { Tooltip } from '@/components/primitives/Tooltip';
import clsx from 'clsx';

const DEFAULT_SPEC: ProductionSpec = {
  type: 'indie', paper: 'cream', size: 'a5', pageDesign: 'lined', addon: 'bookmark', cover: 'plastic',
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Top-bar dashboard — the run's THREE headline outcomes, projected from the
 * live FinLit engine at the player's current settings:
 *
 *   • Projected Revenue  — gross sales if this phase ran now
 *   • Projected Profit   — net profit (revenue − COGS − opex − channel)
 *   • Customer Satisfaction — blends product fit (do they like it?) with
 *                             fill-rate (could they buy it?)
 *
 * Replaces the old per-line config pills (Market/Fit/Price/Stock/…) — those
 * live on the Product page where you edit; the top bar answers "how am I
 * doing?", not "what am I building?".
 */
export function CanvasStatusStrip() {
  const hasLines = useGame((s) => s.portfolio.productLines.length > 0);

  // A compact signature of everything the projection depends on — the memo
  // recomputes only when one of these actually changes (price/spec/target/
  // channels/genre/hire/marketing/decision-mults/stock), never per render.
  const sig = useGame((s) => {
    const parts: string[] = [
      `p${s.meta.phase}`,
      `h${s.finlit.hire?.candidate ?? ''}:${s.finlit.hire?.level ?? ''}`,
      `mb${s.finlit.marketingBudget}`,
      `sb${s.finlit.salesBudget}`,
      `dm${s.finlit.demandMult ?? 1}`,
      `sm${s.finlit.sellMult ?? 1}`,
    ];
    for (const l of s.portfolio.productLines) {
      parts.push(
        `${l.id}|${l.genre ?? ''}|${l.price}|${l.targetPerDay ?? ''}|` +
        `${(l.channels ?? []).join('.')}|${JSON.stringify(l.finlitSpec ?? {})}|${l.inventory.finished}`,
      );
    }
    return parts.join(';');
  });

  const dash = useMemo(() => {
    if (!hasLines) return null;
    try {
      const st = useGame.getState();
      const res = previewFinlitPhase(st);
      const fill = res.demandTotal > 0 ? Math.min(1, res.soldTotal / res.demandTotal) : 1;

      // Demand-weighted average product fit across the portfolio.
      let wSum = 0;
      let fitSum = 0;
      for (const l of st.portfolio.productLines) {
        const genre = (l.genre ?? 'indie') as GenreId;
        const spec: ProductionSpec = { ...DEFAULT_SPEC, type: genre, ...(l.finlitSpec ?? {}) };
        const chs = (l.channels ?? ['offline']) as ChannelId[];
        const f = vocFit(spec, l.price, chs, genre);
        const w = Math.max(1, res.byLine.find((b) => b.lineId === l.id)?.demand ?? 1);
        wSum += w;
        fitSum += f * w;
      }
      const avgFit = wSum > 0 ? fitSum / wSum : 1;
      // Map VoC fit (0.6–1.2, 1.0 = neutral) onto a 0–1 desirability score.
      const fitScore = clamp01((avgFit - 0.6) / 0.55);
      const satisfaction = Math.round(100 * (0.5 * fill + 0.5 * fitScore));

      return {
        revenue: Math.round(res.revenue),
        profit: Math.round(res.netProfit),
        satisfaction,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, hasLines]);

  if (!dash) return null;

  const profitTone: Tone = dash.profit >= 0 ? 'good' : 'bad';
  const satTone: Tone = dash.satisfaction >= 80 ? 'good' : dash.satisfaction >= 55 ? 'warn' : 'bad';

  return (
    <div className="flex items-stretch gap-1.5 shrink-0">
      <Kpi
        icon="revenue"
        label="Proj. Revenue"
        value={fmt$(dash.revenue)}
        tone="revenue"
        tip="Projected gross sales if this phase ran at your current settings."
      />
      <Kpi
        icon="profit"
        label="Proj. Profit"
        value={`${dash.profit >= 0 ? '' : '−'}${fmt$(Math.abs(dash.profit))}`}
        tone={profitTone}
        tip="Projected net profit this phase - revenue minus materials, wages, marketing and channel costs."
      />
      <Kpi
        icon="fit"
        label="Satisfaction"
        value={`${dash.satisfaction}%`}
        tone={satTone}
        tip="How happy customers are - blends product fit (do they like it?) with how much demand you can actually fill."
      />
    </div>
  );
}

type Tone = 'good' | 'bad' | 'warn' | 'revenue';

// High-contrast light cards on the dark HUD bar. Value colour carries the
// signal; the label stays quiet so the number reads first.
const tones: Record<Tone, { value: string; icon: string }> = {
  good:    { value: 'text-success',     icon: 'var(--c-success)' },
  bad:     { value: 'text-danger',      icon: 'var(--c-danger)' },
  warn:    { value: 'text-warning',     icon: 'var(--c-warning)' },
  revenue: { value: 'text-fin-revenue', icon: 'var(--c-fin-revenue)' },
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
      <div className="inline-flex items-center gap-2 border-2 border-border-soft bg-surface px-3 py-1.5 leading-none shadow-[inset_1.5px_1.5px_0_rgba(0,0,0,0.09)]">
        <span className="inline-flex items-center justify-center w-7 h-7 border border-border-soft bg-surface-2 shrink-0">
          <PixelIcon kind={icon} size={14} color={t.icon} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-text-2">{label}</span>
          {/* keyed pop — the number ticks whenever the projection changes.
              Clean bold numerals (not the blocky arcade font) so the value
              stays prominent without overpowering its label. */}
          <motion.span
            key={value}
            initial={reduced ? false : { scale: 1.22 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={clsx('text-[16px] font-extrabold tabular-nums leading-none inline-block', t.value)}
          >
            {value}
          </motion.span>
        </span>
      </div>
    </Tooltip>
  );
}
