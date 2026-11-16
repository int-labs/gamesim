import type { TargetAndTransition, Transition, Variants } from "motion/react";
import { motionTokens } from "../../tokens";

const { duration, ease, spring, stagger } = motionTokens;

/** Tweens on the duration scale, with the standard (ease-out) curve. */
export const transitions = {
  micro: { duration: duration.micro, ease: ease.standard },
  fast: { duration: duration.fast, ease: ease.standard },
  base: { duration: duration.base, ease: ease.standard },
  slow: { duration: duration.slow, ease: ease.standard },
} satisfies Record<string, Transition>;

/** Springs for things that move under the pointer: presses, toggles, thumbs, panels. */
export const springs = spring;

/** Fades in and out; for overlays and swapped content. Use with initial="hidden", animate="visible", exit="exit". */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.fast },
  exit: { opacity: 0, transition: transitions.fast },
};

/** Popups, toasts and cards entering: fade in while rising 8 px; leave faster than they came. */
export const enter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: 4, transition: transitions.fast },
};

/** Dialogs and menus growing from their anchor. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.base },
  exit: { opacity: 0, scale: 0.98, transition: transitions.fast },
};

/** A container whose children (with `enter` or `fade`) appear one after another: menus, rows, KPI chips. */
export const staggerList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: stagger.list } },
};

/** The slower sequence of the round results reveal. */
export const staggerReveal: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: stagger.reveal } },
};

/** whileTap: a pressed control gives a little. */
export const press: TargetAndTransition = { scale: 0.97, transition: springs.quick };

/** whileHover: a card or tile lifts. */
export const hoverLift: TargetAndTransition = { y: -2, transition: transitions.fast };

/**
 * A refusal: the field shakes with a decaying recoil when a value is not allowed (today's
 * InputField shake, keyframe for keyframe).
 */
export const shake: TargetAndTransition = {
  x: [0, -6, 5, -4, 2.5, -1.5, 0.5, 0],
  transition: { duration: duration.shake, ease: ease.recoil, times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.88, 1] },
};

/** A small refusal for pills and chips: not enough energy, over budget. */
export const nudge: TargetAndTransition = {
  x: [0, -3, 3, -2, 2, 0],
  transition: { duration: duration.shake, ease: ease["in-out"] },
};

/** A success moment: a quick overshoot. */
export const successPop: TargetAndTransition = {
  scale: [1, 1.15, 1],
  transition: { duration: duration.base, ease: ease.pop },
};
