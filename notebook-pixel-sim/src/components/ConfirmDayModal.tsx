import { useEffect, useState } from 'react';
import { useGame } from '@/state/store';
import { advanceDay, calcDemandToday } from '@/engine/mockEngine';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelButton, PixelBadge } from '@/components/primitives';
import { MetricIcon, MetricIconKind } from '@/components/icons/MetricIcon';
import { fmt$, fmtInt } from '@/utils/format';
import { mulberry32, seedFrom } from '@/utils/rng';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';

interface Props {
  open: boolean;
  onClose: () => void;
  /** how many days to advance on confirm */
  days: number;
}

export function ConfirmDayModal({ open, onClose, days }: Props) {
  const apply = useGame((s) => s.apply);
  const day = useGame((s) => s.meta.day);
  const cash = useGame((s) => s.player.cash);
  const energy = useGame((s) => s.player.energy);
  const finished = useGame((s) => s.inventory.totalFinished);
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? s.portfolio.productLines[0],
  );
  const channels = useGame((s) => s.channels);
  const ops = useGame((s) => s.ops);
  const pushMascot = useGame((s) => s.pushMascot);

  const [phase, setPhase] = useState<'preview' | 'animating'>('preview');

  useEffect(() => {
    if (open) setPhase('preview');
  }, [open]);

  // Estimate next-day deltas
  const rand = mulberry32(seedFrom(useGame.getState().meta.seed + ':preview:' + (day + 1)));
  const demand = calcDemandToday(useGame.getState(), rand);
  const intDemand = Math.round(demand.total);
  const expectedSold = Math.min(intDemand, finished);
  // product is undefined with an EMPTY portfolio (this component stays
  // mounted while closed) — degrade to $0 instead of crashing the tree.
  const expectedRevenue = expectedSold * (product?.price ?? 0);
  const dailyExpenses = ops.hires * 12 + channels.marketingPerDay;
  const expectedCashChange = expectedRevenue - dailyExpenses;

  const onConfirm = () => {
    setPhase('animating');
    setTimeout(() => {
      apply((s) => advanceDay(s, days));
      // Milestone delight
      const newDay = useGame.getState().meta.day;
      if (newDay % 10 === 0) {
        confetti({
          particleCount: 80,
          spread: 70,
          startVelocity: 35,
          origin: { y: 0.45 },
          colors: ['#5fb27a', '#e6b54a', '#9b56c8', '#8E6CAC', '#e07a6a'],
          ticks: 200,
        });
      }
      pushMascot({
        id: 'day_' + newDay,
        type: expectedCashChange >= 0 ? 'success' : 'hint',
        body:
          expectedCashChange >= 0
            ? `Day ${newDay}. Sold ~${expectedSold} units. Cash up.`
            : `Day ${newDay}. Sales were thin - watch fit and pricing.`,
        priority: 3,
        mood: expectedCashChange >= 0 ? 'happy_soft' : 'thinking_side',
      });
      onClose();
    }, 480);
  };

  return (
    <PixelModal open={open} onClose={phase === 'preview' ? onClose : undefined} hideClose={phase === 'animating'} title={`Confirm Day ${day} → ${day + days}`} width="min(560px, calc(100vw - 32px))">
      <AnimatePresence mode="wait">
        {phase === 'preview' ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <MascotAvatar mood="thinking" size={64} />
              <div className="flex-1 body-xs text-ink-900 leading-snug">
                {days === 1
                  ? 'Lock in your decisions and advance one day. The numbers below are an estimate, not a promise - actual demand is rolled on the day.'
                  : `Skip forward ${days} days. Use this to ramp up Phase 1 quickly.`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <PreviewRow icon="cash" label="Cash now" value={fmt$(cash)} />
              <PreviewRow icon="capacity" label="Energy" value={`${energy}`} />
              <PreviewRow icon="demand" label="Demand est." value={fmtInt(intDemand)} hint="next day" />
              <PreviewRow icon="stock" label="Finished stock" value={fmtInt(finished)} hint="available to sell" />
            </div>

            <div className="bg-cream-100 border-2 border-ink-900 px-3 py-2.5 shadow-pixel-1">
              <div className="eyebrow eyebrow-sm text-ink-700 mb-1.5">Estimated next-day impact</div>
              <ul className="body-xs text-ink-900 leading-snug space-y-0.5">
                <li>· Likely sold: <strong>{expectedSold}</strong> units</li>
                <li>· Revenue est.: <strong>{fmt$(expectedRevenue)}</strong></li>
                <li>· Daily expenses: <strong>{fmt$(dailyExpenses)}</strong></li>
                <li>
                  · Net cash change:{' '}
                  <strong className={expectedCashChange >= 0 ? 'text-success' : 'text-error'}>
                    {expectedCashChange >= 0 ? '+' : ''}
                    {fmt$(expectedCashChange)}
                  </strong>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {expectedSold === 0 && finished === 0 && (
                <PixelBadge tone="error">No stock - set Produce / day first</PixelBadge>
              )}
              {finished > intDemand * 5 && intDemand > 0 && (
                <PixelBadge tone="warn">Overstock risk</PixelBadge>
              )}
              {intDemand > finished && finished > 0 && (
                <PixelBadge tone="warn">Stockout risk - demand &gt; stock</PixelBadge>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <PixelButton variant="ghost" onClick={onClose}>Cancel</PixelButton>
              <PixelButton variant="primary" size="lg" onClick={onConfirm}>
                Confirm · advance {days === 1 ? '1 day' : `${days} days`}
              </PixelButton>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="anim"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="flex flex-col items-center justify-center py-8 gap-3 min-h-[220px]"
          >
            <MascotAvatar mood="happy_soft" size={72} />
            <div className="eyebrow eyebrow-sm text-ink-900">Advancing day…</div>
            <div className="body-xs text-ink-700">Reading the numbers</div>
          </motion.div>
        )}
      </AnimatePresence>
    </PixelModal>
  );
}

function PreviewRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: MetricIconKind;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-cream-50 border-2 border-ink-900 px-2.5 py-2">
      <MetricIcon kind={icon} size={26} tone="cream" />
      <div className="flex-1 leading-tight">
        <div className="eyebrow eyebrow-sm text-ink-700">{label}</div>
        <div className="eyebrow eyebrow-sm text-ink-900">{value}</div>
        {hint && <div className="hint text-ink-700">{hint}</div>}
      </div>
    </div>
  );
}
