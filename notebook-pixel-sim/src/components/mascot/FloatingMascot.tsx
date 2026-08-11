import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { A } from '@/assets';
import type { BubbleType, MascotMood } from '@/types';
import { PixelIcon } from '@/components/icons/PixelIcon';

const tones: Record<BubbleType, { bg: string; border: string; tag: string }> = {
  hint:     { bg: 'bg-surface',         border: 'border-border-soft', tag: 'text-text-2' },
  warning:  { bg: 'bg-warning-soft',    border: 'border-warning',     tag: 'text-warning' },
  success:  { bg: 'bg-success-soft',    border: 'border-success',     tag: 'text-success' },
  event:    { bg: 'bg-info-soft',       border: 'border-info',        tag: 'text-info' },
  insight:  { bg: 'bg-info-soft',       border: 'border-info',        tag: 'text-info' },
  debrief:  { bg: 'bg-secondary-soft',  border: 'border-secondary',   tag: 'text-secondary' },
  tutorial: { bg: 'bg-surface-2',       border: 'border-border',      tag: 'text-text-2' },
};

const labels: Record<BubbleType, string> = {
  hint: 'Hint',
  warning: 'Heads up',
  success: 'Nice',
  event: 'Event',
  insight: 'Insight',
  debrief: 'Debrief',
  tutorial: 'Tutorial',
};

const moodSrc: Record<MascotMood, string> = {
  neutral: A.mascot.expressions.neutral,
  happy: A.mascot.expressions.happy,
  happy_soft: A.mascot.expressions.happy_soft,
  excited: A.mascot.expressions.excited,
  excited_big: A.mascot.expressions.excited_big,
  thinking: A.mascot.expressions.thinking,
  thinking_side: A.mascot.expressions.thinking_side,
  concerned: A.mascot.expressions.concerned,
  concerned_soft: A.mascot.expressions.concerned_soft,
  confused: A.mascot.expressions.confused,
  confused_tilt: A.mascot.expressions.confused_tilt,
  warning: A.mascot.expressions.warning,
  warning_alert: A.mascot.expressions.warning_alert,
  pointing_left: A.mascot.poses.pointing_left,
  pointing_right: A.mascot.poses.pointing_right,
  pointing_left_explain: A.mascot.poses.pointing_left_explain,
  pointing_right_explain: A.mascot.poses.pointing_right_explain,
  presenting: A.mascot.poses.presenting,
  presenting_open_hand: A.mascot.poses.presenting_open_hand,
  idle: A.mascot.expressions.neutral,
  idle_soft_wave: A.mascot.poses.idle_soft_wave,
};

// Sprite size — bumped from 176 → 240 (~1.36×). Mascot reads as a clear,
// expressive presence; the bubble stays compact.
const SPRITE_SIZE = 240;
// Default bottom-right margin (used to compute the initial position).
const DEFAULT_MARGIN_RIGHT = 24;
const DEFAULT_MARGIN_BOTTOM = 140; // clears action bar
const NARROW_BP = 720;
// Distance threshold (px) before a pointerdown becomes a drag (prevents
// stealing clicks from buttons inside the bubble).
const DRAG_THRESHOLD = 4;

interface Pos { x: number; y: number }

/**
 * Amelia — the floating helper, draggable as a single widget.
 *
 * - Drag the SPRITE or the BUBBLE to move the whole assistant. Buttons
 *   inside the bubble (✓ dismiss, × hide) stop the drag from starting so
 *   they remain clickable.
 * - Position is clamped to the viewport on every drag and on resize, so the
 *   mascot can never get stuck off-screen after a window resize or browser
 *   zoom change.
 * - Position is persisted via the Zustand store (`mascot.position`) so the
 *   user's chosen spot survives across reloads in the current session.
 * - Closing (× button) hides the entire mascot; the top-bar mascot toggle
 *   reopens it. When reopened, position is preserved.
 */
export function FloatingMascot() {
  const current = useGame((s) => s.mascot.current);
  const mood = useGame((s) => s.mascot.mood);
  const minimized = useGame((s) => s.mascot.minimized);
  const storedPos = useGame((s) => s.mascot.position);
  const popMascot = useGame((s) => s.popMascot);
  const toggle = useGame((s) => s.toggleMascotMinimize);
  const setMascotPosition = useGame((s) => s.setMascotPosition);

  // Local position used for live drag updates (avoids store thrash on every
  // pointermove). Synced TO the store on pointerup, and FROM the store on
  // mount / when the store changes externally.
  const [pos, setPos] = useState<Pos | null>(storedPos ?? null);
  const [dragging, setDragging] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  // Bookkeeping for the active drag gesture
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const [narrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < NARROW_BP,
  );
  const [shown, setShown] = useState('');

  // No initial-position calculation needed. While `pos` is null we render
  // with CSS `right`/`bottom` (a guaranteed-safe corner). The first drag
  // promotes the widget to absolute `left/top` coordinates and from then on
  // the JS clamp keeps it inside the viewport.

  // Sync FROM store when external code repositions the mascot (rare).
  useEffect(() => {
    if (!storedPos) return;
    if (pos && storedPos.x === pos.x && storedPos.y === pos.y) return;
    setPos(storedPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedPos?.x, storedPos?.y]);

  // Re-clamp on viewport resize / zoom — keeps the widget visible.
  useEffect(() => {
    const onResize = () => {
      const widget = widgetRef.current;
      if (!widget) return;
      const w = widget.offsetWidth;
      const h = widget.offsetHeight;
      setNarrow(window.innerWidth < NARROW_BP);
      setPos((p) => (p ? clampToViewport(p, w, h) : p));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-clamp when the widget itself resizes (bubble opens / closes / message
  // length changes the bubble's height). Without this the widget can poke out
  // beyond the right edge when the bubble first appears.
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setPos((p) => (p ? clampToViewport(p, width, height) : p));
    });
    ro.observe(widget);
    return () => ro.disconnect();
  }, []);

  // Belt-and-braces: also re-clamp on the next animation frame whenever the
  // bubble's content reference changes. ResizeObserver doesn't always fire
  // for the initial appear-animation in some browsers.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const widget = widgetRef.current;
      if (!widget) return;
      const w = widget.offsetWidth;
      const h = widget.offsetHeight;
      setPos((p) => (p ? clampToViewport(p, w, h) : p));
    });
    return () => cancelAnimationFrame(id);
  }, [current?.id, minimized]);

  // Type-in effect on bubble body
  useEffect(() => {
    if (!current || minimized) {
      setShown('');
      return;
    }
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(current.body.slice(0, i));
      if (i >= current.body.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [current, minimized]);

  // ─── Drag handlers ──────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't start a drag from interactive controls inside the bubble.
    const target = e.target as HTMLElement;
    if (target.closest('[data-mascot-control]') || target.tagName === 'BUTTON') {
      return;
    }
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // If the widget hasn't been dragged yet, capture its current rendered
    // top-left as the drag origin (so the first drag picks up exactly where
    // the default right/bottom CSS placed it — no jump).
    const widget = widgetRef.current;
    const rect = widget?.getBoundingClientRect();
    const originX = pos?.x ?? rect?.left ?? 0;
    const originY = pos?.y ?? rect?.top ?? 0;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX,
      originY,
      moved: false,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      d.moved = true;
    }
    if (!d.moved) return;
    const widget = widgetRef.current;
    const w = widget?.offsetWidth ?? SPRITE_SIZE;
    const h = widget?.offsetHeight ?? SPRITE_SIZE;
    setPos(clampToViewport({ x: d.originX + dx, y: d.originY + dy }, w, h));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (d.moved) {
      // Persist the new position to the store
      setPos((p) => {
        if (p) setMascotPosition(p);
        return p;
      });
      // Suppress the click that browsers fire after pointerup if drag occurred
      e.preventDefault();
    }
  };

  // When minimized, hide entire mascot — top-bar toggle reopens it.
  if (minimized) return null;

  const open = !!current;
  const src = moodSrc[(current?.mood ?? mood) as MascotMood] ?? moodSrc.neutral;
  const tone = tones[current?.type ?? 'hint'];

  return (
    <div
      ref={widgetRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={clsx(
        // z-[60]: above page chrome (z-30/40) but below modals (z-[100]+).
        // Modals must always sit on top of the mascot.
        'fixed z-[60] select-none touch-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={
        pos
          ? {
              left: pos.x,
              top: pos.y,
              transition: dragging ? 'none' : undefined,
            }
          : {
              // Default: bottom-right corner via CSS, immune to widget size.
              right: DEFAULT_MARGIN_RIGHT,
              bottom: DEFAULT_MARGIN_BOTTOM,
            }
      }
      role="region"
      aria-label="Amelia assistant - drag to move"
    >
      <div
        className={clsx(
          'flex',
          narrow ? 'flex-col-reverse items-end gap-2' : 'flex-row-reverse items-end gap-3',
        )}
      >
        {/* Sprite */}
        <motion.div
          animate={{ y: dragging ? 0 : [0, -3, 0] }}
          transition={{ duration: dragging ? 0 : 2.6, repeat: dragging ? 0 : Infinity, ease: 'easeInOut' }}
          style={{ width: SPRITE_SIZE, height: SPRITE_SIZE }}
        >
          <img
            src={src}
            alt="Amelia"
            draggable={false}
            className="w-full h-full object-contain pointer-events-none"
            style={{
              filter: dragging
                ? 'drop-shadow(3px 5px 0 rgba(42,32,23,0.35))'
                : 'drop-shadow(2px 3px 0 rgba(42,32,23,0.28))',
            }}
          />
        </motion.div>

        {/* Bubble */}
        <AnimatePresence>
          {open && current && (
            <motion.div
              key={current.id}
              initial={{ y: narrow ? 6 : 0, x: narrow ? 0 : 8, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, x: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }}
              className={clsx('relative border-2 mb-2', tone.bg, tone.border)}
              style={{
                boxShadow: '3px 3px 0 0 var(--c-shadow)',
                // Bubble width reserves room for the larger sprite + gap.
                width: `min(340px, calc(100vw - 64px - ${SPRITE_SIZE}px))`,
                minWidth: narrow ? 'min(280px, calc(100vw - 48px))' : 240,
              }}
            >
              {/* Bubble header */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-border-soft bg-surface/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <PixelIcon kind="mascot" size={11} color="var(--c-text-2)" />
                  <span className={clsx('eyebrow eyebrow-sm truncate', tone.tag)}>
                    Amelia · {labels[current.type]}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    data-mascot-control
                    onClick={popMascot}
                    aria-label="Dismiss"
                    title="Got it / next"
                    className="text-text-2 hover:text-text px-1.5 py-0.5 item-name cursor-pointer"
                  >
                    ✓
                  </button>
                  <button
                    data-mascot-control
                    onClick={toggle}
                    aria-label="Hide Amelia"
                    title="Hide Amelia (re-open from top bar)"
                    className="text-text-2 hover:text-danger px-1.5 py-0.5 cursor-pointer"
                  >
                    <PixelIcon kind="close" size={10} />
                  </button>
                </div>
              </div>

              {/* Bubble body */}
              <div className="px-3.5 py-3 body-xs leading-snug text-text whitespace-pre-wrap min-h-[44px]">
                {shown}
                {shown.length < current.body.length && (
                  <span className="opacity-60 animate-pulse">▌</span>
                )}
              </div>

              {/* Tail */}
              <div
                aria-hidden
                className={clsx('absolute w-3 h-3 border-2 rotate-45', tone.bg, tone.border)}
                style={
                  narrow
                    ? {
                        bottom: -8,
                        right: 24,
                        borderLeftColor: 'transparent',
                        borderTopColor: 'transparent',
                      }
                    : {
                        right: -8,
                        bottom: 28,
                        borderTopColor: 'transparent',
                        borderRightColor: 'transparent',
                      }
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* Clamp a position so the widget remains entirely inside the viewport. */
function clampToViewport(p: Pos, width: number, height: number): Pos {
  if (typeof window === 'undefined') return p;
  const margin = 8;
  return {
    x: Math.max(margin, Math.min(window.innerWidth - width - margin, p.x)),
    y: Math.max(margin, Math.min(window.innerHeight - height - margin, p.y)),
  };
}
