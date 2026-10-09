import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CoinRain } from '@/components/fx/CoinRain';
import { useGame } from '@/state/store';
import {
  advanceFinlitPhase,
  answerInsight,
  generateInsightQuestion,
} from '@/engine/mockEngine';
import { DAYS_PER_PHASE } from '@/engine/config';
import { fmt$, fmtInt } from '@/utils/format';
import { playSfx } from '@/audio/audioManager';
import type { Phase } from '@/types';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelButton, PixelBadge } from '@/components/primitives';
import { CostTiles, type CostTile } from '@/components/primitives/CostTiles';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';
import clsx from 'clsx';
import {
  GamesimSyncError,
  submitRoundDecision,
  type ServerProjectionResult,
} from '@/gamesim/sync';
import { collectClientMetrics } from '@/gamesim/clientMetrics';
import { computeUserProjection } from '@/gamesim/computeUserProjection';
import { selectCashBalance, selectProjectedCash } from '@/engine/selectors';
import {
  useGamesimSession,
  useTotalRounds,
  roundNumberFromPhase,
  phaseFromRoundNumber,
} from '@/gamesim/GamesimProvider';

// The end day of a phase is its round number times the phase length. The old
// three-entry lookup table could not answer for round 4, and the round count is
// the operator's `config.totalRounds`, not a fixed 3.
const phaseEndDay = (phase: number) => phase * DAYS_PER_PHASE;

/**
 * `insight` sits BEFORE `simulating`, which is deliberate and was a change.
 *
 * The insight check is a fixed knowledge question — the copy and the correct
 * answer are hardcoded per phase and derive from no state — so it is not a
 * phase-end reflection and does not need the round's outcome in front of it.
 *
 * Asking it first is what lets its answer ride on the SAME `POST /decisions`
 * as the decision itself. Asked during `evaluation`, it landed after the
 * decision had already been posted, so persisting it needed a second endpoint
 * and left a window where a round existed with no insight attached.
 */
type Step = 'preview' | 'insight' | 'simulating';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * The SimulationScreen's projection instance. Passed in, never fetched here:
   * `useLiveProjection` keeps its state per caller, so a second instance starts
   * at null and the modal's "Cash now" would omit the build cost the HUD chip
   * includes — the same number, two different answers.
   */
  liveProjection?: ServerProjectionResult | null;
}

/**
 * Phase Sequence Modal — single coordinated flow that handles:
 *
 *   preview → insight → simulating → (closes straight into the limbo debrief)
 *
 * EVENTS, KEY SCENARIOS, THE PHASE-REVIEW SLIDE AND THE "PHASE N COMPLETE"
 * STEP WERE REMOVED (2026-10-08, QA's call) — the branching options taught
 * nothing the rest of the game builds on, and the completion step announced a
 * cash delta behind one button that the limbo debrief reports properly.
 *
 * The event step was already unreachable: nothing in the codebase ever assigns
 * `meta.pendingEventId` a non-null value — `applyEventChoice` only clears it.
 * The phase-review slide said one sentence and offered a Continue button, but
 * it also carried the ONLY phase bump in the app; that bookkeeping moved into
 * `tick` rather than going with it. See `finishEvaluation`.
 */
export function PhaseSequenceModal({ open, onClose, liveProjection = null }: Props) {
  const apply = useGame((s) => s.apply);
  const day = useGame((s) => s.meta.day);
  const phase = useGame((s) => s.meta.phase);
  const cash = useGame((s) => s.player.cash);
  const energy = useGame((s) => s.player.energy);
  const finished = useGame((s) => s.inventory.totalFinished);
  const lines = useGame((s) => s.portfolio.productLines);
  const setScreen = useGame((s) => s.setScreen);
  const { canSubmit, canAdvance, bootstrap, roundContext, submittedDecision, refreshOfficial, financialsByRound, clientMetricSources } = useGamesimSession();
  // Snapshot projected cash at the moment the decision is submitted so the modal
  // shows the locked-in numbers even as live projections continue updating elsewhere.
  const cashByProduct = liveProjection?.byProduct ?? null;
  // The ledger's figure for the headline, with committed spend as the delta —
  // exactly how the HUD chip presents it.
  const cashBalance = useGame((s) =>
    selectCashBalance(
      s,
      s.meta.phase,
      (r) => financialsByRound[roundNumberFromPhase(r)]?.operatingProfit,
    ),
  );
  const liveCashValue = useGame(
    (s) => selectProjectedCash(s, cashByProduct, cashBalance).projected,
  );
  const liveCashDelta = useGame(
    (s) => selectProjectedCash(s, cashByProduct, cashBalance).delta,
  );
  const [cashSnapshot, setCashSnapshot] = useState<{ value: number; delta: number } | null>(null);
  useEffect(() => {
    if (submittedDecision && !cashSnapshot) {
      setCashSnapshot({ value: liveCashValue, delta: liveCashDelta });
    }
  }, [submittedDecision]); // intentionally excludes live values — captures at submission only
  const frozen = !!submittedDecision;
  const projectedCashValue = frozen ? (cashSnapshot?.value ?? liveCashValue) : liveCashValue;
  const projectedCashDelta = frozen ? (cashSnapshot?.delta ?? liveCashDelta) : liveCashDelta;

  const [step, setStep] = useState<Step>('preview');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [phaseAtOpen, setPhaseAtOpen] = useState<Phase>(phase);
  const [cashAtOpen, setCashAtOpen] = useState<number>(cash);

  // Which round is the last. `?? phase` means an unknown round count treats the
  // CURRENT round as final — the conservative reading: it ends the run rather
  // than advancing into a round the operator may not have configured.
  const finalRound = useTotalRounds() ?? phase;

  /** Preview "Confirm" → straight to the insight check. */
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
    setStep('insight');
  };

  /**
   * The insight check is answered, so the round can be submitted WITH it.
   *
   * Reads the answer straight out of the store rather than from local state:
   * `answerInsight` has already folded it into `insights.score`, and
   * `collectClientMetrics` resolves whatever keys the operator configured from
   * exactly that — so the payload cannot disagree with what the player saw.
   */
  const onInsightContinue = () => {
    playSfx('whoosh');
    void tick();
  };
  // Reset to preview when the modal re-opens for a new phase confirm cycle.
  useEffect(() => {
    if (!open) return;
    setStep('preview');
    setSyncError(null);
    setSyncing(false);
    setPhaseAtOpen(phase);
    setCashAtOpen(cash);
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

  const target = phaseEndDay(phase);
  const daysLeft = Math.max(0, target - day + 1);

  // THE SAME FIGURES THE HUD SHOWS, from the same single implementation.
  //
  // This used to sum `liveProjection.byProduct` for revenue, gross profit,
  // units sold, operating expenses and operating profit — all of which hang off
  // `customersObtained`, a figure the round calculation derives LATER against
  // every other team's submission. Quoting it here as "what your facilitator
  // scores" stated a number that does not exist yet.
  //
  // `computeUserProjection` is what the chips run, so the confirm screen and
  // the bar the player has been watching all round cannot drift apart.
  const { revenue: hudRevenue, profit: hudProfit } = computeUserProjection(
    lines,
    liveProjection?.byProduct,
  );

  // The player's produce plan (from InventoryPanel) — the same value shown as
  // "Produce / phase" there. It IS their demand estimate now that the separate
  // estimate input is gone. 0 renders as '—'.
  const intProduce = lines.reduce((sum_, l) => sum_ + (l.targetPerPhase ?? 0), 0);

  // ─── Step transitions ────────────────────────────────────────────────────

  /** Advance the engine and route to the next step based on engine flags.
   *  The 1.6s delay is pure showtime — the day counter races, coins rain,
   *  the machine rumbles — then the engine applies in one go. */
  const [simFromDay, setSimFromDay] = useState(1);
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
    setSimFromDay(useGame.getState().meta.day);
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
        const _gs2 = useGame.getState();
        await submitRoundDecision(
          roundContext,
          {
            state: _gs2 as any,
            products: bootstrap?.products ?? [],
            availableGlobalInputs: _gs2.availableGlobalInputs,
          },
          // The insight check has just been answered, so its figures go up in
          // the SAME insert as the decision. Only the keys the operator
          // configured as `origin: 'client'`.
          collectClientMetrics(_gs2 as any, clientMetricSources),
        );
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
      // `totalRounds` decides which round is the last — the mutator has no
      // session access, so the round count is passed in.
      // One mutator for the whole round transition — the phase bump, the energy
      // refill and the evaluation record all moved into it. The modal used to
      // run a second copy of all three in `finishEvaluation`.
      apply((s) => advanceFinlitPhase(s, finalRound));
      finishPhase();
    }, 1600);
  };

  const finishPhase = () => {
    const after = useGame.getState();
    const phaseDelta = after.player.cash - cashAtOpen;
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
    // STRAIGHT TO THE DEBRIEF. There is no "Phase N complete" step any more —
    // it announced a cash delta and offered one button, and the limbo debrief
    // is the screen that actually reports the round.
    //
    // `meta.ended` is the end-of-run signal, set by `advanceFinlitPhase` on
    // `phase >= totalRounds` a moment ago. This used to test `phaseAtOpen === 3`,
    // which disagrees with the engine on any run that is not three rounds long.
    onClose();
    setScreen(useGame.getState().meta.ended ? 'final' : 'limbo');
  };

  // ─── Evaluation ─────────────────────────────────────────────────────────

  /**
   * The insight question for the round BEING PLAYED.
   *
   * Keyed on `phaseAtOpen`, NOT `pendingEvalPhase`. This used to read the
   * latter, which is set by `advanceFinlitPhase` during `simulating` — i.e.
   * AFTER the insight step now runs — and `PhaseActionBar` refuses to open this
   * modal at all while it is non-null (`pendingEval !== null` blocks Confirm).
   * So it was always null here, `insight` was always null, and the guarded
   * `{step === 'insight' && insight && …}` rendered an EMPTY MODAL.
   *
   * Fallout from moving the check ahead of submission: the question is asked
   * before the round runs, so it must key off the round being played.
   * `phaseAtOpen` is frozen at open, which also survives `meta.phase` bumping
   * mid-sequence.
   */
  const insight = useMemo(() => {
    return generateInsightQuestion(useGame.getState() as any, phaseAtOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseAtOpen, step]);

  const [insightAnswer, setInsightAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [insightRevealed, setInsightRevealed] = useState(false);
  // Cleared at `preview`, the one step every run starts from. This keyed off
  // `step !== 'evaluation'` while the question lived on that step; with the
  // step gone, clearing on "anything else" would wipe the answer the moment
  // `insight` hands over to `simulating` — and `finishEvaluation` reads it.
  useEffect(() => {
    if (step === 'preview') {
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

  // ─── Render ─────────────────────────────────────────────────────────────

  const stepIndex =
    step === 'preview' ? 1 :
    step === 'insight' ? 2 :
    3;

  return (
    <PixelModal
      open={open}
      onClose={step === 'preview' ? onClose : undefined}
      hideClose={step !== 'preview'}
      title={
        <span className="flex items-center gap-2">
          <span>Phase {phaseAtOpen} simulation</span>
          <span className="text-text-3 font-normal">·</span>
          <span className="body-xs text-text-3">
            Step {stepIndex} of 3
          </span>
        </span>
      }
      width="min(680px, calc(100vw - 32px))"
    >
      {/* Step transitions — single live motion.div keyed on the current
          step. AnimatePresence with multiple sibling step containers led to
          stuck exits when the engine chained step transitions quickly. One
          container, one key, clean swap. */}
      <motion.div
        key={step === 'insight' && insight ? `insight-${insight.id}` : step}
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
                  the insight check in this same window.
                </p>
                <p className="text-text-2 body-sm">
                  Numbers below are an estimate based on today's settings - actual demand is
                  rolled day-by-day.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat
                icon="cash"
                label="Cash now"
                value={fmt$(projectedCashValue)}
                sub={projectedCashDelta < 0 ? `after decisions (${fmt$(projectedCashDelta)})` : fmt$(cash)}
                tone={projectedCashValue < 0 ? 'warn' : 'cash'}
              />
              <Stat icon="energy" label="Energy" value={`${energy}`} tone="warn" />
              <Stat icon="demand" label="Produce" value={intProduce > 0 ? fmtInt(intProduce) : '—'} sub="planned this phase" tone="info" />
              <Stat icon="stock" label="Finished stock" value={fmtInt(finished)} tone="neutral" />
            </div>

            {/* ONE PANEL, not two.
                There were two — "Estimated phase impact (your studio's own
                model)" and "Official projection · from the simulation server" —
                presented as rival models the player should compare. They were
                not: both summed the SAME `liveProjection.byProduct`, and
                `expectedRevenue` was literally `serverRevenue`. Two headings
                over one calculation, on the screen where the player commits.

                THE "OFFICIAL PROJECTION" FRAMING WAS ALSO FALSE. It quoted
                `customersObtained` as a number the facilitator scores, but that
                figure is recomputed at round calculation against every other
                team's submission — it does not exist yet at this point, and
                `unitsSold`, `revenue` and `grossProfit` all hang off it.

                What is left is the same forecast the HUD shows, from the same
                `computeUserProjection`, so the chips the player has been
                watching all round and this panel cannot disagree. */}
            <div className="panel-muted px-3.5 py-3">
              <div className="panel-title text-text mb-2">
                Estimated phase impact
                {frozen && <span className="stat-label text-success ml-2">· Locked in</span>}
              </div>
              <CostTiles
                tiles={[
                  { label: 'Produce', value: intProduce > 0 ? fmtInt(intProduce) : '—', tone: 'neutral', icon: 'stock' },
                  { label: 'Revenue', value: fmt$(Math.round(hudRevenue)), tone: 'gain', icon: 'cash' },
                  {
                    label: 'Gross profit',
                    value: hudProfit == null ? '—' : fmt$(Math.round(hudProfit)),
                    tone: (hudProfit ?? 0) >= 0 ? 'gain' : 'danger',
                    icon: 'profit',
                  },
                ] satisfies CostTile[]}
              />
              <p className="text-text-2 body-xs mt-2">
                Your price against your own produce plan, capped by what each notebook can make.
                What you actually sell is decided when your facilitator scores the round — it
                depends on what every other team submits, so expect the final figures to be lower
                than this.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {submittedDecision && (
                // No frame: a note is read, not pressed.
                <div className="flex items-start gap-2 bg-success-soft/40 px-3 py-2">
                  <span className="stat-label text-success shrink-0 mt-0.5">Sent</span>
                  <span className="body-xs text-text">
                    {/* 1-based for the player: the server's index is 0-based. */}
                    Round {bootstrap?.round ? phaseFromRoundNumber(bootstrap.round.roundNumber) : '—'} is already with your facilitator and
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
                      : `Confirm · Simulate Phase ${phase}`}
                </PixelButton>
              </div>
            </div>
          </div>
        )}

        {step === 'simulating' && (
          <SimulatingShow
            fromDay={simFromDay}
            toDay={phaseEndDay(phaseAtOpen)}
            phase={phaseAtOpen}
          />
        )}

        {/* BEFORE the submit, not after — see the note on `Step`. The question
            is fixed per phase and reads no state, so nothing here needs the
            round's outcome. */}
        {step === 'insight' && insight && (
          <div className="flex flex-col gap-3">
            <InsightCheck
              phase={phaseAtOpen as Phase}
              insight={insight}
              answer={insightAnswer}
              revealed={insightRevealed}
              onPick={setInsightAnswer}
              onSubmit={onSubmitInsight}
              onContinue={onInsightContinue}
            />
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

/**
 * The insight check — a fixed knowledge question, asked BEFORE the round is
 * submitted so its answer can ride on the same insert.
 *
 * It reads no round state on purpose: the question, the options and the correct
 * answer are hardcoded per phase, so there is nothing here that needs the
 * outcome. The mascot is neutral for the same reason — at this point the phase
 * has not run, and a happy/concerned face would be reacting to the LAST round.
 */
function InsightCheck({
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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <MascotAvatar mood="thinking_side" size={66} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PixelBadge tone="brand">Phase {phase} Insight Check</PixelBadge>
          </div>
        </div>
      </div>

      <div className="panel-muted px-3.5 py-3">
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
