import { useState } from 'react';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { PhaseSequenceModal } from '@/components/PhaseSequenceModal';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { TOAST, VALIDATION } from '@/content/copy';
import { expandScript, SCRIPT_BEFORE_PHASE1_CONFIRM } from '@/content/mascotScripts';
import { playSfx } from '@/audio/audioManager';
import { Tooltip } from '@/components/primitives/Tooltip';

const PHASE_END = { 1: 30, 2: 60, 3: 90 } as const;

/**
 * Action bar that runs the entire current phase to its end day in one click.
 * Phase 1 = D1-30, Phase 2 = D31-60, Phase 3 = D61-90.
 *
 * Validation surfacing: when the user can't confirm yet (no audience selected
 * or game-state is blocked), the button is disabled AND a clearly-visible
 * inline reason renders next to it — so the user never has to guess why
 * nothing happened on click.
 */
export function PhaseActionBar() {
  const day = useGame((s) => s.meta.day);
  const phase = useGame((s) => s.meta.phase);
  const ended = useGame((s) => s.meta.ended);
  const pendingEvent = useGame((s) => s.meta.pendingEventId);
  const pendingEval = useGame((s) => s.meta.pendingEvalPhase);
  const segment = useGame((s) => s.market.targetSegment);
  const lineCount = useGame((s) => s.portfolio.productLines.length);
  const pushMascot = useGame((s) => s.pushMascot);
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);
  const showToast = useGame((s) => s.showToast);
  const [open, setOpen] = useState(false);
  // Bumped each time the modal opens so the modal remounts fresh —
  // prevents the previous run's "running" local state from persisting.
  const [openCount, setOpenCount] = useState(0);

  const target = PHASE_END[phase];
  const daysLeft = Math.max(0, target - day + 1);

  // Game-state blocks (engine forces resolution before continuing)
  const stateBlocked = ended || !!pendingEvent || pendingEval !== null;
  // Validation blocks (player needs to make a required decision)
  const needsAnyNotebook = lineCount === 0;
  const needsSegment = !segment;
  const blocked = stateBlocked || needsAnyNotebook || needsSegment;

  const blockReason = ended
    ? VALIDATION.runEnded
    : pendingEvent
    ? VALIDATION.pendingEvent
    : pendingEval !== null
    ? VALIDATION.pendingEval
    : needsAnyNotebook
    ? VALIDATION.noNotebook
    : needsSegment
    ? VALIDATION.noSegment
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
    if (needsSegment) {
      playSfx('warning');
      flashWarn();
      showToast({ kind: 'warning', text: TOAST.audienceFirst, ms: 2800 });
      pushMascot({
        id: 'no-segment',
        type: 'warning',
        body: 'Pick a market first - open the Design drawer and choose a genre. Without a market, demand stays cold no matter how nice the notebook looks.',
        priority: 1,
        mood: 'concerned_soft',
      });
      return;
    }
    // First Phase 1 confirm — push the "before you confirm" guidance
    // script so first-time players understand exactly what's about to
    // happen. The script de-dupes by id so it only fires once.
    if (phase === 1) {
      pushMascotSequence(expandScript(SCRIPT_BEFORE_PHASE1_CONFIRM));
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
            <span className="eyebrow eyebrow-sm text-[#9A7B4F]">Current Phase</span>
            <span className="hint text-[#E8DCBE] truncate">
              Day <span className="num-xs">{day}</span> / 90
              <span className="text-[#9A7B4F]"> · </span>
              <span className="tabular-nums">{daysLeft}d</span> left
              <span className="hidden sm:inline"> in Phase {phase}</span>
            </span>
          </div>
        </div>

        {blockReason && (
          (needsSegment || needsAnyNotebook) ? (
            // Validation block has a fix the player can act on right now.
            // Render the warning as a clickable button that jumps the
            // user directly to the page that resolves it. The pulse
            // draws attention; the right-arrow + cursor-pointer signal
            // "tap me." Subtle but unmistakable on first run.
            <Tooltip
              content={needsAnyNotebook
                ? 'Add a notebook on the Product page first.'
                : 'Open Design and pick a market genre so demand can build.'}
              placement="top"
            >
            <button
              type="button"
              onClick={() => {
                playSfx('whoosh');
                // Cross-component navigation via custom event so we
                // don't need to lift page/tab state into the store.
                // SimulationScreen + BusinessPage each listen for this
                // and update their local tab state.
                const detail = needsAnyNotebook
                  ? { page: 'product' }
                  : { page: 'business', tab: 'audience' };
                window.dispatchEvent(new CustomEvent('intlabs:goto', { detail }));
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
          <PixelIcon kind="check" size={13} color="#FAF7E8" />
          <span className="btn-label uppercase tracking-wide">
            <span className="sm:hidden">Confirm Phase {phase}</span>
            <span className="hidden sm:inline">{phaseTitle}</span>
          </span>
          <PixelIcon kind="arrow-right" size={13} color="#FAF7E8" />
        </button>
        </Tooltip>
      </div>

      <PhaseSequenceModal key={openCount} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
