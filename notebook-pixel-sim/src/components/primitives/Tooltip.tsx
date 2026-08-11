import {
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface Props {
  /** Tooltip body — string or any React node. */
  content: ReactNode;
  /** Single trigger child. The tooltip mirrors hover/touch on it. */
  children: ReactElement;
  /** Preferred placement. Falls back to the opposite edge if there's no room. */
  placement?: Placement;
  /** Open delay on hover (ms). Default 200. */
  hoverDelay?: number;
  /** Long-press duration on touch (ms). Default 400. */
  pressDelay?: number;
  /** Optional: skip the tooltip entirely (e.g. when content is empty). */
  disabled?: boolean;
  /** Max width in px. Default 280. */
  maxWidth?: number;
}

/**
 * Custom tooltip primitive. Replaces the browser's native `title=`
 * attribute everywhere we want a richer, faster, touch-aware hint.
 *
 * Behaviour:
 *   - Desktop  → 200ms hover delay open, 120ms close delay (so the
 *                user can move toward the tooltip without it flashing
 *                shut on micro-cursor jiggle).
 *   - Touch    → 400ms long-press to open. Any other touch / scroll /
 *                resize closes it. We do NOT keep tooltips persistently
 *                open on tap because that would shadow content; users
 *                expect a tooltip to be a peek.
 *   - Keyboard → focus opens (no delay), blur closes. Esc dismisses.
 *
 * Positioning:
 *   - Preferred placement (default 'top'). If there isn't room above,
 *     flips to bottom. Same logic for left/right.
 *   - Centers along the cross-axis of the trigger, then clamps to a
 *     8px viewport gutter so it never hangs off-screen.
 *
 * Rendered via a portal to `document.body` so it escapes any clipping
 * ancestor (panels with `overflow: hidden`, scroll containers, etc.).
 *
 * Accessibility:
 *   - role="tooltip" + a generated id, wired via `aria-describedby` on
 *     the trigger.
 *   - Esc closes any open tooltip.
 *   - Focus-visible on the trigger opens the tooltip without delay.
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  hoverDelay = 200,
  pressDelay = 400,
  disabled = false,
  maxWidth = 280,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; place: Placement } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const id = useId();

  const isTouch = useRef<boolean>(false);

  const clearTimers = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  const close = (delay = 0) => {
    clearTimers();
    if (delay <= 0) { setOpen(false); return; }
    closeTimer.current = window.setTimeout(() => setOpen(false), delay);
  };

  const computePosition = () => {
    const wrapper = triggerRef.current;
    const tip = tooltipRef.current;
    if (!wrapper) return;
    // The wrapper uses `display: contents` so its own bounding rect is
    // empty — measure the first element child (the actual trigger DOM)
    // instead.
    const measureTarget = (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
    const r = measureTarget.getBoundingClientRect();
    // Tooltip rect — fall back to a reasonable estimate before first paint.
    const tw = Math.min(maxWidth, tip?.offsetWidth || maxWidth);
    const th = tip?.offsetHeight || 40;
    const gap = 8;
    const margin = 8;

    let place: Placement = placement;

    // Vertical flip: if preferred top has no room, switch to bottom.
    if (place === 'top' && r.top - th - gap < margin) place = 'bottom';
    if (place === 'bottom' && r.bottom + th + gap > window.innerHeight - margin) place = 'top';
    if (place === 'left' && r.left - tw - gap < margin) place = 'right';
    if (place === 'right' && r.right + tw + gap > window.innerWidth - margin) place = 'left';

    let x = 0;
    let y = 0;
    if (place === 'top' || place === 'bottom') {
      x = r.left + r.width / 2 - tw / 2;
      y = place === 'top' ? r.top - th - gap : r.bottom + gap;
    } else {
      x = place === 'left' ? r.left - tw - gap : r.right + gap;
      y = r.top + r.height / 2 - th / 2;
    }
    // Clamp to viewport with margin.
    x = Math.max(margin, Math.min(window.innerWidth - tw - margin, x));
    y = Math.max(margin, Math.min(window.innerHeight - th - margin, y));
    setPos({ x, y, place });
  };

  // Reposition on open + after the tooltip has measured itself.
  useEffect(() => {
    if (!open) return;
    computePosition();
    // Re-measure once the tooltip element exists with real width/height.
    const id1 = window.requestAnimationFrame(computePosition);
    const id2 = window.requestAnimationFrame(computePosition);
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Global dismissers — Esc, scroll, resize, outside touch.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(0); };
    const onScroll = () => close(0);
    const onResize = () => close(0);
    const onTouch = (e: TouchEvent) => {
      const t = triggerRef.current;
      if (t && e.target instanceof Node && t.contains(e.target)) return;
      close(0);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('touchstart', onTouch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup timers on unmount.
  useEffect(() => () => clearTimers(), []);

  if (!isValidElement(children) || disabled || content === undefined || content === null || content === '') {
    return children;
  }

  // Trigger event handlers — bound to a wrapper span (see below). We
  // can't clone the child and attach a ref because many of our
  // children are function components (PixelChip, PixelButton, etc.)
  // which can't accept refs without forwardRef. Wrapping with a span
  // sidesteps that — the span captures bubbled events from the child
  // and reliably holds the position ref.
  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      isTouch.current = false;
      clearTimers();
      openTimer.current = window.setTimeout(() => setOpen(true), hoverDelay);
    }
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      clearTimers();
      close(120);
    }
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      isTouch.current = true;
      clearTimers();
      openTimer.current = window.setTimeout(() => setOpen(true), pressDelay);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' && openTimer.current) {
      // Released before the long-press fired — cancel.
      clearTimers();
    }
  };
  const onFocus = () => {
    if (!isTouch.current) {
      clearTimers();
      setOpen(true);
    }
  };
  const onBlur = () => close(0);
  const onClick = () => {
    // After a click, tooltips on touch should close — the user has
    // moved on to the action.
    if (isTouch.current) close(0);
  };

  const portal = pos
    ? createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key={id}
              ref={tooltipRef}
              role="tooltip"
              id={id}
              initial={{ opacity: 0, y: pos.place === 'top' ? 4 : pos.place === 'bottom' ? -4 : 0, x: pos.place === 'left' ? 4 : pos.place === 'right' ? -4 : 0, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.14, ease: [0.2, 1.4, 0.4, 1] }}
              style={{
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                maxWidth,
                zIndex: 1000,
                pointerEvents: 'none',
              }}
              className="px-2.5 py-1.5 border border-border bg-[#221710] text-[#FAF7E8] hint leading-snug shadow-[2px_2px_0_0_rgba(0,0,0,0.55)]"
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return (
    <>
      <span
        // `display: contents` makes this span layout-invisible so it
        // doesn't disturb flex/grid containers. It still captures
        // bubbled pointer events from the child trigger and holds the
        // position ref. Modern browsers all support `display: contents`.
        ref={(node) => { triggerRef.current = node as HTMLElement | null; }}
        style={{ display: 'contents' }}
        aria-describedby={open ? id : undefined}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={onClick}
      >
        {children}
      </span>
      {portal}
    </>
  );
}
