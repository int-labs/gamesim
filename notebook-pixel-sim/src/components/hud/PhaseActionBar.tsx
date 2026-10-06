import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { PhaseSequenceModal } from '@/components/PhaseSequenceModal';
import type { ServerProjectionResult } from '@/gamesim/sync';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { TOAST, VALIDATION } from '@/content/copy';
import { expandScript, SCRIPT_BEFORE_PHASE1_CONFIRM } from '@/content/mascotScripts';
import { playSfx } from '@/audio/audioManager';
import { Tooltip } from '@/components/primitives/Tooltip';
import { SessionChip } from '@/components/hud/SessionChip';
import { useTotalRounds, useGamesimSession } from '@/gamesim/GamesimProvider';
import { downloadRoundReport } from '@/gamesim/client';

/**
 * Action bar that runs the entire current phase to its end day in one click.
 * Phase 1 = D1-30, Phase 2 = D31-60, Phase 3 = D61-90.
 *
 * Validation surfacing: when the user can't confirm yet (no notebook added
 * or game-state is blocked), the button is disabled AND a clearly-visible
 * inline reason renders next to it — so the user never has to guess why
 * nothing happened on click.
 */
export function PhaseActionBar({
  liveProjection,
}: {
  /** Passed straight to the sequence modal — see SimulationScreen. */
  liveProjection?: ServerProjectionResult | null;
}) {
  const phase = useGame((s) => s.meta.phase);
  const totalRounds = useTotalRounds();
  const ended = useGame((s) => s.meta.ended);
  const pendingEvent = useGame((s) => s.meta.pendingEventId);
  const pendingEval = useGame((s) => s.meta.pendingEvalPhase);
  const lineCount = useGame((s) => s.portfolio.productLines.length);
  const pushMascot = useGame((s) => s.pushMascot);
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);
  const showToast = useGame((s) => s.showToast);
  const [open, setOpen] = useState(false);
  // Bumped each time the modal opens so the modal remounts fresh —
  // prevents the previous run's "running" local state from persisting.
  const [openCount, setOpenCount] = useState(0);

  // "Before you lock Phase 1, two checks..." — pushed on ARRIVAL, not on the
  // confirm click. Fired from the click it queued behind the sequence modal and
  // surfaced on the Phase 1 DEBRIEF, telling a player to check decisions they
  // had already made while its scrim dimmed the results. Guidance titled
  // "before you confirm" has to precede the decision to mean anything.
  // pushMascotSequence de-dupes by script id, so this runs once per save.
  useEffect(() => {
    if (phase === 1) pushMascotSequence(expandScript(SCRIPT_BEFORE_PHASE1_CONFIRM));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Game-state blocks (engine forces resolution before continuing)
  const stateBlocked = ended || !!pendingEvent || pendingEval !== null;
  // Validation blocks (player needs to make a required decision)
  const needsAnyNotebook = lineCount === 0;
  // A `needsSegment` gate sat here. It could never fire — `targetSegment` was
  // seeded at startup and `segmentForGenre` never returned null — and the axis
  // it guarded is gone.
  const blocked = stateBlocked || needsAnyNotebook;

  const blockReason = ended
    ? VALIDATION.runEnded
    : pendingEvent
    ? VALIDATION.pendingEvent
    : pendingEval !== null
    ? VALIDATION.pendingEval
    : needsAnyNotebook
    ? VALIDATION.noNotebook
    : null;

  const phaseTitle =
    phase === 1 ? 'Confirm Phase 1 · Days 1-30'
    : phase === 2 ? 'Confirm Phase 2 · Days 31-60'
    : 'Confirm Phase 3 · Days 61-90';

  // Visual signal on the warning chip when the player clicks a blocked
  // confirm — a brief shake + glow draws the eye to the unresolved
  // blocker. Cleared after the animation finishes.
  const [shakeWarn, setShakeWarn] = useState(false);
  const flashWarn = () => {
    setShakeWarn(true);
    window.setTimeout(() => setShakeWarn(false), 600);
  };

  const tryConfirm = () => {
    // The button is INTENTIONALLY clickable even when blocked — the
    // visual disabled state is a class, not the `disabled` attribute.
    // This lets us surface real guidance (toast + Amelia + shake) the
    // instant the player taps Confirm without an audience or notebook.
    if (stateBlocked) {
      playSfx('warning');
      flashWarn();
      showToast({ kind: 'warning', text: blockReason ?? 'Cannot confirm phase right now.' });
      return;
    }
    if (needsAnyNotebook) {
      playSfx('warning');
      flashWarn();
      showToast({ kind: 'warning', text: TOAST.notebookFirst, ms: 2800 });
      pushMascot({
        id: 'no-notebook',
        type: 'warning',
        body: 'You need at least one notebook product before simulating the phase. Add one on the Product page.',
        priority: 1,
        mood: 'concerned_soft',
      });
      return;
    }
    playSfx('confirm');
    setOpenCount((c) => c + 1);
    setOpen(true);
  };

  return (
    <>
      <div
        // Shares `.game-action-bar` styling with the top HUD's `.game-hud`
        // — same parchment surface, same 2px warm-brown edge, same 1px
        // highlight inset. The two bars read as one game-HUD frame.
        className="game-action-bar shrink-0 z-20 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3"
        role="region"
        aria-label="Phase action bar"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
      >
        {/* Phase summary — caramel marker square (with phase icon) +
            label/subtitle. Matches Figma 3's left-side group. */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-initial">
          <span className="game-phase-marker">
            <PixelIcon kind="phase" size={12} color="var(--c-border)" />
          </span>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="eyebrow eyebrow-sm text-[#9F7F52]">Current Phase</span>
            {/* Phase N / total. Was "Day 1 / 90 · 30d left in Phase 1", which
                counted a 90-day run in 30-day blocks — nothing ticks per day,
                and the count comes from `config.totalRounds`, not a fixed 3.
                `—` while the operator's total is unknown (standalone play);
                inventing one would state a horizon nobody configured. */}
            <span className="hint text-[#E8DCBE] truncate">
              Phase <span className="num-xs">{phase}</span>
              <span className="text-[#9F7F52]"> / </span>
              <span className="tabular-nums">{totalRounds ?? '—'}</span>
            </span>
          </div>
        </div>

        {/* The ROOM, next to the run. Round + facilitator's clock + team name
            used to sit in the top bar, where they were the widest block that
            could not shrink and pushed the projection dashboard over its
            neighbours. They read better here anyway: this bar already answers
            "where am I in the session", which is the same question. */}
        <SessionChip />

        {blockReason && (
          needsAnyNotebook ? (
            // Validation block has a fix the player can act on right now.
            // Render the warning as a clickable button that jumps the
            // user directly to the page that resolves it. The pulse
            // draws attention; the right-arrow + cursor-pointer signal
            // "tap me." Subtle but unmistakable on first run.
            <Tooltip
              content="Add a notebook on the Product page first."
              placement="top"
            >
            <button
              type="button"
              onClick={() => {
                playSfx('whoosh');
                // Cross-component navigation via custom event so we
                // don't need to lift page/tab state into the store.
                // SimulationScreen listens for this and switches section.
                window.dispatchEvent(
                  new CustomEvent('intlabs:goto', { detail: { page: 'notebook' } }),
                );
              }}
              className={clsx(
                'game-warn-chip order-3 sm:order-none w-full sm:w-auto sm:ml-auto cursor-pointer ready-pulse hover:brightness-105',
                shakeWarn && 'anim-shake',
              )}
              role="alert"
              aria-label={`${blockReason} Tap to fix.`}
            >
              <PixelIcon kind="warning" size={11} color="var(--c-warning)" />
              <span className="truncate">{blockReason}</span>
              <span className="ml-1 hidden sm:inline-flex items-center eyebrow eyebrow-sm opacity-75">
                Tap to fix
              </span>
              <PixelIcon kind="arrow-right" size={10} color="var(--c-warning)" />
            </button>
            </Tooltip>
          ) : (
            <span
              className={clsx(
                'game-warn-chip order-3 sm:order-none w-full sm:w-auto sm:ml-auto',
                shakeWarn && 'anim-shake',
              )}
              role="alert"
            >
              <PixelIcon kind="warning" size={11} color="var(--c-warning)" />
              <span className="truncate">{blockReason}</span>
            </span>
          )
        )}

        <div className={blockReason ? 'hidden sm:block' : 'sm:ml-auto'} />

        {/* The round's paperwork, immediately LEFT of the confirm button —
            documents you consult before committing the round, beside the
            control that commits it. */}
        <RoundDocuments />

        {/* When validation passes, the CTA quietly pulses to telegraph
             "ready to commit". When blocked, the button still RECEIVES
             clicks (so we can surface guidance) but is styled as
             disabled — opacity + grayscale on `.game-btn--blocked`.
             Native `disabled` would silently swallow clicks and leave
             the user without feedback. */}
        <Tooltip
          content={blocked
            ? blockReason ?? 'Cannot confirm phase right now.'
            : `Lock decisions for Phase ${phase} and run the simulation to Day ${phase * 30}.`}
          placement="top"
        >
        <button
          onClick={tryConfirm}
          aria-disabled={blocked}
          className={clsx(
            'game-btn min-h-[44px] w-full sm:w-auto',
            !blocked && 'ready-pulse',
            blocked && 'game-btn--blocked',
          )}
        >
          <PixelIcon kind="check" size={13} color="#12301C" />
          <span className="btn-label uppercase">
            <span className="sm:hidden">Confirm Phase {phase}</span>
            <span className="hidden sm:inline">{phaseTitle}</span>
          </span>
          <PixelIcon kind="arrow-right" size={13} color="#12301C" />
        </button>
        </Tooltip>
      </div>

      <PhaseSequenceModal
        key={openCount}
        open={open}
        onClose={() => setOpen(false)}
        liveProjection={liveProjection ?? null}
      />
    </>
  );
}

/** The case study PDF, hosted outside the app. */
const CASE_STUDY_URL =
  'https://drive.google.com/file/d/1JaipoMFrGe5T3LKEp2owf85L2QjXytGb/view';

/**
 * The round's paperwork — the three documents a player can open before
 * committing the round. They sit immediately LEFT of the confirm button: the
 * things you consult, beside the control you consult them for.
 *
 * TWO OF THEM ARE GATED ON A SCORED ROUND. `roundContext.roundNumber` is the
 * server's own 0-BASED round; round 0 is the first and has nothing to report
 * until the operator calculates it, so `roundNumber > 0` is the gate. The Case
 * Study is a fixed document and is never gated.
 *
 * ⚠ COMPETITOR REPORT WILL 403 TODAY. `/reports/:kind` is
 * `authorize([ADMIN, OPERATOR])` on the server, deliberately — the report shows
 * every team's figures side by side. The button is wired to the same endpoint
 * the admin console uses and surfaces the server's own message. Whether teams
 * may read it is QA's call, NOT a client fix. See `downloadRoundReport`.
 */
function RoundDocuments() {
  const setScreen = useGame((s) => s.setScreen);
  const showToast = useGame((s) => s.showToast);
  const { roundContext } = useGamesimSession();
  const [busy, setBusy] = useState(false);

  // The SERVER's own round number, taken from `roundContext` rather than
  // converted from the client's 1-based `phase` — one fewer conversion seam.
  const roundNumber = roundContext?.roundNumber ?? 0;
  // Nothing to report until a round past the first has begun, i.e. until
  // round 0 has been calculated.
  const isRoundScored = roundNumber > 0;
  const lockedWhy = 'Available once the first round has been calculated.';

  const openCompetitorReport = async () => {
    if (!roundContext || busy) return;
    setBusy(true);
    try {
      // The PREVIOUS round — the current one has not been scored yet.
      await downloadRoundReport({
        kind: 'competitor',
        simulationId: roundContext.simulationId,
        roundNumber: roundNumber - 1,
      });
    } catch (err) {
      showToast({
        kind: 'warning',
        text: err instanceof Error ? err.message : 'Could not fetch the competitor report.',
        ms: 2600,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    // `order-2` on phones so the documents sit under the phase summary and the
    // confirm button keeps the full-width bottom row it already had.
    <div className="order-2 sm:order-none flex flex-wrap items-center gap-1.5">
      <DocButton
        label="Debrief Slide"
        disabled={!isRoundScored}
        title={isRoundScored ? 'Reopen the last round debrief' : lockedWhy}
        onClick={() => { playSfx('click-soft'); setScreen('limbo'); }}
      />
      <DocButton
        label="Competitor Report"
        disabled={!isRoundScored || busy}
        title={isRoundScored ? 'Download the competitor report PDF' : lockedWhy}
        onClick={openCompetitorReport}
      />
      <DocButton
        label="Case Study"
        // `noopener` is not optional on a `_blank` link: without it the opened
        // page gets a handle on this one through `window.opener`.
        onClick={() => { playSfx('click-soft'); window.open(CASE_STUDY_URL, '_blank', 'noopener,noreferrer'); }}
        title="Open the case study (opens in a new tab)"
      />
    </div>
  );
}

/**
 * A document button — FILLED cream, dark ink.
 *
 * It was outlined, caramel-on-near-black, which on this bar was close to
 * invisible. Cream is the fill now and the text is ink. It still does not
 * compete with Confirm: that button is the primary GREEN, so the two read as
 * different kinds of control rather than two weights of the same one.
 */
function DocButton({
  label,
  onClick,
  disabled = false,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <Tooltip content={title} placement="top">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className={clsx(
          'min-h-[36px] px-2.5 border-2 border-ink-900 btn-label-sm uppercase whitespace-nowrap',
          'transition-[background-color,opacity,transform]',
          disabled
            // Still cream, just dimmed — a disabled control that changes
            // COLOUR reads as a different control rather than the same one
            // turned off.
            ? 'bg-cream-100/40 text-ink-900/45 border-ink-900/40 cursor-not-allowed'
            : 'bg-cream-100 text-ink-900 shadow-[2px_2px_0_0_var(--c-shadow)] hover:bg-cream-50 active:translate-y-px active:shadow-none cursor-pointer',
        )}
      >
        {label}
      </button>
    </Tooltip>
  );
}
