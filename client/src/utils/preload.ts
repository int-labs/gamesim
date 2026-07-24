// Tiny image preload manager.
//
// Why bother when modern browsers already fetch images on demand?
//
//   1. We want priority-0 (logo, neutral mascot, default desk) to be
//      *decoded* before the StartScreen paints — no flicker on first
//      load.
//   2. We want a Promise we can await to dismiss a branded loading
//      overlay only when first-paint imagery is actually ready.
//   3. We want idle-time prefetch for likely-next assets so navigation
//      to the simulation feels instant.
//
// All future surfaces (more notebook archetypes, more add-ons, future
// product categories) just append URLs to the manifest below; the
// loader is unchanged. That's the scalability the spec asks for.

import { A } from '@/assets';

/**
 * A single image cache shared across the app. We use an in-memory Map
 * keyed by URL → Promise<HTMLImageElement | null>. The browser also
 * caches the bytes via its normal HTTP cache, so repeat visits skip
 * the network entirely; this Map just dedupes in-flight requests and
 * lets us await readiness.
 */
const cache = new Map<string, Promise<HTMLImageElement | null>>();

/** Preload one image URL. Resolves to the decoded HTMLImageElement, or null on failure. */
export function preloadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const cached = cache.get(src);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (img.complete && img.naturalWidth > 0) {
      resolve(img);
      return;
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Surface in dev only — tree-shaken in production builds.
      // eslint-disable-next-line no-console
      if ((import.meta as any).env?.DEV) console.warn('[preloadImage] failed:', src);
      resolve(null);
    };
  });
  cache.set(src, p);
  return p;
}

/** Preload an array of URLs in parallel. Resolves once every entry settles (success or failure). */
export function preloadImages(srcs: ReadonlyArray<string>): Promise<void> {
  if (!srcs.length) return Promise.resolve();
  return Promise.allSettled(srcs.map((s) => preloadImage(s))).then(() => undefined);
}

/**
 * Schedule a preload during the browser's idle time. Falls back to a
 * 200ms `setTimeout` when `requestIdleCallback` is unavailable
 * (Safari, JSDOM). The callback receives a function to start the load.
 */
export function preloadIdle(srcs: ReadonlyArray<string>): void {
  if (!srcs.length) return;
  const start = () => { void preloadImages(srcs); };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(start, { timeout: 2000 });
  } else {
    setTimeout(start, 200);
  }
}

/** Quick check: is an asset already in the local preload cache? */
export const isPreloaded = (src: string): boolean => cache.has(src);

// ─── Priority manifest ──────────────────────────────────────────────
//
// Add new assets here as the product grows. The structure (priority
// tiers) is the contract; URLs inside each tier can change freely.
//
//   priority0Critical  — must be ready before first paint (logo, fonts)
//   priority1FirstView — needed within the first interaction (start
//                        screen visuals, neutral mascot, default desk)
//   priority2Common    — common UI sprites that appear soon after the
//                        player chooses a route (default notebook,
//                        common add-on thumbs)
//   priority3OnDemand  — loaded on demand by SmartPixelImage as their
//                        UI mounts. Listed here for documentation only,
//                        not preloaded.
//   priority4Idle      — nice-to-have idle prefetches (other
//                        archetypes, mascot expressions for future
//                        bubbles)

export const ASSET_MANIFEST = {
  priority0Critical: [
    A.logo,
  ] as const,

  priority1FirstView: [
    A.env.deskFull,
    A.env.passkeyPoster,
    A.mascot.expressions.happy_soft,
    A.mascot.expressions.neutral,
    A.mascot.poses.presenting,
  ] as const,

  priority2Common: [
    A.notebook.student.hardcover_ring,
    A.notebook.planner.hardcover_ring,
    A.notebook.daily.hardcover_ring,
  ] as const,

  priority4Idle: [
    // Other notebook variants (cover/binding combos)
    A.notebook.student.hardcover_staple,
    A.notebook.student.leather_ring,
    A.notebook.student.leather_staple,
    A.notebook.planner.hardcover_staple,
    A.notebook.planner.leather_ring,
    A.notebook.planner.leather_staple,
    A.notebook.daily.hardcover_staple,
    A.notebook.daily.leather_ring,
    A.notebook.daily.leather_staple,
    // Mascot expressions used at evaluation / events
    A.mascot.expressions.thinking,
    A.mascot.expressions.thinking_side,
    A.mascot.expressions.concerned,
    A.mascot.expressions.concerned_soft,
    A.mascot.expressions.warning,
    A.mascot.expressions.excited,
    A.mascot.poses.pointing_left_explain,
    A.mascot.poses.pointing_right_explain,
    A.mascot.poses.idle_soft_wave,
    // Phase intro backgrounds — preload after route selection ideally
    A.env.round1,
    A.env.round2,
    A.env.round3,
  ] as const,
} as const;
