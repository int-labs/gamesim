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

/**
 * Fallback source size, used only until the real artwork reports its own.
 *
 * ⚠ DO NOT TREAT THIS AS THE ART'S SIZE. It was hardcoded 1920x1080 and the
 * poster is actually 1672x941 — near enough in RATIO (1.7768 vs 1.7778) that
 * nothing visibly broke, which is exactly why it survived. Re-export the
 * backdrop at a different aspect and every `project()`ed overlay drifts off
 * its baked-in feature, silently, with nothing failing. `useSourceSize` reads
 * the real dimensions instead; this is the pre-load guess.
 */
const FALLBACK_SRC = { w: 1672, h: 941 };

export interface SourceSize { w: number; h: number }

/**
 * The backdrop art's own pixel dimensions, read from the image itself.
 *
 * Decoding is free here — the browser is loading this exact file for the
 * poster anyway, so it comes from cache.
 */
export function useSourceSize(src: string | undefined): SourceSize {
  const [size, setSize] = useState<SourceSize>(FALLBACK_SRC);

  useEffect(() => {
    if (!src) return undefined;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setSize({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.src = src;
    return () => { live = false; };
  }, [src]);

  return size;
}

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
function compute(el: Element | null, src: SourceSize): StageMetrics {
  const box = el?.getBoundingClientRect();
  // `innerWidth` only as the pre-mount fallback, never as the live source.
  const vw = box && box.width > 0 ? box.width : window.innerWidth;
  const vh = box && box.height > 0 ? box.height : window.innerHeight;
  const scale = Math.max(vw / src.w, vh / src.h); // object-cover
  const rw = src.w * scale;
  const rh = src.h * scale;
  const mode: StageMetrics['mode'] = vw >= 768 && vw / vh >= 1.2 ? 'stage' : 'card';
  return { mode, vw, vh, scale, rw, rh, ox: (vw - rw) / 2, oy: (vh - rh) / 2 };
}

/** Map a normalized point in the backdrop art (0..1) to viewport px. */
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
export function useStage(
  ref?: RefObject<HTMLElement | null>,
  src: SourceSize = FALLBACK_SRC,
): StageMetrics {
  // ⚠ DESTRUCTURED TO PRIMITIVES. `useSourceSize` hands back a fresh object
  // every render, so an effect depending on `src` itself would re-run — and
  // re-measure — on each one.
  const { w: srcW, h: srcH } = src;

  const [metrics, setMetrics] = useState<StageMetrics>(() =>
    typeof window === 'undefined' ? SSR_FALLBACK : compute(null, src),
  );

  useEffect(() => {
    const el = ref?.current ?? null;
    const onResize = () => setMetrics(compute(el, { w: srcW, h: srcH }));
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
  }, [ref, srcW, srcH]);

  return metrics;
}
