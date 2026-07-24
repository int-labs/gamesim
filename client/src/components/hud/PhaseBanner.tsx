import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/state/store';
import { PixelIcon } from '@/components/icons/PixelIcon';

const PHASE_TITLES: Record<1 | 2 | 3, { title: string; sub: string }> = {
  1: { title: 'Phase 1 - Market Positioning',  sub: 'Days 1-30 · find your audience' },
  2: { title: 'Phase 2 - Inventory Flow',      sub: 'Days 31-60 · keep stock and cash flowing' },
  3: { title: 'Phase 3 - Cash, P&L, Focus',    sub: 'Days 61-90 · scale with discipline' },
};

/**
 * Tiny banner that flashes briefly at the top of the simulation when the
 * phase changes. Pure decoration — adds "chapter" feel without taking space
 * permanently. Auto-dismisses in ~2.6s.
 */
export function PhaseBanner() {
  const phase = useGame((s) => s.meta.phase);
  const screen = useGame((s) => s.meta.screen);
  const [show, setShow] = useState(false);
  const last = useRef(phase);

  useEffect(() => {
    if (last.current !== phase && screen === 'simulation') {
      setShow(true);
      const id = setTimeout(() => setShow(false), 2600);
      last.current = phase;
      return () => clearTimeout(id);
    }
  }, [phase, screen]);

  if (!show) return null;
  const info = PHASE_TITLES[phase];

  return (
    <div
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-[80px] z-40 anim-banner"
      role="status"
      aria-live="polite"
    >
      <div className="phase-badge bg-primary text-white border-border" style={{ color: '#FAF7E8' }}>
        <PixelIcon kind="phase" size={11} color="#FAF7E8" />
        <span className="text-[11px]">{info.title}</span>
      </div>
      <div className="text-center mt-1.5 text-[10px] uppercase tracking-wider font-semibold text-text-3 bg-surface/80 px-2 py-0.5 border border-border-soft">
        {info.sub}
      </div>
    </div>
  );
}
