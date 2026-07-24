import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const COLORS = ['#5fb27a', '#e6b54a', '#e09b6a', '#e07a6a', '#9b6cd9', '#5b86c2', '#f2d06b'];

/**
 * Confetti — a one-shot pixel-confetti rain for the results celebration.
 * `tone` scales the intensity: 'full' for a strong run, 'calm' for a modest
 * one, 'none' (or reduced-motion) renders nothing — so a rough run isn't
 * over-celebrated. Pieces fall once (~4.5s) then the layer removes itself.
 * Math.random is fine here — this is pure decoration, never a sim path.
 */
export function Confetti({ count = 80, tone = 'full' }: { count?: number; tone?: 'full' | 'calm' | 'none' }) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const n = tone === 'calm' ? Math.round(count * 0.4) : count;

  const pieces = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        left: Math.random() * 100,
        size: 5 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.9,
        dur: 2.6 + Math.random() * 2.2,
        rot: Math.random() * 360,
        drift: (Math.random() - 0.5) * 40,
      })),
    [n],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDone(true), 4800);
    return () => window.clearTimeout(t);
  }, []);

  if (reduced || tone === 'none' || done) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      <style>{`@keyframes cf-fall{0%{transform:translateY(-12vh) translateX(0) rotate(0);opacity:1}85%{opacity:1}100%{transform:translateY(112vh) translateX(var(--cf-drift,0px)) rotate(720deg);opacity:0}}`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.5,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            ['--cf-drift' as any]: `${p.drift}px`,
            // fill-mode BOTH: the 0% keyframe (offscreen above) applies
            // during the start delay too — otherwise pieces sit visible in a
            // static strip along the top edge until their delay elapses.
            animation: `cf-fall ${p.dur}s linear ${p.delay}s both`,
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
