import { useEffect, useState } from 'react';

/**
 * Responsive breakpoints — aligned with Tailwind defaults so JS-side
 * decisions stay consistent with `sm:`, `md:`, `lg:`, `xl:` classes.
 *
 *   mobile          : <  768  (Tailwind: default → md:)
 *   tabletPortrait  : 768..1023 (Tailwind: md..lg:)
 *   tabletLandscape : 1024..1279 (Tailwind: lg..xl:)
 *   desktop         : 1280..1599 (Tailwind: xl..2xl:)
 *   largeDesktop    : 1600+ (Tailwind: 2xl:)
 *
 * Use this hook ONLY when behavior must branch — e.g. a HUD chip that
 * folds into a drawer, or an editor that swaps to touch controls. For
 * pure visual layout, prefer Tailwind responsive prefixes — they have
 * zero JS overhead and SSR-correctness comes for free.
 */

export type Breakpoint = 'mobile' | 'tabletPortrait' | 'tabletLandscape' | 'desktop' | 'largeDesktop';

const computeBp = (width: number): Breakpoint => {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tabletPortrait';
  if (width < 1280) return 'tabletLandscape';
  if (width < 1600) return 'desktop';
  return 'largeDesktop';
};

const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Best-effort touch detection: matches devices that primarily use
  // touch even if a mouse is also attached. Used by the add-on editor
  // to swap to touch-friendly controls below the canvas.
  return window.matchMedia?.('(pointer: coarse)').matches
    ?? ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
};

export function useBreakpoint(): { bp: Breakpoint; width: number; touch: boolean } {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return { bp: 'desktop' as Breakpoint, width: 1280, touch: false };
    const w = window.innerWidth;
    return { bp: computeBp(w), width: w, touch: isTouchDevice() };
  });

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = window.innerWidth;
        setState((prev) => {
          const bp = computeBp(w);
          if (prev.width === w && prev.bp === bp) return prev;
          return { bp, width: w, touch: isTouchDevice() };
        });
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return state;
}

/** Convenience: true when the breakpoint is mobile or tablet portrait. */
export const useIsCompact = (): boolean => {
  const { bp } = useBreakpoint();
  return bp === 'mobile' || bp === 'tabletPortrait';
};

/** Convenience: true when the breakpoint is mobile only. */
export const useIsMobile = (): boolean => useBreakpoint().bp === 'mobile';
