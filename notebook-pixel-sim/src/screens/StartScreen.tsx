import { motion, useReducedMotion } from 'framer-motion';
import { A } from '@/assets';
import { useGame } from '@/state/store';
import { PixelButton } from '@/components/primitives';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { HOME } from '@/content/copy';
import { playSfx } from '@/audio/audioManager';

/**
 * Home / Start screen.
 *
 * For a fresh user (`meta.started === false`):
 *   - Single primary action: "Start business" → routes to RouteChoiceScreen.
 *
 * For a returning user (`meta.started === true`, i.e. a saved run exists):
 *   - "Continue" → resumes wherever the player left off (simulation, or
 *     phase intro if a phase boundary just ticked).
 *   - "Start new game" → fully resets via `reset()` then routes to
 *     RouteChoiceScreen.
 *
 * The Home screen is the entry point on EVERY fresh load — `meta.screen`
 * is force-reset to 'start' on every persist (see store.ts partialize).
 */
export function StartScreen() {
  const reduced = useReducedMotion();
  const setScreen = useGame((s) => s.setScreen);
  const reset = useGame((s) => s.reset);
  const started = useGame((s) => s.meta.started);
  const day = useGame((s) => s.meta.day);
  const phase = useGame((s) => s.meta.phase);
  const ended = useGame((s) => s.meta.ended);
  const route = useGame((s) => s.meta.route);

  // A saved-in-progress game requires both `started === true` AND a route
  // already chosen. Otherwise the player never made it past Home → Route.
  const hasSavedRun = started && route !== null && !ended;

  const onContinue = () => {
    playSfx('whoosh');
    setScreen('simulation');
  };

  const onStartNew = () => {
    playSfx('coin');
    reset();
    setScreen('route');
  };

  const onStartFirst = () => {
    playSfx('coin');
    setScreen('route');
  };

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Slow Ken-Burns drift — the desk breathes instead of sitting frozen. */}
      <motion.img
        src={A.env.deskFull}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
        initial={false}
        animate={reduced ? undefined : { scale: [1.04, 1.11, 1.04], x: [0, -14, 0], y: [0, -8, 0] }}
        transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-ink-900/30" />
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-6">
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
          <img src={A.logo} alt="int labs" className="h-12 mb-4 mx-auto" draggable={false} />
        </motion.div>
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="pixel-frame bg-cream-50 max-w-[640px] w-full text-center"
        >
          <div className="px-6 pt-6 pb-2">
            {/* Title slams in with an arcade overshoot. */}
            <motion.h1
              initial={reduced ? false : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.18 }}
              className="h2 sm:eyebrow eyebrow-sm tracking-wide text-ink-900 leading-tight"
            >
              {HOME.title}
            </motion.h1>
            <p className="font-body body-xs text-ink-800 mt-3 max-w-[560px] mx-auto leading-relaxed">
              {HOME.tagline}
            </p>

            {/* "What you'll learn" — labelled divider over the LP grid. */}
            <div className="mt-5 flex items-center gap-2">
              <span className="eyebrow eyebrow-sm eyebrow-muted whitespace-nowrap">
                What you'll learn
              </span>
              <span aria-hidden className="h-px flex-1 bg-ink-900/15" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              {HOME.learningPoints.map((lp, i) => (
                <Lp key={lp.tag} t={lp.tag} body={lp.body} index={i} />
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mt-3 flex items-center justify-center gap-1.5 text-ink-600"
            >
              <span aria-hidden className="body-xs leading-none">🏆</span>
              <span className="font-body hint">Graded out of 100 on Day 90</span>
            </motion.div>
          </div>
          <div className="border-t border-border-soft bg-cream-200 p-4 flex flex-col gap-3 items-center">
            <div className="flex w-full max-w-[470px] items-center gap-3">
              {/* Head-cropped avatar (shared) - framing just her head/shoulders
                  reads far better than a full-body sprite in a small box. */}
              <MascotAvatar mood="happy_soft" size={76} />
              {/* Amelia's line as a little speech bubble pointing back at her. */}
              <div className="relative flex-1 text-left">
                <span
                  aria-hidden
                  className="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-ink-900 bg-cream-50"
                />
                <div className="rounded-lg border border-border-soft bg-cream-50 px-3 py-2">
                  <div className="eyebrow eyebrow-sm text-brand-500">Amelia</div>
                  <div className="mt-0.5 font-body hint leading-snug text-ink-900">
                    {hasSavedRun
                      ? HOME.ameliaIntroReturning(day, phase, route!)
                      : ended
                        ? HOME.taglineEnded
                        : HOME.ameliaIntro}
                  </div>
                </div>
              </div>
            </div>
            {hasSavedRun ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <CtaPulse reduced={!!reduced}>
                  <PixelButton variant="primary" size="lg" onClick={onContinue}>
                    {HOME.cta.continue(day)}
                  </PixelButton>
                </CtaPulse>
                {/* Ghost, not a second filled button. This one WIPES the saved
                    run, and sitting it beside Continue as an equally solid,
                    equally coloured CTA invited exactly the misclick you can't
                    undo. Continue is the only filled button here. */}
                <PixelButton variant="ghost" size="lg" onClick={onStartNew}>
                  {HOME.cta.startNew}
                </PixelButton>
              </div>
            ) : ended ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <CtaPulse reduced={!!reduced}>
                  <PixelButton variant="primary" size="lg" onClick={onStartNew}>
                    {HOME.cta.startAnother}
                  </PixelButton>
                </CtaPulse>
              </div>
            ) : (
              <CtaPulse reduced={!!reduced}>
                <PixelButton variant="primary" size="lg" onClick={onStartFirst}>
                  {HOME.cta.startFirst}
                </PixelButton>
              </CtaPulse>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Lp({ t, body, index }: { t: string; body: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.35, delay: 0.3 + index * 0.07, ease: 'easeOut' }}
      className="flex items-center gap-2 border border-border-soft bg-cream-100 px-2.5 py-2 text-left cursor-default"
    >
      <span className="shrink-0 bg-brand-500 px-1.5 py-0.5 eyebrow eyebrow-sm leading-none text-cream-50">
        {t}
      </span>
      <span className="font-body hint leading-tight text-ink-900">{body}</span>
    </motion.div>
  );
}

/** Gentle infinite "come press me" breath on the primary CTA. */
function CtaPulse({ reduced, children }: { reduced: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={reduced ? undefined : { scale: [1, 1.03, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
    >
      {children}
    </motion.div>
  );
}
