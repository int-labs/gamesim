import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Tooltip } from '@/components/primitives/Tooltip';

export interface DockItem {
  id: string;
  /** Short label under the icon (1 word ideal). */
  label: string;
  /** Asset-url for the icon glyph. */
  icon: string;
  /** Richer hover hint. Falls back to the label. */
  tip?: string;
  /** Small count/indicator bubble (e.g. add-on count). */
  badge?: number | string | null;
}

interface Props {
  side: 'left' | 'right';
  items: DockItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  /** Vertical anchor on sm+ screens: edge-centered column (default) or
   *  pinned to the bottom corner. Below sm both docks become a compact
   *  bottom BAR row (thumb-reachable, never overlapping the hero). */
  anchor?: 'middle' | 'bottom';
}

/**
 * EdgeDock — a FLOATING group of large, tactile icon tiles hovering over the
 * canvas (the stage artwork stays visible behind and between them). Each tile
 * opens/closes a Drawer: idle staggered breathing, hover pop, press bounce;
 * the active tile gets a primary plate + edge accent bar.
 *
 * Layout: on sm+ a vertical column at its edge (`anchor` picks centered vs
 * bottom-corner); below sm a horizontal row pinned to the bottom corners so
 * phones get a game-style bottom control bar. Render INSIDE the canvas
 * region's `relative` container. Motion respects reduced-motion.
 */
export function EdgeDock({ side, items, activeId, onSelect, ariaLabel, anchor = 'middle' }: Props) {
  const reduced = useReducedMotion();
  return (
    // role="group" (not "toolbar") — toolbar promises roving-tabindex arrow
    // navigation per the ARIA APG; these are independent tab-stop buttons.
    <div
      role="group"
      aria-label={ariaLabel ?? (side === 'left' ? 'Notebook tools' : 'Stats')}
      // z-50 keeps the dock ABOVE an open Drawer (z-40) so it acts as a live
      // tab rail — you can hop Items → Design → … without closing first.
      className={clsx(
        'absolute z-50 flex flex-row sm:flex-col gap-1.5 sm:gap-3',
        // phones — bottom bar row at the corner
        'bottom-2 top-auto translate-y-0',
        side === 'left' ? 'left-2 sm:left-3' : 'right-2 sm:right-3',
        // sm+ — vertical column, centered or bottom-anchored
        anchor === 'middle'
          ? 'sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2'
          : 'sm:bottom-3 sm:top-auto sm:translate-y-0',
      )}
    >
      {items.map((it, i) => {
        const active = activeId === it.id;
        return (
          <Tooltip
            key={it.id}
            content={it.tip ?? it.label}
            placement={side === 'left' ? 'right' : 'left'}
          >
            <motion.button
              type="button"
              onClick={() => onSelect(it.id)}
              aria-pressed={active}
              aria-label={it.label}
              className={clsx(
                'group relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 w-[54px] sm:w-[84px] py-1.5 sm:py-3 border-2 cursor-pointer select-none transition-colors',
                'shadow-[3px_3px_0_0_var(--c-shadow)]',
                // NOTE: no `/alpha` on semantic colors — they're CSS vars
                // without <alpha-value>, so `bg-surface/95` silently emits
                // nothing and the tile renders transparent.
                active
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface hover:border-primary',
              )}
              initial={false}
              animate={reduced || active ? { y: 0 } : { y: [0, -2.5, 0] }}
              transition={
                reduced || active
                  ? { duration: 0.2 }
                  : { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }
              }
              whileHover={
                reduced
                  ? undefined
                  : {
                      scale: 1.07,
                      rotate: [0, -2.5, 2.5, 0], // playful little wiggle
                      transition: { rotate: { duration: 0.35 }, scale: { duration: 0.15 } },
                    }
              }
              whileTap={{ scale: 0.93 }}
            >
              {/* Accent bar on the docked edge when active (columns only). */}
              {active && (
                <span
                  aria-hidden
                  className={clsx(
                    'hidden sm:block absolute inset-y-2 w-[3px] bg-primary',
                    side === 'left' ? '-left-[7px]' : '-right-[7px]',
                  )}
                />
              )}
              <span className="relative inline-flex items-center justify-center w-7 h-7 sm:w-11 sm:h-11">
                <img
                  src={it.icon}
                  alt=""
                  className="w-7 h-7 sm:w-10 sm:h-10 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  draggable={false}
                />
                {it.badge != null && it.badge !== '' && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] sm:min-w-[16px] sm:h-[16px] px-0.5 inline-flex items-center justify-center bg-primary-strong text-white item-name leading-none border border-border rounded-full tabular-nums">
                    {it.badge}
                  </span>
                )}
              </span>
              <span
                className={clsx(
                  'eyebrow eyebrow-sm tracking-wide leading-none text-center',
                  active ? 'text-primary' : 'text-text-2 group-hover:text-text',
                )}
              >
                {it.label}
              </span>
            </motion.button>
          </Tooltip>
        );
      })}
    </div>
  );
}
