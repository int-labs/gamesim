import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { A } from '@/assets';
import { VideoBackdrop } from './VideoBackdrop';
import { PassKeyPanel } from './PassKeyPanel';
import { AcademyMascotStage } from './AcademyMascotStage';
import { HeartRain } from '@/components/fx/HeartRain';
import { SceneAmbience } from './SceneAmbience';
import { PixelWipe } from './PixelWipe';
import { useStage, useSourceSize, projectX, projectY } from './useStage';
import { playSfx } from '@/audio/audioManager';

// Scene anchors as fractions of the backdrop art. `cx` is far right, so a horizontal crop eats the board first.
const BOARD = { cx: 0.808, y0: 0.135, wFrac: 0.265, hFrac: 0.55 };

/** The full-bleed storefront entry. Stage mode anchors the panel to the baked-in board; card mode is used when it will not fit. */
export function PassKeyScreen({ onEnter }: { onEnter: () => void }) {
  const reduced = useReducedMotion();
  // The stage box IS the element the backdrop fills, projections are measured
  // off it, not off the window. See the note in useStage.
  const stageRef = useRef<HTMLDivElement>(null);
  // The art's own dimensions, read off the poster rather than assumed.
  const srcSize = useSourceSize(A.env.passkeyPoster);
  // BOARD is passed so stage mode is decided by whether the panel fits.
  const stage = useStage(stageRef, srcSize, BOARD);
  const [leaving, setLeaving] = useState(false);
  const [roamTick, setRoamTick] = useState(0);

  // confetti draws into a persistent canvas; reset or the burst follows the next screen.
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
    <div ref={stageRef} className="fixed inset-0 z-[60] overflow-hidden bg-bg">
      {/* Full-viewport scene, object-cover, so there are never side bars. */}
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

          {/* Hearts sit at z-14, Amelia at z-15, so she stays in front of her own burst. */}
          <HeartRain className="pointer-events-none absolute inset-0 z-[14]" />

          {/* Roaming "idle-lobby" mascot, positions itself in the scene. */}
          <AcademyMascotStage stage={stage} reduced={!!reduced} roamTick={roamTick} />

          {/* z-[30] keeps the panel above the fireflies and the roaming mascot. */}
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
          {/* Card mode (mobile / portrait), full-height sheet, no mascot. */}
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
