import { useEffect, useState } from 'react';

/**
 * useStage — responsive coordinate system for compositing UI onto the fixed
 * 16:9 background scene (storefront + a blank board where the panel goes).
 *
 * Approach: the video fills the WHOLE viewport with `object-cover` (so there
 * are never any letterbox/pillarbox bars). We then compute how that cover
 * transform maps the 16:9 source onto the screen, so overlays positioned via
 * `project(nx, ny)` land exactly on baked-in features (the board, the floor)
 * at ANY viewport size.
 *
 * On narrow / portrait screens, anchoring to the board would push the panel
 * off the cropped edge, so we report `mode: 'card'` and the screen switches to
 * a centered card layout instead.
 */
export interface StageMetrics {
  mode: 'stage' | 'card';
  vw: number;
  vh: number;
  /** object-cover projection of the 16:9 source onto the viewport (px). */
  scale: number;
  rw: number; // rendered (covered) width
  rh: number; // rendered (covered) height
  ox: number; // left offset of the rendered image (<= 0 when cropped)
  oy: number; // top offset of the rendered image (<= 0 when cropped)
}

const SRC_W = 1920;
const SRC_H = 1080;

function compute(): StageMetrics {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.max(vw / SRC_W, vh / SRC_H); // object-cover
  const rw = SRC_W * scale;
  const rh = SRC_H * scale;
  const mode: StageMetrics['mode'] = vw >= 768 && vw / vh >= 1.2 ? 'stage' : 'card';
  return { mode, vw, vh, scale, rw, rh, ox: (vw - rw) / 2, oy: (vh - rh) / 2 };
}

/** Map a normalized point in the 16:9 art (0..1) to viewport px. */
export function projectX(m: StageMetrics, nx: number): number {
  return m.ox + nx * m.rw;
}
export function projectY(m: StageMetrics, ny: number): number {
  return m.oy + ny * m.rh;
}

const SSR_FALLBACK: StageMetrics = {
  mode: 'card', vw: 0, vh: 0, scale: 1, rw: 0, rh: 0, ox: 0, oy: 0,
};

export function useStage(): StageMetrics {
  const [metrics, setMetrics] = useState<StageMetrics>(() =>
    typeof window === 'undefined' ? SSR_FALLBACK : compute(),
  );

  useEffect(() => {
    const onResize = () => setMetrics(compute());
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return metrics;
}
