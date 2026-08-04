import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import clsx from 'clsx';
import { A } from '@/assets';
import { playSfx } from '@/audio/audioManager';
import { PASSKEY } from '@/content/copy';
import { projectX, projectY, type StageMetrics } from './useStage';

/**
 * AcademyMascotStage — Amelia as a roaming "idle-lobby" greeter.
 *
 * She walks between scene spots (shop / river / bench / books), each with its
 * own pose + contextual dialogue, on a timer or when the user clicks the scene
 * (roamTick). She can be dragged anywhere and springs back.
 *
 * Architecture (kept robust after several iterations):
 *   • `idx` is the SINGLE source of truth — pose, position, and dialogue all
 *     derive from it, so they can't desync.
 *   • Position is set via `style.left/top` (instant, never lags); each move is
 *     masked by a soft opacity "appear", so there's only ONE mascot element.
 *   • The auto-roam timer is a setTimeout keyed on `idx`, so ANY move (auto or
 *     a manual click) re-arms the 9s countdown — no sudden double-move.
 *   • A separate INNER element handles drag via a transform offset (eased back
 *     to 0 on release) so drag never fights anything.
 *
 * Poses are all from 03_poses so they share the same in-frame scale (mixing in
 * an expression sprite, framed differently, was what looked "glitchy").
 */
const SPOTS = {
  shop: { x: 0.42, pose: A.mascot.poses.presenting_open_hand }, // at the door, welcoming
  river: { x: 0.13, pose: A.mascot.poses.pointing_left_explain }, // points out at the river
  bench: { x: 0.28, pose: A.mascot.poses.idle_soft_wave }, // waving by the lamp
  books: { x: 0.58, pose: A.mascot.poses.pointing_right_explain }, // points at the books/sign
} as const;
const ORDER = ['shop', 'river', 'bench', 'books'] as const;
const AREAS = PASSKEY.mascotAreas;
const REACTIONS = PASSKEY.mascotReactions;
const FEET_Y = 0.965;
const HEIGHT_FRAC = 0.46;

export function AcademyMascotStage({
  stage,
  reduced: reducedProp,
  roamTick,
}: {
  stage: StageMetrics;
  reduced?: boolean;
  roamTick: number;
}) {
  const reducedHook = useReducedMotion();
  const reduced = reducedProp ?? !!reducedHook;
  const [idx, setIdx] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [dragOff, setDragOff] = useState<{ x: number; y: number } | null>(null);
  const bounce = useAnimationControls();
  const fade = useAnimationControls();
  const clicks = useRef(0);
  const lineCursor = useRef(0);
  const firstRun = useRef(true);
  const lastMove = useRef(0);
  const hideTimer = useRef<number | null>(null);
  const dragInfo = useRef<{ id: number; sx: number; sy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const spot = SPOTS[ORDER[idx]];
  const size = Math.round(stage.rh * HEIGHT_FRAC);
  const left = Math.round(projectX(stage, spot.x) - size / 2);
  const top = Math.round(projectY(stage, FEET_Y) - size);
  // When she's on the left of the screen the bubble must open RIGHT (toward
  // center), otherwise it runs off the left edge and the text gets cropped.
  const bubbleRight = spot.x < 0.45;

  const showBubble = useCallback((text: string, ms = 3400) => {
    setBubble(text);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setBubble(null), ms);
  }, []);

  const advance = useCallback(() => {
    const now = performance.now();
    if (now - lastMove.current < 1200) return; // debounce
    lastMove.current = now;
    setIdx((i) => (i + 1) % ORDER.length);
  }, []);

  // Dialogue always follows the current spot (hidden during the walk).
  useEffect(() => {
    setBubble(null);
    // Soft "appear" at the new spot (position itself is instant via style).
    fade.start({ opacity: [0.3, 1], transition: { duration: reduced ? 0 : 0.45, ease: 'easeOut' } });
    const delay = firstRun.current ? 1100 : 700;
    firstRun.current = false;
    const id = window.setTimeout(() => {
      const area = AREAS.find((a) => a.spot === ORDER[idx]) ?? AREAS[0];
      showBubble(area.lines[lineCursor.current % area.lines.length]);
      lineCursor.current += 1;
    }, delay);
    return () => window.clearTimeout(id);
  }, [idx, showBubble, fade, reduced]);

  // Auto-roam — a fresh 9s timer after EACH move (keyed on idx), so a manual
  // click resets the countdown and she never lurches right after you nudge her.
  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(advance, 9000);
    return () => window.clearTimeout(id);
  }, [idx, reduced, advance]);

  // Roam on scene click.
  const seenTick = useRef(roamTick);
  useEffect(() => {
    if (roamTick === seenTick.current) return;
    seenTick.current = roamTick;
    advance();
  }, [roamTick, advance]);

  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);

  // ── Manual drag (composes with the slide; springs back on release) ───────
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    dragInfo.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragInfo.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (d.moved) setDragOff({ x: dx, y: dy });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragInfo.current;
    if (!d || d.id !== e.pointerId) return;
    dragInfo.current = null;
    if (d.moved) {
      suppressClick.current = true;
      setDragOff(null); // CSS transition springs her back
    }
  };

  const onActivate = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    clicks.current += 1;
    playSfx('pop');
    showBubble(REACTIONS[(clicks.current - 1) % REACTIONS.length]);
    if (!reduced) bounce.start({ scale: [1.06, 0.97, 1], transition: { duration: 0.4 } });
    if (clicks.current % 5 === 0) {
      playSfx('coin');
      if (!reduced) confetti({ particleCount: 60, spread: 70, origin: { x: 0.4, y: 0.7 }, scalar: 0.8 });
    }
  };

  if (!stage.rw) return null;

  return (
    <motion.div
      className="absolute z-[15] select-none"
      style={{ left, top, width: size, height: size }}
      initial={{ opacity: 0 }}
      animate={fade}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
        style={{
          touchAction: 'none',
          transform: dragOff ? `translate(${dragOff.x}px, ${dragOff.y}px)` : 'translate(0px, 0px)',
          transition: dragOff ? 'none' : 'transform 0.45s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Ground contact shadow — grounds her (no floating). */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-ink-900/40"
          style={{
            bottom: Math.round(size * 0.04),
            width: Math.round(size * 0.42),
            height: Math.round(size * 0.07),
            filter: 'blur(4px)',
          }}
        />

        {/* Speech bubble — opens toward screen-center (never off-edge), tail
            points down to her. */}
        <AnimatePresence>
          {bubble && (
            <motion.div
              key={bubble}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className={clsx(
                'absolute bottom-full z-10 mb-2 w-max max-w-[270px]',
                bubbleRight ? 'left-1/2' : 'right-1/2',
              )}
            >
              <div
                className={clsx(
                  'relative rounded-2xl border-2 border-ink-900 bg-cream-50 px-4 py-3 text-left font-body body-xs leading-snug text-balance text-ink-900',
                  bubbleRight ? 'rounded-bl-none' : 'rounded-br-none',
                )}
                style={{ boxShadow: '3px 3px 0 0 var(--c-shadow)' }}
              >
                {bubble}
                <span
                  aria-hidden
                  className={clsx(
                    'absolute top-full h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-ink-900 bg-cream-50',
                    bubbleRight ? 'left-4' : 'right-4',
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label="Talk to Amelia (drag to move)"
          onClick={onActivate}
          animate={bounce}
          style={{ transformOrigin: 'bottom center' }}
          className="block h-full w-full cursor-grab border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#6FBB85]/70 active:cursor-grabbing"
        >
          {/* Breathing (scale from the feet), not a floating bob. */}
          <motion.span
            className="block h-full w-full"
            style={{ transformOrigin: 'bottom center' }}
            animate={reduced ? undefined : { scaleY: [1, 1.018, 1], scaleX: [1, 0.992, 1] }}
            transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src={spot.pose}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full object-contain object-bottom drop-shadow-[2px_4px_0_rgba(42,32,23,0.3)]"
            />
          </motion.span>
        </motion.button>
      </div>
    </motion.div>
  );
}
