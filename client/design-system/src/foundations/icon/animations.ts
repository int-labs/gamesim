import type { DOMKeyframesDefinition, AnimationOptions } from "motion/react";
import { motionTokens } from "../../tokens";

const { duration, ease } = motionTokens;

export interface IconAnimation {
  keyframes: DOMKeyframesDefinition;
  options: AnimationOptions;
  /** Animate these parts of the icon instead of the whole glyph. */
  parts?: string;
}

/**
 * Animations that work on any icon. Rotations and scales turn around the icon's centre; `draw`
 * traces the strokes, like a pen.
 */
export const iconAnimations = {
  /** Grows and settles: confirmations, new items. */
  pop: { keyframes: { scale: [1, 1.25, 1] }, options: { duration: duration.base, ease: ease.pop } },
  /** Swings like a bell: notifications, events. */
  wiggle: { keyframes: { rotate: [0, -14, 10, -6, 3, 0] }, options: { duration: duration.slow, ease: ease["in-out"] } },
  /** One full turn: refresh, recalculate. */
  spin: { keyframes: { rotate: [0, 360] }, options: { duration: duration.slow, ease: ease["in-out"] } },
  /** Hops twice: energy, attention. */
  bounce: { keyframes: { y: [0, -4, 0, -2, 0] }, options: { duration: duration.slow, ease: ease.standard } },
  /** A tick up: a value went up. */
  rise: { keyframes: { y: [0, -3, 0] }, options: { duration: duration.base, ease: ease.standard } },
  /** A tick down: a value went down. */
  sink: { keyframes: { y: [0, 3, 0] }, options: { duration: duration.base, ease: ease.standard } },
  /** A small refusal. */
  shake: { keyframes: { x: [0, -2, 2, -2, 2, 0] }, options: { duration: duration.shake, ease: ease["in-out"] } },
  /** Breathes once: live, waiting. */
  pulse: { keyframes: { scale: [1, 1.15, 1], opacity: [1, 0.7, 1] }, options: { duration: duration.slow, ease: ease["in-out"] } },
  /** Draws its strokes: success, completion. */
  draw: {
    keyframes: { pathLength: [0, 1] },
    options: { duration: duration.slow, ease: ease.standard },
    parts: "path, line, polyline, polygon, circle, ellipse, rect",
  },
} satisfies Record<string, IconAnimation>;

export type IconAnimationName = keyof typeof iconAnimations;
