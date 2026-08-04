import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Transition, Variants } from 'framer-motion';
import clsx from 'clsx';
import { CloseX } from './CloseX';

type Size = 'md' | 'lg' | 'full';

/** Preset panel widths. `full` is capped so it stays sane on ultrawides. */
const SIZE_WIDTH: Record<Size, string> = {
  md: 'min(720px, calc(100vw - 32px))',
  lg: 'min(1040px, calc(100vw - 32px))',
  full: 'min(1400px, calc(100vw - 32px))',
};

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  /** Explicit panel width — overrides `size` when both are given. */
  width?: string;
  /**
   * Preset panel width. `full` additionally pins the panel's HEIGHT to the
   * padded viewport, so it reads as a workspace rather than a card that grows
   * with its content — the body scrolls inside a stable frame.
   */
  size?: Size;
  /** Springy overshooting entrance + blurred backdrop, for hero panels. */
  playful?: boolean;
  children: ReactNode;
  hideClose?: boolean;
  align?: 'center' | 'top';
  className?: string;
  /**
   * Classes for the scrolling body region. Pass `p-0 overflow-hidden` when the
   * content manages its own scroll areas (e.g. a fixed rail beside a scrolling
   * panel), so the whole modal doesn't scroll as one block.
   */
  bodyClassName?: string;
}

export function PixelModal({ open, onClose, title, width, size = 'md', playful, children, hideClose, align = 'center', className, bodyClassName }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const panelWidth = width ?? SIZE_WIDTH[size];
  const panelStyle =
    size === 'full' && !width
      ? { width: panelWidth, height: 'min(920px, calc(100dvh - 32px))', maxHeight: 'calc(100dvh - 32px)' }
      : { width: panelWidth, maxHeight: 'calc(100dvh - 32px)' };

  // Named variants rather than inline targets: passing typed target objects
  // straight to initial/animate/exit makes TS blow the union budget (TS2590).
  // Reduced motion always wins — a spring that overshoots and counter-rotates
  // is exactly the kind of movement that setting exists to suppress.
  const panelVariants: Variants = reduced
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 }, gone: { opacity: 0 } }
    : playful
      ? {
          hidden: { y: 34, scale: 0.88, rotate: -1.5, opacity: 0 },
          shown: { y: 0, scale: 1, rotate: 0, opacity: 1 },
          gone: { y: 18, scale: 0.94, rotate: 0.8, opacity: 0 },
        }
      : {
          hidden: { y: 20, scale: 0.96, opacity: 0 },
          shown: { y: 0, scale: 1, opacity: 1 },
          gone: { y: 12, opacity: 0 },
        };

  const panelTransition: Transition = reduced
    ? { duration: 0.14 }
    : playful
      ? { type: 'spring', stiffness: 300, damping: 21, mass: 0.85 }
      : { duration: 0.22, ease: [0.2, 1.4, 0.4, 1] };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          // z-[100] keeps the modal above the canvas (z<10), the page
          // (z-30 sticky HUD), and the mascot (z-[60]). Add-ons inside
          // <NotebookCanvas> are clamped via `isolate` so they cannot
          // leak above this layer. `data-pixel-modal` lets lower layers
          // (e.g. Drawer) detect a stacked modal and yield Esc to it.
          data-pixel-modal
          className="fixed inset-0 z-[100] flex"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div
            className={clsx('absolute inset-0 bg-ink-900/55', playful && !reduced && 'backdrop-blur-[2px]')}
            onClick={onClose}
          />
          {/* This wrapper sits ABOVE the backdrop and spans the viewport, so
              the backdrop's own onClick can never fire — every outside click
              lands here instead. It therefore has to close too; the panel
              below stops propagation so inside clicks are unaffected. */}
          <div
            onClick={onClose}
            className={clsx('relative z-[110] w-full flex justify-center p-4', align === 'top' ? 'items-start pt-10' : 'items-center')}
          >
            <motion.div
              className={clsx('pixel-frame bg-cream-50 flex flex-col', className)}
              style={panelStyle}
              variants={panelVariants}
              initial="hidden"
              animate="shown"
              exit="gone"
              transition={panelTransition}
              // Stop click bubbling so clicks INSIDE the modal don't
              // propagate to the backdrop's onClick (which dismisses).
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                // Dark textured title bar: it reads as a window chrome rather
                // than another cream panel competing with the content below.
                <div className="panel-textured flex items-center justify-between gap-3 px-4 py-2.5 border-b-2 border-ink-900 bg-ink-800 shrink-0">
                  <div className="section-title text-cream-50">{title}</div>
                  {!hideClose && onClose && (
                    <button
                      onClick={onClose}
                      aria-label="Close"
                      className="shrink-0 grid place-items-center w-7 h-7 border-2 border-cream-100/50 text-cream-100 hover:text-ink-900 hover:bg-cream-100 hover:border-cream-100 transition-colors cursor-pointer"
                    >
                      {/* Drawn, not typed. The glyph used to be a ✕ character in
                          a `.eyebrow` span — and `.eyebrow` hardcodes
                          `color: var(--c-text-2)`, which beat the button's
                          `text-cream-100` and painted dark brown on the dark
                          header: 1.03:1, i.e. invisible. An SVG on
                          `currentColor` inherits the button's colour and its
                          hover swap, and renders identically in every font. */}
                      <CloseX />
                    </button>
                  )}
                </div>
              )}
              {/* Body scrolls when content exceeds viewport height — so
                  the modal stays anchored and the close button remains
                  reachable on small screens. */}
              {/* The default padding is only emitted when the caller doesn't
                  supply its own. Concatenating `p-4` with a caller's `p-0`
                  produces "p-4 … p-0" and which one wins depends on CSS source
                  order, not intent — an unpredictable layout. */}
              <div
                className={clsx(
                  'flex-1 min-h-0',
                  bodyClassName ?? 'p-4 overflow-y-auto',
                )}
              >
                {children}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
