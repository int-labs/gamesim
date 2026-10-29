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

/** The baked-in feature an overlay is anchored to, in art fractions. */
export interface StageAnchor {
  cx: number;
  y0: number;
  wFrac: number;
  hFrac: number;
}

/** Breathing room the anchored panel must keep from the viewport edge. */
const EDGE_MARGIN = 12;

/** A viewport below this never uses stage mode, however well the board fits. */
const MIN_STAGE_W = 768;

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
function compute(
  el: Element | null,
  src: SourceSize,
  anchor: StageAnchor | null,
): StageMetrics {
  const box = el?.getBoundingClientRect();
  // `innerWidth` only as the pre-mount fallback, never as the live source.
  const vw = box && box.width > 0 ? box.width : window.innerWidth;
  const vh = box && box.height > 0 ? box.height : window.innerHeight;
  const scale = Math.max(vw / src.w, vh / src.h); // object-cover
  const rw = src.w * scale;
  const rh = src.h * scale;
  const ox = (vw - rw) / 2;
  const oy = (vh - rh) / 2;

  /*
   * ⚠ STAGE MODE IS DECIDED BY WHETHER THE BOARD FITS, NOT BY AN ASPECT RATIO.
   *
   * This was `vw >= 768 && vw / vh >= 1.2`, which is a guess that the screen is
   * widescreen. It is not, on a 4:3 iPad, a 16:10 laptop, or a split-screen
   * window. `object-cover` scales by whichever axis is short, so on anything
   * NARROWER than the art the crop comes off the sides — and the board this
   * panel anchors to sits at cx 0.808, far right in the art, so it is the
   * first thing the crop eats.
   *
   * On a 1024x768 iPad the panel's right edge projects to 1113px in a 1024px
   * viewport: 89px off-screen. At the old 1.2 cutoff itself it is 183px off.
   * The ratio test admitted exactly the cases it needed to exclude.
   *
   * Projecting the anchor and checking it lands inside the viewport tests the
   * thing that actually matters, and does so for any aspect — no new constant
   * needs to be guessed when a device shape appears that nobody planned for.
   */
  let fits = true;
  if (anchor) {
    const cardW = rw * anchor.wFrac;
    const left = ox + anchor.cx * rw - cardW / 2;
    const top = oy + anchor.y0 * rh;
    fits =
      left >= EDGE_MARGIN &&
      left + cardW <= vw - EDGE_MARGIN &&
      top >= 0 &&
      top + rh * anchor.hFrac <= vh;
  }

  const mode: StageMetrics['mode'] = vw >= MIN_STAGE_W && fits ? 'stage' : 'card';
  return { mode, vw, vh, scale, rw, rh, ox, oy };
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
  /** The overlay this stage has to fit. Omit and stage mode is width-only. */
  anchor: StageAnchor | null = null,
): StageMetrics {
  // ⚠ DESTRUCTURED TO PRIMITIVES. `useSourceSize` hands back a fresh object
  // every render, so an effect depending on `src` itself would re-run — and
  // re-measure — on each one.
  const { w: srcW, h: srcH } = src;
  const { cx = 0, y0 = 0, wFrac = 0, hFrac = 0 } = anchor ?? {};

  const [metrics, setMetrics] = useState<StageMetrics>(() =>
    typeof window === 'undefined' ? SSR_FALLBACK : compute(null, src, anchor),
  );

  useEffect(() => {
    const el = ref?.current ?? null;
    const a = anchor ? { cx, y0, wFrac, hFrac } : null;
    const onResize = () => setMetrics(compute(el, { w: srcW, h: srcH }, a));
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
    // Primitives, never the objects — both callers build theirs inline, so a
    // fresh identity arrives on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, srcW, srcH, anchor === null, cx, y0, wFrac, hFrac]);

  return metrics;
}
