import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { A } from '@/assets';
import { VideoBackdrop } from './VideoBackdrop';
import { PassKeyPanel } from './PassKeyPanel';
import { AcademyMascotStage } from './AcademyMascotStage';
import { HeartRain } from '@/components/fx/HeartRain';
import { SceneAmbience } from './SceneAmbience';
import { PixelWipe } from './PixelWipe';
import { useStage, projectX, projectY } from './useStage';
import { playSfx } from '@/audio/audioManager';

// ── Scene anchors, as fractions of the 16:9 art ────────────────────────────
// The blank parchment board (the panel fills it) and the floor (the mascot).
const BOARD = { cx: 0.808, y0: 0.135, wFrac: 0.265, hFrac: 0.55 };

/**
 * PassKeyScreen — the full-bleed Academy "storefront" entry experience.
 *
 * The video ALWAYS object-covers the viewport (no bars). In landscape
 * ("stage") mode the panel fills the baked-in board (top-aligned) and the
 * mascot stands on the floor, both math-anchored via the cover projection. In
 * portrait ("card") mode the panel is a full-height sheet (centered content,
 * branded with the logo) and the mascot is dropped.
 */
export function PassKeyScreen({ onEnter }: { onEnter: () => void }) {
  const reduced = useReducedMotion();
  const stage = useStage();
  const [leaving, setLeaving] = useState(false);
  const [roamTick, setRoamTick] = useState(0);

  // canvas-confetti draws into a PERSISTENT full-screen canvas that outlives
  // whatever triggered it. Without this reset the unlock burst kept falling
  // over the route-choice screen that replaces us, drifting across its heading.
  // The celebration belongs to the screen that earned it.
  useEffect(() => () => { confetti.reset(); }, []);

  const handleUnlock = () => {
    setLeaving(true);
    playSfx('phase-up');
    // `ticks` is tuned to the 720ms exit below so the burst finishes ON this
    // screen instead of being cut off mid-flight.
    if (!reduced) confetti({ particleCount: 110, spread: 90, origin: { y: 0.6 }, scalar: 0.9, ticks: 70 });
    window.setTimeout(onEnter, reduced ? 200 : 720);
  };

  const isStage = stage.mode === 'stage';
  const fadeOut = { opacity: leaving ? 0 : 1 };

  // Stage-mode panel fills the board; mascot scales to the scene.
  const cardW = Math.round(stage.rw * BOARD.wFrac);
  const cardH = Math.round(stage.rh * BOARD.hFrac);
  const wipeRows = Math.max(8, Math.min(26, Math.round(18 * (stage.vh / Math.max(1, stage.vw)))));

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-bg">
      {/* Full-viewport scene — object-cover, so there are never side bars. */}
      <VideoBackdrop poster={A.env.passkeyPoster} videoMp4={A.video.passkeyBg} focal="50% 42%" />

      {/* Pixel fireflies. */}
      <SceneAmbience />

      {/* Soft grounding vignette (kept light so the art reads). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-900/10 via-transparent to-ink-900/25"
      />

      {isStage ? (
        <>
          {/* Click the scene (anywhere but the panel/mascot) to make Amelia
              roam to another spot. */}
          <div
            aria-hidden
            className="absolute inset-0 z-[2]"
            onClick={() => setRoamTick((t) => t + 1)}
          />

          {/* Hearts erupt from BEHIND Amelia: this canvas sits at z-14, she is
              at z-15. Mounted per-mascot-context rather than globally so the
              sprite always stays in front of its own love bomb. */}
          <HeartRain className="pointer-events-none absolute inset-0 z-[14]" />

          {/* Roaming "idle-lobby" mascot — positions itself in the scene. */}
          <AcademyMascotStage stage={stage} reduced={!!reduced} roamTick={roamTick} />

          {/* Pass Key panel — fills the blank board, content top-aligned.
              z-[30] keeps it above the fireflies (z-5) and the roaming mascot
              (z-15) so nothing ever drifts over the field while typing. */}
          <div
            className="absolute z-[30]"
            style={{
              left: projectX(stage, BOARD.cx),
              top: projectY(stage, BOARD.y0),
              width: cardW,
              height: cardH,
              transform: 'translateX(-50%)',
            }}
          >
            <motion.div
              className="h-full w-full"
              initial={reduced ? false : { scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, ...fadeOut }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.2, 1.1, 0.4, 1] }}
            >
              <PassKeyPanel onUnlock={handleUnlock} fill="top" />
            </motion.div>
          </div>
        </>
      ) : (
        <>
          {/* Card mode (mobile / portrait) — full-height sheet, no mascot. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-ink-900/55" />

          <motion.div
            className="absolute inset-0 z-[30] flex items-center justify-center overflow-y-auto p-4"
            initial={reduced ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, ...fadeOut }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-full max-w-[440px]">
              <PassKeyPanel onUnlock={handleUnlock} fill="center" />
            </div>
          </motion.div>
        </>
      )}

      {/* "Enter the academy" pixel transition on success. */}
      {leaving && <PixelWipe cols={18} rows={wipeRows} reduced={!!reduced} />}
    </div>
  );
}
