import { ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { CloseX } from '@/components/primitives/CloseX';

interface Props {
  open: boolean;
  side?: 'left' | 'right';
  title?: ReactNode;
  /** Optional asset-url glyph shown before the title. */
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Panel width (CSS length). Percentages resolve against the drawer's
   * POSITIONING CONTAINER (the canvas region), not the viewport — the region
   * is narrower than the viewport (edge docks flank it), so viewport units
   * would overflow and clip on phones.
   */
  width?: number | string;
  /** Extra classes for the scrolling body region. */
  bodyClassName?: string;
  /**
   * Position classes for the panel's docked edge (default `left-0`/`right-0`).
   * Pass e.g. `left-0 sm:left-[104px]` to slide in BESIDE a floating dock
   * instead of underneath it.
   */
  panelOffsetClassName?: string;
  /**
   * Stealth mode — keeps the drawer MOUNTED but invisible & untouchable.
   * Used while dragging an add-on out: unmounting the drag source would make
   * dnd-kit cancel the drag, so we fade the drawer away instead and reveal
   * the canvas underneath for the drop.
   */
  stealth?: boolean;
}

/**
 * Drawer — a slide-in overlay panel anchored to one edge of its POSITIONED
 * parent. Give the parent `relative overflow-hidden` so the panel is clipped
 * while it slides in/out. A dim backdrop covers the area behind it; Esc, the
 * backdrop, and the ✕ all dismiss (Esc defers to any stacked PixelModal).
 * Focus moves into the panel on open and Tab is trapped inside, so keyboard
 * users can't land on controls hidden behind the backdrop. Slides from its
 * side; under reduced-motion it simply fades.
 */
export function Drawer({
  open,
  side = 'left',
  title,
  icon,
  onClose,
  children,
  width = 'min(384px, 100%)',
  bodyClassName,
  panelOffsetClassName,
  stealth = false,
}: Props) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A modal stacked above (event / evaluation / confirm) owns Esc —
      // don't also close the drawer hidden beneath it.
      if (document.querySelector('[data-pixel-modal]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the panel on open; return it to the opener on close.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => prev?.focus?.();
  }, [open]);

  // Minimal focus trap — wrap Tab within the panel.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = panelRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const hiddenX = reduced ? 0 : side === 'left' ? '-102%' : '102%';

  return (
    <AnimatePresence>
      {open && (
        <div
          className={clsx(
            'absolute inset-0 z-40 transition-opacity duration-150',
            stealth && 'opacity-0 pointer-events-none',
          )}
          role="dialog"
          aria-modal="true"
          aria-hidden={stealth || undefined}
          aria-label={typeof title === 'string' ? title : 'Panel'}
        >
          <motion.div
            className="absolute inset-0 bg-ink-900/45"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.aside
            ref={panelRef as any}
            tabIndex={-1}
            onKeyDown={trapTab}
            className={clsx(
              'absolute inset-y-0 flex flex-col panel-frame bg-surface outline-none',
              side === 'left'
                ? 'shadow-[8px_0_28px_-10px_rgba(0,0,0,0.5)]'
                : 'shadow-[-8px_0_28px_-10px_rgba(0,0,0,0.5)]',
              panelOffsetClassName ?? (side === 'left' ? 'left-0' : 'right-0'),
            )}
            style={{ width, maxWidth: '100%' }}
            initial={{ x: hiddenX, opacity: reduced ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: hiddenX, opacity: reduced ? 0 : 1 }}
            transition={
              reduced ? { duration: 0.14 } : { type: 'spring', stiffness: 440, damping: 40 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b-2 border-border-soft bg-surface-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {icon && (
                  <img
                    src={icon}
                    alt=""
                    className="w-5 h-5 object-contain shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                    draggable={false}
                  />
                )}
                <span className="panel-title text-text truncate">{title}</span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="game-hud-iconbtn shrink-0 text-text-2"
              >
                <CloseX />
              </button>
            </header>
            <div className={clsx('flex-1 min-h-0 overflow-y-auto p-3.5', bodyClassName)}>
              {children}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
