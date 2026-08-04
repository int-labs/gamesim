import { AnimationEvent, useCallback, useState } from 'react';

/**
 * useHop — drives the mascot "click me" bounce (see `.mascot-hop` /
 * `.mascot-squish` in styles). A component maps `active` to the animation
 * class, calls `trigger()` from its click handler, and wires `onAnimationEnd`
 * so the class clears when the keyframe finishes and can replay on the next
 * click.
 *
 * Deliberately a real CSS animation (not framer AnimationControls): it fires
 * reliably on every browser, and "is the class applied?" is verifiable from the
 * DOM without depending on requestAnimationFrame timing.
 */
export function useHop() {
  const [active, setActive] = useState(false);
  const trigger = useCallback(() => setActive(true), []);
  const onAnimationEnd = useCallback((e: AnimationEvent) => {
    // Only OUR keyframe clears the flag - other CSS animations can bubble here.
    if (/mascot-pat/.test(e.animationName)) setActive(false);
  }, []);
  return { active, trigger, onAnimationEnd };
}
