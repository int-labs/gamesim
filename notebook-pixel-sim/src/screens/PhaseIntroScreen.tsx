import { MouseEvent, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { useGame } from '@/state/store';
import { A } from '@/assets';
import { PHASE_INTRO, LEARNING_POINTS } from '@/content/copy';
import { playSfx } from '@/audio/audioManager';
import { HeartRain, patHeartRain, originOf } from '@/components/fx/HeartRain';
import clsx from 'clsx';
import { useTotalRounds } from '@/gamesim/GamesimProvider';

// Round art is a cycled list, not a table keyed 1/2/3: the round count is operator-configured.
const ROUND_BG = [A.env.round1, A.env.round2, A.env.round3, A.env.round4];

// Full-body poses only, all gesturing toward screen-right where the panel sits.
const ROUND_POSE = [
  A.mascot.poses.presenting_open_hand,
  A.mascot.poses.pointing_right_explain,
  A.mascot.poses.presenting,
  A.mascot.poses.pointing_right,
  A.mascot.poses.idle_soft_wave,
];

/** Cycle a list by 1-based round, so it never runs out and never returns undefined. */
const forRound = <T,>(list: readonly T[], phase: number): T =>
  list[(Math.max(1, phase) - 1) % list.length];

// Splits the authored title into its eyebrow half and its theme half.
function splitTitle(title: string): [string, string] {
  const m = title.match(/\s[---]\s/);
  if (!m || m.index === undefined) return ['', title];
  return [title.slice(0, m.index).trim(), title.slice(m.index + m[0].length).trim()];
}

/** Manga concentration lines that burst on entry and fade. */
function FocusLines({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[8]"
      style={{
        background:
          'repeating-conic-gradient(from 0deg at 50% 52%, rgba(0,0,0,0.55) 0deg 0.55deg, transparent 0.55deg 2.4deg)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 52%, transparent 22%, #000 60%)',
        maskImage: 'radial-gradient(circle at 50% 52%, transparent 22%, #000 60%)',
      }}
      initial={{ opacity: 0, scale: 1.18 }}
      animate={{ opacity: [0, 0.55, 0], scale: [1.18, 1, 1.05] }}
      transition={{ duration: 1.3, ease: [0.15, 0.9, 0.3, 1], delay: 0.15 }}
    />
  );
}

/** The cinematic "get ready" screen before a phase begins. */
export function PhaseIntroScreen() {
  const phase = useGame((s) => s.meta.phase);
  const totalRounds = useTotalRounds();
  const setScreen = useGame((s) => s.setScreen);
  const apply = useGame((s) => s.apply);
  const reduced = useReducedMotion();

  // Pat the hero pose: same squash-and-stretch + escalating love bomb as the
  // other two Amelias, so the gesture means the same thing everywhere.
  const [patting, setPatting] = useState(false);
  const patCount = useRef(0);
  const heroRef = useRef<HTMLImageElement>(null);
  const onPat = () => {
    patCount.current += 1;
    playSfx('pop');
    setPatting(true);
    patHeartRain(patCount.current, originOf(heroRef.current));
  };

  // Authored copy covers rounds 1-3; round 4+ reuses it in the same cycle as the art.
  const introKeys = Object.keys(PHASE_INTRO)
    .map(Number)
    .sort((a, b) => a - b) as (keyof typeof PHASE_INTRO)[];
  const info = PHASE_INTRO[forRound(introKeys, phase)];
  const lp = LEARNING_POINTS[info.learningFocus as keyof typeof LEARNING_POINTS];

  // Only the theme half of the authored title is used; there is no day range on this card.
  const [, theme] = splitTitle(info.title);

  // ── Parallax: MASCOT ONLY, and gentle. Cursor → [-1, 1], spring, small fan. ──
  const mvx = useMotionValue(0);
  const mvy = useMotionValue(0);
  const cfg = { stiffness: 55, damping: 16, mass: 0.6 };
  const sx = useSpring(mvx, cfg);
  const sy = useSpring(mvy, cfg);
  const charX = useTransform(sx, [-1, 1], [-12, 12]);
  const charY = useTransform(sy, [-1, 1], [-7, 7]);

  const onMove = (e: MouseEvent) => {
    if (reduced) return;
    mvx.set((e.clientX / window.innerWidth) * 2 - 1);
    mvy.set((e.clientY / window.innerHeight) * 2 - 1);
  };

  const start = () => {
    playSfx('whoosh');
    apply((s) => {
      s.meta.started = true;
    });
    setScreen('simulation'); // ScreenTransition plays the pixel wipe on entry
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-900" onMouseMove={onMove}>
      {/* Scene background, slowest parallax layer, over-scaled so it never
          shows an edge as it drifts. */}
      <img
        src={forRound(ROUND_BG, phase)}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/* Heavier cinematic dimming so the mascot + panel pop off a dark scene. */}
      <div className="pointer-events-none absolute inset-0 bg-ink-900/55" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-900/90 via-ink-900/50 to-ink-900/85" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/90 via-transparent to-ink-900/45" />

      {/* Manga "before the battle" focus lines, burst in on entry, then fade. */}
      <FocusLines reduced={!!reduced} />

      {/* The mascot and panel as one centred group; z-auto so the letterbox bars still layer between them. */}
      <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-8">
        {/* !important `items-stretch` and no `h-full`: the row takes its height from the card. */}
        <div className="flex max-h-full w-full max-w-[min(94vw,1360px)] items-stretch justify-center gap-4 sm:gap-8 lg:gap-12">
          {/* Mascot column, the card's height. Hidden below md so the panel
              stands alone on small screens. */}
          <div className="relative hidden w-[42%] max-w-[min(38vw,520px)] shrink-0 md:block">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[4]"
              style={{ background: 'radial-gradient(46% 46% at 50% 56%, rgba(255,214,150,0.15), transparent 72%)' }}
              animate={reduced ? undefined : { opacity: [0.7, 1, 0.7], scale: [1, 1.05, 1] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <HeartRain className="pointer-events-none absolute inset-0 z-[9]" />
            <motion.div
              style={{ x: charX, y: charY }}
              className="pointer-events-none absolute inset-0 z-[10]"
            >
              <motion.div
                initial={reduced ? false : { y: 70, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.85, ease: [0.2, 1, 0.35, 1], delay: 0.35 }}
                whileHover={reduced ? undefined : { scale: 1.03 }}
                className="pointer-events-auto h-full w-full origin-bottom"
              >
                {/* !important `object-contain`, not cover: cover crops the long axis and cut her arms off. */}
                <motion.img
                  ref={heroRef}
                  src={forRound(ROUND_POSE, phase)}
                  alt=""
                  draggable={false}
                  onClick={onPat}
                  style={{ transformOrigin: 'bottom center' }}
                  animate={reduced ? undefined : { scaleY: [1, 1.016, 1], scaleX: [1, 0.994, 1] }}
                  transition={{ duration: 3.9, repeat: Infinity, ease: 'easeInOut' }}
                  className={clsx(
                    'h-full w-full object-contain object-bottom cursor-pointer drop-shadow-[8px_12px_0_rgba(0,0,0,0.42)]',
                    patting && 'mascot-pat',
                  )}
                  onAnimationEnd={(e) => { if (/mascot-pat/.test(e.animationName)) setPatting(false); }}
                />
              </motion.div>
            </motion.div>
          </div>

          {/* ── Exciting UI panel ── */}
          <motion.div
            initial={reduced ? false : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.2, 1.2, 0.4, 1], delay: 0.12 }}
            whileHover={reduced ? undefined : { y: -3 }}
            className="pixel-frame z-[30] w-full max-w-[min(42vw,560px)] shrink overflow-hidden bg-cream-50 shadow-[8px_10px_0_0_rgba(0,0,0,0.4)]"
          >
          <div className="p-6 sm:p-7">
            {/* !important phase, not round: "round" is the server's unit and never reaches the player. */}
            <motion.div
              initial={reduced ? false : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.4 }}
              className="mb-3 flex flex-wrap items-center gap-2"
            >
              {/* "of M" comes from `simulation.config.totalRounds`; omitted when unknown. */}
              <motion.span
                initial={reduced ? false : { scale: 1.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.34, duration: 0.4, ease: [0.2, 1.7, 0.3, 1] }}
                className="inline-block bg-brand-500 px-2 py-1 eyebrow eyebrow-sm text-cream-50"
              >
                {totalRounds ? `Phase ${phase} of ${totalRounds}` : `Phase ${phase}`}
              </motion.span>
            </motion.div>

            {/* Big theme title, punches in from the left. */}
            <motion.h1
              initial={reduced ? false : { scale: 1.14, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.5, ease: [0.2, 1.5, 0.3, 1] }}
              className="origin-left h2 uppercase leading-[1.05] text-ink-900 sm:text-[33px]"
            >
              {theme}
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={reduced ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.42, duration: 0.45 }}
              className="mt-3 font-body body-xs leading-relaxed text-ink-800"
            >
              {info.body}
            </motion.p>

            {/* Learning focus, what to watch for this phase */}
            <motion.div
              initial={reduced ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.45 }}
              className="mt-4 border-2 border-primary bg-primary-soft px-3 py-2.5"
            >
              {/* The pill shares one centred row with the title it labels. */}
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 bg-primary-strong px-1.5 py-0.5 eyebrow eyebrow-sm leading-none text-cream-50">
                  {info.learningFocus}
                </span>
                <div className="item-name text-text min-w-0 truncate">{lp.title}</div>
              </div>
              <div className="hint leading-snug text-text-2 mt-1.5">{lp.blurb}</div>
            </motion.div>
          </div>

          {/* The footer's duplicate label is gone; the pill states the phase. */}
          <div className="flex items-center justify-end gap-3 border-t border-border-soft bg-cream-200 p-4 sm:px-6">
            <motion.button
              type="button"
              onClick={start}
              initial={reduced ? false : { scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4, ease: [0.2, 1.5, 0.4, 1] }}
              whileHover={reduced ? undefined : { y: -2, filter: 'brightness(1.06)' }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center gap-2 overflow-hidden border-2 border-ink-900 bg-primary px-5 py-3 btn-label uppercase text-inherit text-ink-900 shadow-[3px_3px_0_0_var(--c-shadow)]"
            >
              {/* gentle "ready" pulse behind the label */}
              {!reduced && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-0 bg-primary"
                  animate={{ opacity: [0, 0.35, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <span className="relative">{`Start Phase ${phase}`}</span>
              <motion.span
                aria-hidden
                className="relative"
                animate={reduced ? undefined : { x: [0, 3, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              >
                →
              </motion.span>
            </motion.button>
          </div>
          </motion.div>
        </div>
      </div>

      {/* Cinematic letterbox bars. Decoration only now that the mascot is not cropped. */}
      <motion.div
        aria-hidden
        initial={reduced ? false : { y: '-101%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.55, ease: [0.3, 1, 0.4, 1] }}
        className="pointer-events-none absolute inset-x-0 top-0 z-[20] h-[7%] max-h-[68px] bg-ink-900"
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-ink-700/50" />
      </motion.div>
      <motion.div
        aria-hidden
        initial={reduced ? false : { y: '101%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.55, ease: [0.3, 1, 0.4, 1] }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[20] h-[16%] max-h-[176px] min-h-[84px] bg-ink-900"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-ink-700/50" />
      </motion.div>

      {/* Warm "impact" flash the moment the screen lands. */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[45]"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ background: 'radial-gradient(58% 62% at 40% 55%, rgba(255,238,198,0.55), rgba(255,214,150,0.12) 55%, transparent 78%)' }}
        />
      )}
    </div>
  );
}
