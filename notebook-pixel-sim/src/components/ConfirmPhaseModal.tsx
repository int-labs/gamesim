import { useEffect, useLayoutEffect, useState } from 'react';
import { useGame } from '@/state/store';
import { advanceDay, calcDemandToday } from '@/engine/mockEngine';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelButton } from '@/components/primitives';
import { fmt$, fmtInt } from '@/utils/format';
import { mulberry32, seedFrom } from '@/utils/rng';
import { motion, AnimatePresence } from 'framer-motion';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import confetti from 'canvas-confetti';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';

const PHASE_END = { 1: 30, 2: 60, 3: 90 } as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Confirm Phase Decision" modal. Runs the simulation forward through the
 * end of the current phase in one click — internally it advances day-by-day,
 * but the user-facing flow is phase-based.
 */
export function ConfirmPhaseModal({ open, onClose }: Props) {
  const apply = useGame((s) => s.apply);
  const day = useGame((s) => s.meta.day);
  const phase = useGame((s) => s.meta.phase);
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

  const [state, setState] = useState<'preview' | 'running'>('preview');

  // Reset to preview SYNCHRONOUSLY when the modal opens. Without this, after
  // a previous run completes and the modal is reopened, React's effect-based
  // reset would only run AFTER the first render — which would briefly flash
  // "Simulating phase…" and could cause UI tools (or fast users) to interact
  // with the wrong state. Using useLayoutEffect makes the reset happen before
  // the next paint.
  useLayoutEffect(() => {
    if (open && state !== 'preview') setState('preview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const target = PHASE_END[phase];
  const daysLeft = Math.max(0, target - day + 1);

  const rand = mulberry32(seedFrom(useGame.getState().meta.seed + ':phase:' + phase));
  const demand = calcDemandToday(useGame.getState(), rand);
  const intDemand = Math.round(demand.total);
  const expectedSold = Math.min(intDemand, finished);
  // product is undefined with an EMPTY portfolio (this component stays
  // mounted while closed) — degrade to $0 instead of crashing the tree.
  const expectedRevenue = expectedSold * (product?.price ?? 0) * daysLeft;
  const dailyExpenses = (ops.hires * 12 + channels.marketingPerDay) * daysLeft;
  const expectedNetCash = expectedRevenue - dailyExpenses;

  const onConfirm = () => {
    setState('running');
    setTimeout(() => {
      apply((s) => advanceDay(s, daysLeft));
      const after = useGame.getState();
      // Audio cue based on outcome — success rising arpeggio if cash
      // grew, gentle warning if it dipped.
      void import('@/audio/audioManager').then((m) => {
        m.playSfx(after.player.cash > cash ? 'success' : 'warning');
      });
      // Celebrate phase complete
      confetti({
        particleCount: 110,
        spread: 90,
        startVelocity: 38,
        origin: { y: 0.4 },
        colors: ['#6FBB85', '#DDA655', '#B98BD4', '#8E6CAC'],
        ticks: 220,
      });
      // Dynamic phase debrief — pushes a short multi-message script so
      // the player can step Previous/Next through cause + suggestion.
      const cashUp = after.player.cash > cash;
      const cashDelta = after.player.cash - cash;
      const stockoutDays = after.inventory.stockoutDays;
      const overstockDays = after.inventory.overstockDays;
      const debriefId = `phase-${phase}-debrief-${Date.now()}`;
      const messages: { body: string; mood: 'happy' | 'thinking_side' | 'pointing_left_explain' | 'concerned_soft' }[] = [];
      if (cashUp) {
        messages.push({
          body: `Phase ${phase} wrapped. Cash up by ${fmt$(cashDelta)} - your audience and price found each other.`,
          mood: 'happy',
        });
      } else {
        messages.push({
          body: `Phase ${phase} wrapped. Cash dipped by ${fmt$(Math.abs(cashDelta))} this run.`,
          mood: 'thinking_side',
        });
      }
      if (stockoutDays >= 3) {
        messages.push({
          body: `You ran out of stock on ${stockoutDays} days - that's demand you couldn't fulfil. Hire a helper or raise your production target.`,
          mood: 'concerned_soft',
        });
      } else if (overstockDays >= 5) {
        messages.push({
          body: `You held overstock for ${overstockDays} days - cash trapped in unsold notebooks. Lower your production target until stock drains.`,
          mood: 'concerned_soft',
        });
      }
      messages.push({
        body: phase < 3
          ? `Open the P&L below to see exactly where money came in and went out, then on to Phase ${phase + 1}.`
          : 'Open the P&L below for the full breakdown - final results next.',
        mood: 'pointing_left_explain',
      });
      messages.forEach((m, i) => {
        pushMascot({
          id: `${debriefId}__${i}`,
          seqId: debriefId,
          seqIndex: i,
          seqLen: messages.length,
          seqTitle: `Phase ${phase} Debrief`,
          type: cashUp && i === 0 ? 'success' : 'debrief',
          body: m.body,
          priority: 2,
          mood: m.mood,
        });
      });
      onClose();
    }, 600);
  };

  return (
    <PixelModal
      open={open}
      onClose={state === 'preview' ? onClose : undefined}
      hideClose={state === 'running'}
      title={`Confirm Phase ${phase} Decisions`}
      width="min(620px, calc(100vw - 32px))"
    >
      <AnimatePresence mode="wait">
        {state === 'preview' ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <MascotAvatar mood="presenting" size={66} />
              <div className="flex-1 body-xs text-text leading-relaxed">
                <p className="mb-1">
                  Lock in your decisions for <strong>Phase {phase}</strong>. The simulation
                  will run <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong> with your current
                  product, audience, channels, and operations.
                </p>
                <p className="text-text-2 body-xs">
                  These numbers are an estimate. Actual demand is rolled day-by-day, so results may swing - that's part of the game. Adjust before confirming if needed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat icon="cash" label="Cash now" value={fmt$(cash)} tone="cash" />
              <Stat icon="energy" label="Energy" value={`${energy}`} tone="warn" />
              <Stat icon="demand" label="Demand est." value={fmtInt(intDemand)} sub="per phase" tone="info" />
              <Stat icon="stock" label="Finished stock" value={fmtInt(finished)} tone="neutral" />
            </div>

            <div className="panel-muted px-3.5 py-3">
              <div className="panel-title text-text mb-2">Estimated phase impact</div>
              <ul className="body-xs text-text leading-relaxed space-y-1">
                <li>• Likely sold over {daysLeft}d: <strong>~{expectedSold * daysLeft}</strong> units</li>
                <li>• Revenue est.: <strong>{fmt$(expectedRevenue)}</strong></li>
                <li>• Operating expenses: <strong>{fmt$(dailyExpenses)}</strong></li>
                <li>
                  • Net cash change:{' '}
                  <strong className={expectedNetCash >= 0 ? 'text-fin-profit' : 'text-danger'}>
                    {expectedNetCash >= 0 ? '+' : ''}{fmt$(expectedNetCash)}
                  </strong>
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <PixelButton variant="ghost" onClick={onClose}>Cancel</PixelButton>
              <PixelButton variant="primary" size="lg" onClick={onConfirm}>
                Confirm · Simulate Phase {phase}
              </PixelButton>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-10 gap-3 min-h-[240px]"
          >
            <MascotAvatar mood="excited" size={76} />
            <div className="eyebrow eyebrow-sm text-text">Simulating phase…</div>
            <div className="body-xs text-text-2">Reading the numbers</div>
          </motion.div>
        )}
      </AnimatePresence>
    </PixelModal>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: PixelIconKind;
  label: string;
  value: string;
  sub?: string;
  tone: 'cash' | 'warn' | 'info' | 'neutral';
}) {
  const color =
    tone === 'cash' ? 'var(--c-fin-cash)'
    : tone === 'warn' ? 'var(--c-warning)'
    : tone === 'info' ? 'var(--c-info)'
    : 'var(--c-text-2)';
  return (
    <div className="panel px-3 py-2 flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <PixelIcon kind={icon} size={11} color={color} />
        <span className="kpi-label">{label}</span>
      </div>
      <div className="num-md text-text">{value}</div>
      {sub && <div className="hint text-text-3">{sub}</div>}
    </div>
  );
}
