import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGame } from '@/state/store';

/**
 * ScreenTransition — a one-shot PIXEL WIPE that masks the app's biggest
 * moments, reusing the "enter the academy" pixel aesthetic from the Pass Key
 * gate (PixelWipe) but as a full COVER → hold → REVEAL cycle.
 *
 * It fires (self-contained, like DayAdvanceFlash) on:
 *   • game start  — screen enters 'simulation' from a pre-game screen
 *   • round/phase change — meta.phase increments (works in both the inline
 *     PhaseSequenceModal flow and the standalone evaluation flow)
 *   • game end    — screen enters 'final'
 *
 * Coincident triggers (e.g. a phase flip that also swaps screens) collapse into
 * a single wipe via a short debounce.
 */
const PRE_GAME = new Set(['start', 'route', 'phase_intro']);
const COLS = 22;
const ROWS = 13;

export function ScreenTransition() {
  const screen = useGame((s) => s.meta.screen);
  const reduced = useReducedMotion();

  const [token, setToken] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastScreen = useRef(screen);
  const lastFire = useRef(0);

  const fire = () => {
    const now = Date.now();
    if (now - lastFire.current < 800) return; // collapse coincident triggers
    lastFire.current = now;
    setToken((t) => t + 1);
    setPlaying(true);
  };

  // Pixel wipe ONLY on the big moments: starting a phase (phase intro →
  // simulation) and the game ending (→ final). The ordinary pre-game hops
  // (start → route → phase intro) do NOT wipe, and the Pass Key gate plays
  // its own wipe on unlock.
  useEffect(() => {
    const prev = lastScreen.current;
    lastScreen.current = screen;
    if (prev === screen) return;
    const startPhase = screen === 'simulation' && PRE_GAME.has(prev);
    const gameEnd = screen === 'final';
    if (startPhase || gameEnd) fire();
  }, [screen]);

  if (!playing) return null;
  return <PixelWipeCycle key={token} reduced={!!reduced} onDone={() => setPlaying(false)} />;
}

/**
 * The visual: a grid of pixel tiles that COVERS the screen top → bottom, holds
 * a beat, then REVEALS it top → bottom. Both passes flow the SAME direction, so
 * it reads as one clean downward wipe (never a bounce back up). Tiles "snap in"
 * with a small scale pop and carry a subtle 2-tone checkerboard for a pixel-art
 * texture. Pure visual, no text.
 */
function PixelWipeCycle({ reduced, onDone }: { reduced: boolean; onDone: () => void }) {
  const [stage, setStage] = useState<'cover' | 'reveal'>('cover');
  const tileDur = reduced ? 0.07 : 0.16;
  const sweep = reduced ? 0.05 : 0.34; // top → bottom stagger
  const hold = reduced ? 0 : 0.06;

  // cover finishes after the last row lands, brief hold, then start the reveal.
  useEffect(() => {
    const t = window.setTimeout(() => setStage('reveal'), (sweep + tileDur + hold) * 1000);
    return () => window.clearTimeout(t);
  }, [sweep, tileDur, hold]);

  // tear down once the reveal sweep has fully cleared.
  useEffect(() => {
    if (stage !== 'reveal') return;
    const t = window.setTimeout(onDone, (sweep + tileDur) * 1000 + 70);
    return () => window.clearTimeout(t);
  }, [stage, sweep, tileDur, onDone]);

  const total = COLS * ROWS;
  const covered = stage === 'cover';

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] grid"
      style={{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        // Row-based delay → BOTH cover and reveal flow top → bottom.
        const delay = (r / ROWS) * sweep;
        const shade = (c + r) % 2 === 0 ? 'bg-ink-900' : 'bg-ink-800';
        return (
          <motion.div
            key={i}
            className={shade}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: covered ? 1 : 0, scale: covered ? 1 : 0.9 }}
            transition={{ duration: tileDur, delay, ease: [0.3, 0, 0.2, 1] }}
          />
        );
      })}
    </div>
  );
}
