import { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * CoinRain — pixel coins tumbling down over the parent (position it
 * `relative overflow-hidden`). One-shot: each coin falls once, staggered,
 * then stays gone — made for the "30 days of sales are happening" moment.
 * Pure CSS animation, decoration-only randomness, silent under
 * reduced-motion.
 */
export function CoinRain({ count = 26 }: { count?: number }) {
  const reduced = useReducedMotion();
  const coins = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: 2 + Math.random() * 96,
        delay: Math.random() * 0.95,
        dur: 0.75 + Math.random() * 0.6,
        size: 8 + Math.floor(Math.random() * 5),
        drift: (Math.random() - 0.5) * 36,
        spin: Math.random() < 0.5 ? 1 : -1,
      })),
    [count],
  );

  if (reduced) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`@keyframes coin-fall{0%{transform:translate(0,-36px) rotate(0deg);opacity:0}12%{opacity:1}88%{opacity:1}100%{transform:translate(var(--drift),360px) rotate(calc(var(--spin) * 340deg));opacity:0}}`}</style>
      {coins.map((c, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
            background: '#F2C94C',
            border: '1px solid #8A6A1F',
            borderRadius: 2,
            boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.25), inset 1px 1px 0 rgba(255,255,255,0.4)',
            ['--drift' as any]: `${c.drift}px`,
            ['--spin' as any]: c.spin,
            animation: `coin-fall ${c.dur}s ${c.delay}s cubic-bezier(0.3, 0, 0.7, 1) forwards`,
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
