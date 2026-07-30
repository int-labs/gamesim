import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * PixelBurstLayer — a tiny juice system. Mount it over a stage
 * (`absolute inset-0`) and fire:
 *
 *   window.dispatchEvent(new CustomEvent('intlabs:burst', { detail: { x, y } }))
 *
 * with x/y NORMALIZED (0..1) to the layer. A dozen pixel squares pop out of
 * that point, arc, shrink and fade — the classic "something good landed"
 * burst. Pure decoration (Math.random never touches the sim), pointer-events
 * none, self-cleaning, and silent under reduced-motion.
 */
const COLORS = ['#f2d06b', '#5fb27a', '#e09b6a', '#FAF7E8', '#e6b54a', '#e3a9a0'];

interface BurstSpec {
  id: number;
  x: number;
  y: number;
}

export function PixelBurstLayer() {
  const reduced = useReducedMotion();
  const [bursts, setBursts] = useState<BurstSpec[]>([]);

  useEffect(() => {
    if (reduced) return;
    let n = 0;
    const onBurst = (e: Event) => {
      const d = (e as CustomEvent).detail as { x?: number; y?: number } | undefined;
      if (!d || typeof d.x !== 'number' || typeof d.y !== 'number') return;
      const id = ++n;
      const bx = d.x;
      const by = d.y;
      // Keep at most 5 concurrent bursts so spam stays cheap.
      setBursts((b) => [...b.slice(-4), { id, x: bx, y: by }]);
      window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 750);
    };
    window.addEventListener('intlabs:burst', onBurst);
    return () => window.removeEventListener('intlabs:burst', onBurst);
  }, [reduced]);

  if (reduced) return null;

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      <style>{`@keyframes px-burst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0.3);opacity:0}}`}</style>
      {bursts.map((b) => (
        <Burst key={b.id} x={b.x} y={b.y} />
      ))}
    </div>
  );
}

function Burst({ x, y }: { x: number; y: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.6;
        const dist = 24 + Math.random() * 36;
        return {
          dx: Math.cos(ang) * dist,
          dy: Math.sin(ang) * dist - 10, // slight upward bias — feels "poppy"
          size: 3 + Math.floor(Math.random() * 4),
          color: COLORS[i % COLORS.length],
          dur: 0.45 + Math.random() * 0.25,
        };
      }),
    [],
  );
  return (
    <div className="absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      {parts.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            background: p.color,
            ['--dx' as any]: `${p.dx}px`,
            ['--dy' as any]: `${p.dy}px`,
            animation: `px-burst ${p.dur}s cubic-bezier(0.2, 0.8, 0.4, 1) forwards`,
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
