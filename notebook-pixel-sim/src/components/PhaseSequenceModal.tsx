import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CoinRain } from '@/components/fx/CoinRain';
import { useGame } from '@/state/store';
import {
  advanceFinlitPhase,
  applyEventChoice,
  answerInsight,
  generateInsightQuestion,
  resolveFinlitScenario,
  previewFinlitPhase,
} from '@/engine/mockEngine';
import { scenariosForPhase } from '@/data/finlit';
import { selectEvaluationSummary } from '@/engine/selectors';
import { eventForDay, EVENTS } from '@/data/events';
import { PHASE_MAX_ENERGY } from '@/data/balance';
import { ENERGY_REPLENISH } from '@/engine/config';
import { fmt$, fmtInt } from '@/utils/format';
import { playSfx } from '@/audio/audioManager';
import { mulberry32, seedFrom } from '@/utils/rng';
import type { Phase } from '@/types';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelButton, PixelBadge } from '@/components/primitives';
import { CostTiles, type CostTile } from '@/components/primitives/CostTiles';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { RoundNotesCard } from '@/gamesim/OperatorContent';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';
import clsx from 'clsx';
import {
  fetchServerProjection,
  GamesimSyncError,
  submitRoundDecision,
  type ServerProjectionResult,
} from '@/gamesim/sync';
import { useGamesimSession } from '@/gamesim/GamesimProvider';
import { EnergyValue } from '@/components/primitives/EnergyValue';

const PHASE_END = { 1: 30, 2: 60, 3: 90 } as const;

type Step = 'preview' | 'scenario' | 'simulating' | 'event' | 'evaluation' | 'result';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Phase Sequence Modal — single coordinated flow that handles:
 *
 *   preview → simulating → (event* → simulating)* → evaluation → result
 *
 * Replaces the prior 3 separate dialogs (ConfirmPhaseModal + EventModal +
 * EvaluationScreen) with one cohesive sequence so the player experiences a
 * phase as one chapter, not three pop-ups.
 *
 * The engine is unchanged — `advanceDay` still pauses on events / eval days
 * by setting `meta.pendingEventId` / `meta.pendingEvalPhase`. This component
 * just observes those flags and renders the appropriate step inline.
 */
export function PhaseSequenceModal({ open, onClose }: Props) {
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
  const lines = useGame((s) => s.portfolio.productLines);
  const pendingEventId = useGame((s) => s.meta.pendingEventId);
  const pendingEvalPhase = useGame((s) => s.meta.pendingEvalPhase);
  const setScreen = useGame((s) => s.setScreen);
  const { canSubmit, canAdvance, bootstrap, roundContext, submittedDecision, refreshOfficial } = useGamesimSession();

  const [step, setStep] = useState<Step>('preview');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const phaseAtOpenRef = useRef<Phase>(phase);
  const cashAtOpenRef = useRef<number>(cash);

  // Key scenarios (P5) — the phase's unresolved scenarios, shown before the sim.
  // The list is SELF-CONSUMING: resolving one removes it from `pendingScenarios`
  // (recomputed from `resolvedScenarios`), so the head is always "next".
  const resolvedScenarios = useGame((s) => s.finlit.resolvedScenarios);
  const allPhaseScenarios = scenariosForPhase(phase);
  const pendingScenarios = allPhaseScenarios.filter((sc) => !resolvedScenarios.includes(sc.id));
  const currentEnergy = useGame((s) => s.player.energy);

  /** Preview "Confirm" → run scenarios first (if any), else simulate. */
  const onConfirm = () => {
    if (!canAdvance) {
      const status = bootstrap?.round?.status ?? 'unknown';
      setSyncError(
        status !== 'Active'
          ? `Round is ${status}. Wait for the facilitator to activate it before confirming.`
          : 'Decisions are locked for this round. You cannot confirm until editing is allowed again.',
      );
      return;
    }
    setSyncError(null);
    if (pendingScenarios.length > 0) setStep('scenario');
    else void tick();
  };

  const onScenarioPick = (opt: 'A' | 'B' | 'C' | 'D') => {
    const sc = pendingScenarios[0];
    if (!sc) { void tick(); return; }
    apply((s) => resolveFinlitScenario(s, sc.id, opt));
    // Was that the last unresolved scenario? If so, simulate; else the head
    // re-renders as the next one.
    const stillPending = allPhaseScenarios.some((x) => x.id !== sc.id && !resolvedScenarios.includes(x.id));
    if (!stillPending) void tick();
  };
  // Reset to preview when the modal re-opens for a new phase confirm cycle.
  useEffect(() => {
    if (!open) return;
    setStep('preview');
    setSyncError(null);
    setSyncing(false);
    phaseAtOpenRef.current = phase;
    cashAtOpenRef.current = cash;
    apply((s) => { s.meta.sequenceActive = true; });
    // Cleared in a CLEANUP, not an else-branch. This modal is keyed on
    // `openCount`, so it remounts rather than re-renders, and its parent can
    // unmount entirely while `open` is still true — in both cases an
    // else-branch never runs and the flag outlives the component that owns it.
    // A stuck `sequenceActive` is unrecoverable without a reload: App.tsx both
    // declines to promote the evaluation screen and suppresses the standalone
    // one, so a set `pendingEvalPhase` renders nothing while blocking every
    // action on the phase bar.
    return () => { apply((s) => { s.meta.sequenceActive = false; }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const target = PHASE_END[phase];
  const daysLeft = Math.max(0, target - day + 1);

  // FinLit preview — the actual phase result for the current config, computed
  // WITHOUT mutating state (recomputes when the modal opens / phase changes).
  const localFinlitPreview = useMemo(() => {
    if (!open) return null;
    try { return previewFinlitPhase(useGame.getState() as any); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  // Server projection for the same decision — a DIFFERENT model (the gamesim
  // backend's calcFinancials), so it does not replace the local estimate; both
  // are shown, clearly labelled. The local one renders immediately so a slow or
  // unreachable server never blocks the preview step.
  const [serverProjection, setServerProjection] = useState<ServerProjectionResult | null>(null);
  useEffect(() => {
    setServerProjection(null);
    if (!open || !roundContext) return;
    let cancelled = false;
    fetchServerProjection(roundContext, {
      state: useGame.getState() as any,
      products: bootstrap?.products ?? [],
    }).then((res) => {
      if (!cancelled) setServerProjection(res);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, roundContext, bootstrap?.products]);

  const serverRevenue = serverProjection?.byProduct.reduce((a, p) => a + (p.revenue ?? 0), 0) ?? null;
  const serverGrossProfit =
    serverProjection?.byProduct.reduce((a, p) => a + (p.grossProfit ?? 0), 0) ?? null;
  const serverCustomers =
    serverProjection?.byProduct.reduce((a, p) => a + (p.customersObtained ?? 0), 0) ?? null;

  const finlitPreview = localFinlitPreview;
  // Show the player's own demand estimate (from InventoryPanel) — the same
  // value displayed in "Demand est. / phase" there. Fall back to 0 (shown as
  // '—') when the player hasn't entered an estimate yet.
  const intDemand = lines.reduce((sum, l) => sum + (l.demandEstPerPhase ?? 0), 0);
  const expectedSold = Math.round(finlitPreview?.soldTotal ?? 0);
  const expectedRevenue = Math.round(finlitPreview?.revenue ?? 0);
  const dailyExpenses = Math.round((finlitPreview?.opex ?? 0) + (finlitPreview?.channelCost ?? 0));
  const expectedNetCash = Math.round(finlitPreview?.netProfit ?? 0);

  // ─── Step transitions ────────────────────────────────────────────────────

  /** Advance the engine and route to the next step based on engine flags.
   *  The 1.6s delay is pure showtime — the day counter races, coins rain,
   *  the machine rumbles — then the engine applies in one go. */
  const simFromDayRef = useRef(1);
  const tick = async () => {
    // `roundContext` is only needed to SUBMIT. Demanding it to advance was the
    // same conflation as `canAdvance` itself, one level down: standalone play
    // has no round context and needs none, so the guard bounced the player
    // back to step 1 with "this round is not accepting decisions" — about a
    // round that does not exist — immediately after the event they had just
    // answered. The POST below is already gated on `canSubmit`.
    if (!canAdvance || (canSubmit && !roundContext)) {
      setSyncError('Cannot submit: this round is not accepting decisions.');
      setStep('preview');
      return;
    }
    playSfx('confirm');
    simFromDayRef.current = useGame.getState().meta.day;
    setSyncing(true);
    setSyncError(null);
    try {
      // Must succeed before the local phase advances — a silent failure would
      // leave the team out of the round's scoring while the player believed the
      // decision was in. POST /decisions is one-shot per round: no re-submit.
      //
      // If this round's decision is already in, skip the POST and run the phase
      // anyway. Re-sending would 409, but the player still has 30 days of their
      // own simulation to watch and an evaluation to answer; the send being done
      // is not a reason to stop the game.
      if (canSubmit && roundContext) {
        await submitRoundDecision(roundContext, {
          state: useGame.getState() as any,
          products: bootstrap?.products ?? [],
        });
        void refreshOfficial();
      }
    } catch (err) {
      setSyncing(false);
      setStep('preview');
      setSyncError(err instanceof GamesimSyncError || err instanceof Error
        ? err.message
        : 'Failed to submit the decision. Check your connection and retry.');
      return;
    }
    setSyncing(false);
    setStep('simulating');
    setTimeout(() => {
      // V3: the whole phase resolves at once on the FinLit engine.
      apply((s) => advanceFinlitPhase(s));
      const after = useGame.getState();
      if (after.meta.pendingEventId) {
        setStep('event');
      } else if (after.meta.pendingEvalPhase !== null) {
        setStep('evaluation');
      } else {
        // Rare: no event/eval until day 90+
        finishPhase();
      }
    }, 1600);
  };

  const finishPhase = () => {
    const after = useGame.getState();
    const phaseDelta = after.player.cash - cashAtOpenRef.current;
    // Triumphant SFX on positive phase, gentle warning on dip — pairs
    // with the confetti so the player feels the outcome.
    playSfx(phaseDelta >= 0 ? 'phase-up' : 'warning');
    confetti({
      particleCount: phaseDelta >= 0 ? 110 : 60,
      spread: 90,
      startVelocity: 36,
      origin: { y: 0.42 },
      colors: phaseDelta >= 0
        ? ['#6FBB85', '#DDA655', '#B98BD4', '#8E6CAC']
        : ['#CB6356', '#DDA655', '#8A765D'],
      ticks: 200,
    });
    setStep('result');
  };

  // ─── Event handlers ──────────────────────────────────────────────────────

  const onEventChoice = (option: 'A' | 'B' | 'C' | 'D') => {
    if (!pendingEventId) return;
    apply((s) => applyEventChoice(s, pendingEventId, option));
    // After resolution, check if there's also a pending eval (Day 30 has both)
    const after = useGame.getState();
    if (after.meta.pendingEvalPhase !== null) {
      setStep('evaluation');
    } else if (after.meta.day < PHASE_END[phaseAtOpenRef.current]) {
      // Continue simulating remaining days
      tick();
    } else {
      // End of phase reached without eval (shouldn't normally happen)
      finishPhase();
    }
  };

  // ─── Evaluation ─────────────────────────────────────────────────────────

  const insight = useMemo(() => {
    if (pendingEvalPhase === null) return null;
    return generateInsightQuestion(useGame.getState() as any, pendingEvalPhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEvalPhase, step]);

  const [insightAnswer, setInsightAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [insightRevealed, setInsightRevealed] = useState(false);
  useEffect(() => {
    if (step !== 'evaluation') {
      setInsightAnswer(null);
      setInsightRevealed(false);
    }
  }, [step]);

  const onSubmitInsight = () => {
    if (!insight || !insightAnswer) return;
    const correct = !!insight.options.find((o) => o.id === insightAnswer)?.correct;
    playSfx(correct ? 'chime' : 'fail');
    apply((s) => answerInsight(s, insight.id, insightAnswer, correct));
    setInsightRevealed(true);
  };

  const onContinueFromEval = () => {
    playSfx('whoosh');
    const evalPhase = pendingEvalPhase ?? phaseAtOpenRef.current;
    apply((s) => {
      s.meta.pendingEvalPhase = null;
      s.evaluations.resolved.push({
        phase: evalPhase as Phase,
        insightCorrect: insightRevealed && insightAnswer
          ? !!insight?.options.find((o) => o.id === insightAnswer)?.correct
          : null,
        day: s.meta.day,
      });
      // Bump phase + replenish energy if not the final phase
      if (evalPhase < 3) {
        const next = (evalPhase + 1) as Phase;
        s.meta.phase = next;
        s.player.maxEnergy = PHASE_MAX_ENERGY[next];
        s.player.energy = Math.min(s.player.maxEnergy, s.player.energy + ENERGY_REPLENISH);
      }
    });
    finishPhase();
  };

  const onResultContinue = () => {
    playSfx('whoosh');
    const wasFinalPhase = phaseAtOpenRef.current === 3;
    if (wasFinalPhase) {
      apply((s) => { s.meta.ended = true; });
      onClose();
      setScreen('final');
    } else {
      onClose();
      setScreen('phase_intro');
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const ev = pendingEventId ? EVENTS.find((e) => e.id === pendingEventId) ?? eventForDay(day) : null;
  const stepIndex =
    step === 'preview' ? 1 :
    step === 'simulating' ? 2 :
    step === 'event' ? 2 :
    step === 'evaluation' ? 3 :
    4;

  return (
    <PixelModal
      open={open}
      onClose={step === 'preview' ? onClose : undefined}
      hideClose={step !== 'preview'}
      title={
        <span className="flex items-center gap-2">
          <span>Phase {phaseAtOpenRef.current} simulation</span>
          <span className="text-text-3 font-normal">·</span>
          <span className="body-xs text-text-3">
            Step {stepIndex} of 4
          </span>
        </span>
      }
      width="min(680px, calc(100vw - 32px))"
    >
      {/* Step transitions — single live motion.div keyed on the current
          step. AnimatePresence with multiple sibling step containers led to
          stuck exits when the engine chained step transitions quickly
          (event → simulating → event → evaluation). One container, one key,
          clean swap. */}
      <motion.div
        key={
          step === 'event' && ev ? `event-${ev.id}` :
          step === 'evaluation' && insight ? `eval-${insight.id}` :
          step
        }
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }}
        className="flex flex-col gap-4"
      >
        {step === 'preview' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <MascotAvatar mood="presenting" size={66} />
              <div className="flex-1 body-sm text-text leading-relaxed">
                <p className="mb-1">
                  Lock in your decisions for <strong>Phase {phase}</strong>. The simulation
                  will run <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>, pausing for
                  events and the phase evaluation in this same window.
                </p>
                <p className="text-text-2 body-sm">
                  Numbers below are an estimate based on today's settings - actual demand is
                  rolled day-by-day.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat icon="cash" label="Cash now" value={fmt$(cash)} tone="cash" />
              <Stat icon="energy" label="Energy" value={`${energy}`} tone="warn" />
              <Stat icon="demand" label="Demand est." value={intDemand > 0 ? fmtInt(intDemand) : '—'} sub="your estimate" tone="info" />
              <Stat icon="stock" label="Finished stock" value={fmtInt(finished)} tone="neutral" />
            </div>

            <div className="panel-muted px-3.5 py-3">
              <div className="panel-title text-text mb-2">Estimated phase impact (your studio's own model)</div>
              <CostTiles
                tiles={[
                  { label: `Sold / ${daysLeft}d`, value: `~${fmtInt(expectedSold)}`, tone: 'neutral', icon: 'stock' },
                  { label: 'Revenue', value: fmt$(expectedRevenue), tone: 'gain', icon: 'cash' },
                  { label: 'Op + channel', value: fmt$(dailyExpenses), tone: 'cost', icon: 'cash' },
                  {
                    label: 'Net cash',
                    value: `${expectedNetCash >= 0 ? '+' : ''}${fmt$(expectedNetCash)}`,
                    tone: expectedNetCash >= 0 ? 'gain' : 'danger',
                    icon: 'profit',
                  },
                ] satisfies CostTile[]}
              />
            </div>

            {serverProjection && (
              <div className="panel-muted px-3.5 py-3">
                <div className="panel-title text-text mb-2">
                  Official projection · from the simulation server
                </div>
                <CostTiles
                  tiles={[
                    { label: 'Revenue', value: fmt$(Math.round(serverRevenue ?? 0)), tone: 'gain', icon: 'cash' },
                    { label: 'Gross profit', value: fmt$(Math.round(serverGrossProfit ?? 0)), tone: (serverGrossProfit ?? 0) >= 0 ? 'gain' : 'danger', icon: 'profit' },
                    { label: 'Customers', value: fmtInt(Math.round(serverCustomers ?? 0)), tone: 'neutral', icon: 'demand' },
                  ] satisfies CostTile[]}
                />
                <p className="text-text-2 body-xs mt-2">
                  These are the numbers your facilitator scores. They come from a different model
                  than the studio estimate above, so the two will not match - final market share
                  also depends on what every other team submits.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              {submittedDecision && (
                // No frame: a note is read, not pressed.
                <div className="flex items-start gap-2 bg-success-soft/40 px-3 py-2">
                  <span className="stat-label text-success shrink-0 mt-0.5">Sent</span>
                  <span className="body-xs text-text">
                    Round {bootstrap?.round?.roundNumber} is already with your facilitator and
                    scores from that submission. You can still run the phase and see how it plays
                    out.
                  </span>
                </div>
              )}
              {syncError && (
                <div className="panel-muted px-3 py-2 body-xs text-red-700 border border-red-300 bg-red-50">
                  {syncError}
                </div>
              )}
              {!canAdvance && !syncError && !submittedDecision && (
                <div className="panel-muted px-3 py-2 body-xs text-text-2">
                  Round is not accepting decisions right now
                  {bootstrap?.round ? ` (status: ${bootstrap.round.status})` : ''}.
                </div>
              )}
              <div className="flex justify-end gap-2">
                <PixelButton variant="ghost" onClick={() => { playSfx('click-soft'); onClose(); }}>Cancel</PixelButton>
                <PixelButton
                  variant="primary"
                  size="lg"
                  disabled={!canAdvance || syncing}
                  onClick={onConfirm}
                >
                  {syncing
                    ? 'Syncing decision…'
                    : syncError
                      ? 'Retry sync & confirm'
                      : pendingScenarios.length > 0
                        ? `Confirm · ${pendingScenarios.length} decision${pendingScenarios.length === 1 ? '' : 's'} ahead`
                        : `Confirm · Simulate Phase ${phase}`}
                </PixelButton>
              </div>
            </div>
          </div>
        )}

        {step === 'scenario' && pendingScenarios[0] && (() => {
          const sc = pendingScenarios[0];
          const resolvedThisPhase = allPhaseScenarios.length - pendingScenarios.length;
          return (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <MascotAvatar mood="warning" size={66} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="eyebrow eyebrow-sm text-info">
                      Key Scenario {allPhaseScenarios.length > 1 ? `${resolvedThisPhase + 1}/${allPhaseScenarios.length}` : ''}
                    </span>
                  </div>
                  <h3 className="h3 uppercase text-ink-900 mb-1">{sc.title}</h3>
                  <p className="body-sm text-text leading-relaxed">{sc.body}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sc.options.map((o) => {
                  const affordable = currentEnergy >= o.energy;
                  return (
                    <button
                      key={o.id}
                      disabled={!affordable}
                      onClick={() => { playSfx(affordable ? 'confirm' : 'fail'); onScenarioPick(o.id); }}
                      className={
                        'text-left px-3 py-2.5 border-2 transition-all active:scale-[0.98] ' +
                        (affordable ? 'border-border-soft bg-surface hover:border-primary' : 'border-border-soft bg-surface-2 opacity-50 cursor-not-allowed')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="item-name text-text"><span className="text-primary">{o.id}.</span> {o.label}</span>
                        <span
                          className={clsx(
                            'shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 border num-xs',
                            o.energy > 0 ? 'border-warning/50 bg-warning-soft/40 text-warning' : 'border-success/50 bg-success-soft/40 text-success',
                          )}
                        >
                          {o.energy > 0 ? <EnergyValue amount={o.energy} /> : 'FREE'}
                        </span>
                      </div>
                      <div className="body-xs text-text-2 leading-tight mt-0.5">{o.detail}</div>
                    </button>
                  );
                })}
              </div>
              <div className="body-xs text-text-3 text-right inline-flex items-baseline gap-1 justify-end w-full"><EnergyValue amount={currentEnergy} /> energy available</div>
            </div>
          );
        })()}

        {step === 'simulating' && (
          <SimulatingShow
            fromDay={simFromDayRef.current}
            toDay={PHASE_END[phaseAtOpenRef.current]}
            phase={phaseAtOpenRef.current}
          />
        )}

        {step === 'event' && ev && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <MascotAvatar mood={ev.mascotMood} size={66} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <PixelBadge tone="warn">Day {day} · Event</PixelBadge>
                  <span className="stat-label">
                    {ev.title}
                  </span>
                </div>
                <p className="body-sm text-text leading-snug">{ev.body}</p>
              </div>
            </div>
            <EventOptions ev={ev} cash={cash} onPick={onEventChoice} />
          </div>
        )}

        {step === 'evaluation' && insight && (
          <div className="flex flex-col gap-3">
            <EvaluationStep
              phase={(pendingEvalPhase ?? phaseAtOpenRef.current) as Phase}
              insight={insight}
              answer={insightAnswer}
              revealed={insightRevealed}
              onPick={setInsightAnswer}
              onSubmit={onSubmitInsight}
              onContinue={onContinueFromEval}
            />
          </div>
        )}

        {step === 'result' && (
          <div className="flex flex-col gap-3">
            <ResultStep
              phaseJustFinished={phaseAtOpenRef.current}
              cashStart={cashAtOpenRef.current}
              onContinue={onResultContinue}
            />
            {/* Anything the facilitator wrote for this round. Renders nothing
                when there are no notes, so the phase result is unchanged. */}
            <RoundNotesCard />
          </div>
        )}
      </motion.div>
    </PixelModal>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

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
  // Tone has to reach the TILE, not just an 11px icon. A phase that stocked out
  // 30 days of 30 and lost 29 sales was rendering in the same neutral panel as
  // the revenue beside it — the one number the player most needed to notice was
  // the one carrying no signal at all. `warn` now tints the whole chip, the way
  // every other chip in the app already states its tone.
  // The tone is carried by the FILL, not by a frame. These tiles used to wear a
  // 2px border like the Cancel/Confirm buttons two rows below them, which is the
  // one frame weight reserved for things you can press. The neutral tile had
  // nothing else to show for it either: `border-border-soft` at 2px was its only
  // definition, so dropping the frame means neutral needs a fill of its own.
  const toneChip =
    tone === 'warn' ? 'bg-warning-soft/50'
    : tone === 'cash' ? 'bg-success-soft/30'
    : 'bg-surface-2/50';
  return (
    <div className={clsx('px-3 py-2 flex flex-col gap-0.5', toneChip)}>
      <div className="flex items-center gap-1.5">
        <PixelIcon kind={icon} size={11} color={color} />
        <span className="kpi-label">{label}</span>
      </div>
      {/* The unit rides WITH the figure on one baseline. On its own line it
          read as a second, unrelated fact stacked under the number, and left
          the tiles that have no `sub` a row shorter than the ones that do. */}
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="num-md text-text">{value}</span>
        {sub && <span className="stat-label">{sub}</span>}
      </div>
    </div>
  );
}

/* Event options grid - each option is a clickable card. Disabled state comes
   from cost-too-high (informational; we still allow the click but show
   a warning chip). */
function EventOptions({
  ev,
  cash,
  onPick,
}: {
  ev: typeof EVENTS[number];
  cash: number;
  onPick: (id: 'A' | 'B' | 'C' | 'D') => void;
}) {
  const [picked, setPicked] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid md:grid-cols-2 gap-2">
        {ev.options.map((o) => {
          const tooExpensive = o.cost.cash !== undefined && o.cost.cash > cash;
          const isPicked = picked === o.id;
          return (
            <button
              key={o.id}
              onClick={() => { playSfx('click-soft'); setPicked(o.id); }}
              className={clsx(
                'text-left p-2.5 border-2 transition-all cursor-pointer',
                // Selected - dark walnut plate + cream text, matching the
                // insight-check picks so every multi-option selection is
                // consistent.
                isPicked
                  ? 'border-primary bg-[#221710] shadow-[2px_2px_0_0_var(--c-shadow)] -translate-y-0.5'
                  : 'border-border-soft bg-surface hover:border-border hover:-translate-y-px hover:shadow-[1px_1px_0_0_var(--c-shadow)]',
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={clsx('eyebrow eyebrow-sm', isPicked ? 'text-primary' : 'text-text-3')}>{o.id}.</span>
                <span className={clsx('item-name', isPicked ? 'text-[#FAF7E8]' : 'text-text')}>{o.label}</span>
              </div>
              <div className={clsx('body-xs leading-snug', isPicked ? 'text-[#FAF7E8]/85' : 'text-text-2')}>{o.description}</div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <PixelBadge tone="warn">E−{o.cost.energy}</PixelBadge>
                {o.cost.cash !== undefined && o.cost.cash > 0 && (
                  <PixelBadge tone={tooExpensive ? 'error' : 'neutral'}>
                    {fmt$(-o.cost.cash)}
                  </PixelBadge>
                )}
                {o.effects.slice(0, 2).map((e, i) => (
                  <PixelBadge key={i} tone="neutral">{e}</PixelBadge>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <PixelButton
          variant="primary"
          size="md"
          disabled={!picked}
          onClick={() => { if (picked) { playSfx('confirm'); onPick(picked); } }}
        >
          {picked ? `Confirm - Choose ${picked}` : 'Pick an option'}
        </PixelButton>
      </div>
    </div>
  );
}

/* Evaluation step - summary + insight check. */
function EvaluationStep({
  phase,
  insight,
  answer,
  revealed,
  onPick,
  onSubmit,
  onContinue,
}: {
  phase: Phase;
  insight: ReturnType<typeof generateInsightQuestion>;
  answer: 'A' | 'B' | 'C' | 'D' | null;
  revealed: boolean;
  onPick: (id: 'A' | 'B' | 'C' | 'D') => void;
  onSubmit: () => void;
  onContinue: () => void;
}) {
  const summary = useGame((s) => selectEvaluationSummary(s as any, phase));
  const goodPhase = summary.opProfit >= 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <MascotAvatar mood={goodPhase ? 'happy' : 'thinking_side'} size={66} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PixelBadge tone="brand">Phase {phase} debrief</PixelBadge>
            <span className="stat-label">
              Days {summary.fromDay}-{summary.toDay}
            </span>
          </div>
          <p className="body-sm text-text leading-snug">
            {/* A profitable phase spent entirely out of stock is not a phase
                that "paid off" - it is money left on the table, and inventory
                discipline is a quarter of the final rubric. Congratulating the
                player here taught the opposite of the lesson, so a stockout
                qualifies the headline instead of being buried in a side tile. */}
            {goodPhase
              ? summary.unitsLost > 5
                ? `Profit ${fmt$(summary.opProfit)} this phase - but you sold out on ${summary.stockoutDays} of ${summary.toDay - summary.fromDay + 1} days and turned away about ${fmtInt(summary.unitsLost)} buyers. Make more of what was already selling.`
                : `Profit ${fmt$(summary.opProfit)} this phase - your decisions paid off.`
              : `Profit dipped (${fmt$(summary.opProfit)}). Trace it back to costs and timing in the P&L below.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon="revenue" label="Revenue" value={fmt$(summary.revenue)} tone="info" />
        <Stat icon="profit" label="Op Profit" value={fmt$(summary.opProfit)} tone={goodPhase ? 'cash' : 'warn'} />
        <Stat icon="stock" label="Lost sales" value={fmtInt(summary.unitsLost)} sub={`${summary.stockoutDays}d stockout`} tone={summary.unitsLost > 5 ? 'warn' : 'neutral'} />
      </div>

      <div className="panel-muted px-3.5 py-3">
        <div className="panel-title text-text mb-2">Insight check</div>
        <p className="body-sm text-text mb-2">{insight.question}</p>
        <div className="flex flex-col gap-1.5">
          {insight.options.map((o) => {
            const isPicked = answer === o.id;
            const showCorrect = revealed && o.correct;
            const wrongPicked = revealed && isPicked && !o.correct;
            return (
              <button
                key={o.id}
                disabled={revealed}
                onClick={() => { playSfx('click-soft'); onPick(o.id); }}
                className={clsx(
                  'text-left p-2 border-2 body-xs leading-snug transition-all',
                  showCorrect && 'border-success bg-success-soft text-text',
                  wrongPicked && 'border-danger bg-error-soft text-text',
                  // Selected (pre-reveal) - dark walnut plate + cream
                  // text so the pick is unambiguous, mirrors the HUD
                  // bar treatment elsewhere in the app.
                  isPicked && !revealed && 'border-primary bg-[#221710] text-[#FAF7E8]',
                  !isPicked && !revealed && 'border-border-soft bg-surface hover:border-border',
                )}
              >
                <span
                  className={clsx(
                    'eyebrow eyebrow-sm mr-2',
                    isPicked && !revealed ? 'text-primary' : 'text-text-3',
                  )}
                >
                  {o.id}.
                </span>
                {o.text}
              </button>
            );
          })}
        </div>
        {revealed && (
          <div className="mt-2 body-xs text-text-2 leading-snug">
            <strong className="text-text">Why:</strong> {insight.explanation}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {!revealed ? (
          <PixelButton variant="primary" disabled={!answer} onClick={onSubmit}>
            Submit answer
          </PixelButton>
        ) : (
          <PixelButton variant="primary" onClick={onContinue}>
            Continue
          </PixelButton>
        )}
      </div>
    </div>
  );
}

/* Result step - phase summary + continue. */
function ResultStep({
  phaseJustFinished,
  cashStart,
  onContinue,
}: {
  phaseJustFinished: Phase;
  cashStart: number;
  onContinue: () => void;
}) {
  const cashNow = useGame((s) => s.player.cash);
  const cashDelta = cashNow - cashStart;
  const ended = useGame((s) => s.meta.ended) || phaseJustFinished === 3;
  const positive = cashDelta >= 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <MascotAvatar mood={positive ? 'excited_big' : 'concerned_soft'} size={76} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PixelBadge tone={positive ? 'success' : 'warn'}>
              Phase {phaseJustFinished} complete
            </PixelBadge>
          </div>
          <p className="body-sm text-text leading-snug">
            {positive
              ? `Nice run. Cash went up ${fmt$(cashDelta)} this phase.`
              : `Cash dipped ${fmt$(Math.abs(cashDelta))} this phase - open the P&L below to diagnose.`}
            {!ended && ` Ready for Phase ${phaseJustFinished + 1}?`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon="cash" label="Cash now" value={fmt$(cashNow)} tone="cash" />
        <Stat
          icon="profit"
          label="Phase change"
          value={`${cashDelta >= 0 ? '+' : ''}${fmt$(cashDelta)}`}
          tone={positive ? 'cash' : 'warn'}
        />
      </div>

      <div className="flex justify-end pt-1">
        <PixelButton variant="primary" size="lg" onClick={onContinue}>
          {ended ? 'See final results' : `Continue to Phase ${phaseJustFinished + 1}`}
        </PixelButton>
      </div>
    </div>
  );
}

/**
 * SimulatingShow - the PAYOFF beat. While the engine waits its 1.6s of
 * showtime, the day counter races like an odometer with soft day-tick
 * sounds, coins rain down, and the whole rig rumbles like a machine hard at
 * work. Reduced-motion keeps just the counter + progress bar.
 */
function SimulatingShow({ fromDay, toDay, phase }: { fromDay: number; toDay: number; phase: Phase }) {
  const reduced = useReducedMotion();
  const [shownDay, setShownDay] = useState(fromDay);
  const doneRef = useRef(false);

  useEffect(() => {
    const T = 1450; // just under the engine's 1.6s hold
    let raf = 0;
    let start: number | null = null;
    let lastTick = 0;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / T);
      const eased = 1 - Math.pow(1 - p, 2);
      setShownDay(Math.round(fromDay + (toDay - fromDay) * eased));
      if (ts - lastTick > 240 && p < 0.96) {
        lastTick = ts;
        playSfx('tick'); // days flipping past
      }
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        playSfx('coin'); // the till rings as the count lands
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fromDay, toDay]);

  return (
    <div className="relative flex flex-col items-center justify-center py-10 gap-3 min-h-[260px] overflow-hidden">
      {/* money coming in */}
      <CoinRain />

      {/* the rig rumbles while it works */}
      <motion.div
        className="relative flex flex-col items-center gap-3"
        animate={reduced ? undefined : { x: [0, -1.5, 1.5, -1, 1, 0] }}
        transition={{ duration: 0.38, repeat: Infinity, ease: 'linear' }}
      >
        <MascotAvatar mood="excited" size={76} />
        <div className="section-title text-ink-900">
          Simulating Phase {phase}…
        </div>
        {/* racing day odometer */}
        <div className="flex items-baseline gap-2">
          <span className="stat-label">Day</span>
          <span className="num-xl leading-none text-text">{shownDay}</span>
          <span className="num-sm text-text-3">/ {toDay}</span>
        </div>
        <div className="body-xs text-text-2">Selling, producing, counting the till…</div>
        <div className="w-48 h-1.5 bg-surface-2 border border-border-soft mt-1 overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
