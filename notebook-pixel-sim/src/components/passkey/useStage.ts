import { RefObject, useEffect, useState } from 'react';

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

/**
 * ⚠ MEASURE THE ELEMENT, NOT THE WINDOW.
 *
 * This read `window.innerWidth`/`innerHeight` and projected overlays onto a
 * box it had never measured. Whenever the painted container is not exactly the
 * window — a classic scrollbar, browser zoom, a device-pixel-ratio rounding,
 * an app shell with its own chrome — the projection is computed against a
 * larger rectangle than the one the backdrop actually fills, so the panel
 * lands past the scene's edge and the uncovered strip shows the page's own
 * background. That is the dark band down the right and along the bottom.
 *
 * Measuring the stage element removes the whole class: the art, the overlays
 * and the maths all describe one box.
 */
function compute(el: Element | null): StageMetrics {
  const box = el?.getBoundingClientRect();
  // `innerWidth` only as the pre-mount fallback, never as the live source.
  const vw = box && box.width > 0 ? box.width : window.innerWidth;
  const vh = box && box.height > 0 ? box.height : window.innerHeight;
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

/**
 * @param ref the element the backdrop fills. Pass it — the window-sized
 *   fallback exists only for the first paint, before the ref is attached.
 */
export function useStage(ref?: RefObject<HTMLElement | null>): StageMetrics {
  const [metrics, setMetrics] = useState<StageMetrics>(() =>
    typeof window === 'undefined' ? SSR_FALLBACK : compute(null),
  );

  useEffect(() => {
    const el = ref?.current ?? null;
    const onResize = () => setMetrics(compute(el));
    onResize();

    // A ResizeObserver catches what `resize` does not: the element changing
    // size while the window does not — a scrollbar appearing, an app chrome
    // panel opening, a zoom step.
    const ro = el ? new ResizeObserver(onResize) : null;
    if (el && ro) ro.observe(el);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [ref]);

  return metrics;
}
