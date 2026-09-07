import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { setActiveLine } from '@/engine/mockEngine';
import { playSfx } from '@/audio/audioManager';
import { A } from '@/assets';

/**
 * Prev / counter / next — changes which notebook is ACTIVE.
 *
 * ‹ 2/3 › as one cluster. Renders NOTHING below two notebooks: a control that
 * cannot move is worse than no control.
 *
 * `slideDir` is local and drives only the odometer roll. A caller that
 * animates something else off the same gesture — the canvas slides its hero —
 * passes `onCycle` and keeps its own copy of the direction.
 */
export function NotebookCycler({
  className,
  onCycle,
}: {
  /** Positioning. The canvas floats this over the hero; a sheet lays it in flow. */
  className?: string;
  /** −1 prev / +1 next, fired before the active line changes. */
  onCycle?: (dir: number) => void;
}) {
  const lines = useGame((s) => s.portfolio.productLines);
  const activeLineId = useGame((s) => s.portfolio.activeLineId);
  const apply = useGame((s) => s.apply);
  const reduced = useReducedMotion();
  const [slideDir, setSlideDir] = useState(0);

  if (lines.length < 2) return null;

  // `-1` when the active id is stale, which would make the counter read 0/n.
  const idx = Math.max(0, lines.findIndex((l) => l.id === activeLineId));

  const cycle = (dir: number) => {
    const next = (idx + dir + lines.length) % lines.length;
    playSfx('whoosh'); // movement, not a click
    setSlideDir(dir);
    onCycle?.(dir);
    apply((s) => setActiveLine(s, lines[next].id));
  };

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <button
        onClick={() => cycle(-1)}
        aria-label="Previous notebook"
        className="group/nav inline-flex items-center justify-center w-10 h-10 bg-surface border-2 border-border shadow-[2px_2px_0_0_var(--c-shadow)] hover:border-primary hover:scale-110 active:scale-95 transition-transform"
      >
        <img
          src={A.ui.pixel.arrow_left}
          alt=""
          className="w-[22px] h-[22px] object-contain transition-transform group-hover/nav:-translate-x-0.5"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
      </button>

      <div className="pointer-events-none inline-flex items-center gap-1 px-2.5 py-1.5 bg-ink-900/70 text-cream-100 eyebrow eyebrow-sm border border-black/40 tabular-nums overflow-hidden">
        {/* keyed flip — the counter rolls like an odometer */}
        <motion.span
          key={idx}
          initial={reduced ? false : { y: slideDir >= 0 ? 10 : -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.18, ease: [0.2, 1, 0.4, 1] }}
        >
          {idx + 1}
        </motion.span>
        <span>/ {lines.length}</span>
      </div>

      <button
        onClick={() => cycle(1)}
        aria-label="Next notebook"
        className="group/nav inline-flex items-center justify-center w-10 h-10 bg-surface border-2 border-border shadow-[2px_2px_0_0_var(--c-shadow)] hover:border-primary hover:scale-110 active:scale-95 transition-transform"
      >
        <img
          src={A.ui.pixel.arrow_right}
          alt=""
          className="w-[22px] h-[22px] object-contain transition-transform group-hover/nav:translate-x-0.5"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
      </button>
    </div>
  );
}
