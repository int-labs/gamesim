import { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * DustMotes — ambient life for the stage: a handful of warm pixel specks
 * drifting lazily through the air and twinkling, like dust in the studio
 * light. Pure CSS animation (no rAF), pointer-events none, decoration only
 * (Math.random never touches the sim), gone under reduced-motion.
 */
export function DustMotes({ count = 12 }: { count?: number }) {
  const reduced = useReducedMotion();
  const motes = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 96 + 2,
        top: 14 + Math.random() * 74,
        size: Math.random() < 0.3 ? 3 : 2,
        dur: 9 + Math.random() * 9,
        tw: 2.4 + Math.random() * 2.6,
        delay: -Math.random() * 14,
        drift: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 22),
      })),
    [count],
  );

  if (reduced) return null;

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
      <style>{`
        @keyframes mote-drift{0%{transform:translate(0,0)}50%{transform:translate(var(--drift),calc(var(--drift) * -0.55))}100%{transform:translate(0,0)}}
        @keyframes mote-tw{0%,100%{opacity:0.06}50%{opacity:0.45}}
      `}</style>
      {motes.map((m, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: '#FFE9B8',
            ['--drift' as any]: `${m.drift}px`,
            animation: `mote-drift ${m.dur}s ease-in-out ${m.delay}s infinite, mote-tw ${m.tw}s ease-in-out ${m.delay}s infinite`,
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
