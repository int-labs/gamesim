import { RefObject, useEffect, useState } from 'react';

/** Projects overlays onto the backdrop's object-cover transform, so they land on baked-in features at any viewport. */
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

/** !important not the art's size, only the pre-load guess; `useSourceSize` reads the real one. */
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

/** The backdrop art's own dimensions, read from the poster the page already loads. */
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

/** !important measure the element, not the window; any gap between them lands the panel off the scene. */
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

  /** !important stage mode is decided by whether the board FITS, never by an aspect ratio. */
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

/** @param ref the element the backdrop fills; the window fallback is for the first paint only. */
export function useStage(
  ref?: RefObject<HTMLElement | null>,
  src: SourceSize = FALLBACK_SRC,
  /** The overlay this stage has to fit. Omit and stage mode is width-only. */
  anchor: StageAnchor | null = null,
): StageMetrics {
  // !important destructured to primitives: `useSourceSize` returns a fresh object each render.
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

    // A ResizeObserver catches the element resizing while the window does not.
    const ro = el ? new ResizeObserver(onResize) : null;
    if (el && ro) ro.observe(el);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    // Primitives, never the objects: both callers build theirs inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, srcW, srcH, anchor === null, cx, y0, wFrac, hFrac]);

  return metrics;
}
