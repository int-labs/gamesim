import { motion, useReducedMotion } from 'framer-motion';
import { A } from '@/assets';

export interface Rank {
  grade: string;
  label: string;
  color: string;
  /** How hard the results screen should celebrate. */
  confetti: 'full' | 'calm' | 'none';
}

/**
 * Score → rank tier. Tunable; drives the badge, the confetti intensity and
 * the celebration tone (a rocky run gets a calm, respectful screen — no
 * confetti cannon for a 30/100).
 */
export function rankForScore(total: number): Rank {
  if (total >= 85) return { grade: 'S', label: 'Standout', color: '#e6b54a', confetti: 'full' };
  if (total >= 65) return { grade: 'A', label: 'Solid Run', color: '#5fb27a', confetti: 'full' };
  if (total >= 45) return { grade: 'B', label: 'Getting There', color: '#5b86c2', confetti: 'calm' };
  return { grade: 'C', label: 'Rocky Start', color: '#c2703e', confetti: 'none' };
}

/**
 * RankBadge — the run's grade as a rubber-stamp: slams in oversized, settles
 * at a slight tilt with a pixel drop-shadow. Reduced-motion = simple fade.
 */
export function RankBadge({ rank, delay = 0 }: { rank: Rank; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      role="img"
      aria-label={`Rank ${rank.grade} - ${rank.label}`}
      className="relative flex flex-col items-center justify-center w-[112px] h-[112px] shrink-0 border-4 bg-cream-50 shadow-[4px_4px_0_0_var(--c-shadow)] select-none"
      style={{ borderColor: rank.color }}
      initial={reduced ? { opacity: 0 } : { scale: 2.1, opacity: 0, rotate: -16 }}
      animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: -5 }}
      transition={reduced ? { duration: 0.2, delay } : { delay, type: 'spring', stiffness: 340, damping: 16 }}
    >
      {/* Top-tier flourish — S gets the gold star, A gets sparkles, perched
          on the stamp corner and popping in just after the slam lands. */}
      {(rank.grade === 'S' || rank.grade === 'A') && (
        <motion.img
          aria-hidden
          src={rank.grade === 'S' ? A.ui.pixel.star : A.ui.pixel.sparkles}
          alt=""
          className="absolute -top-3.5 -right-3.5 w-[30px] h-[30px] object-contain"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
          initial={reduced ? { opacity: 0 } : { scale: 0, opacity: 0, rotate: 40 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: 0 }}
          transition={reduced ? { duration: 0.2, delay: delay + 0.2 } : { delay: delay + 0.32, type: 'spring', stiffness: 380, damping: 14 }}
        />
      )}
      {/* pixel corner dots — stamp plate feel */}
      <span aria-hidden className="absolute top-1 left-1 w-[3px] h-[3px]" style={{ background: rank.color }} />
      <span aria-hidden className="absolute top-1 right-1 w-[3px] h-[3px]" style={{ background: rank.color }} />
      <span aria-hidden className="absolute bottom-1 left-1 w-[3px] h-[3px]" style={{ background: rank.color }} />
      <span aria-hidden className="absolute bottom-1 right-1 w-[3px] h-[3px]" style={{ background: rank.color }} />
      <span className="font-hud text-[42px] leading-none" style={{ color: rank.color }}>
        {rank.grade}
      </span>
      <span className="font-hud text-[8px] uppercase tracking-wider text-ink-700 mt-2 text-center px-1 leading-tight">
        {rank.label}
      </span>
    </motion.div>
  );
}
