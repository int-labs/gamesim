import type { Transition, Variants } from "motion/react";

/* Durations (seconds) — spec §4.1 */
export const DUR = { tap: 0.08, fast: 0.15, base: 0.24, slow: 0.4, page: 0.45 } as const;

/* Easings */
export const EASE = {
  out: [0.16, 1, 0.3, 1], // expo-out — entrances
  inOut: [0.65, 0, 0.35, 1], // moves / resizes
  exit: [0.4, 0, 1, 1], // leavings — fast, no bounce
} as const;

/* Springs */
export const SPRING = {
  /** toggles, chips, tab pill, thumbs */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 } as Transition,
  /** cards, drawers, bulk bar, layout */
  smooth: { type: "spring", stiffness: 280, damping: 30 } as Transition,
  /** gauges, big surfaces */
  gentle: { type: "spring", stiffness: 170, damping: 26 } as Transition,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE.out } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE.exit } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.out } },
  exit: { opacity: 0, y: 8, transition: { duration: DUR.fast, ease: EASE.exit } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: SPRING.smooth },
  exit: { opacity: 0, scale: 0.97, transition: { duration: DUR.fast, ease: EASE.exit } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: SPRING.smooth },
  exit: { opacity: 0, x: 16, transition: { duration: DUR.fast, ease: EASE.exit } },
};

/** Parent orchestrator — children inherit via variant names. */
export const staggerContainer = (stagger = 0.06, delayChildren = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Interaction props — spread onto motion elements. */
export const pressable = { whileTap: { scale: 0.97 }, transition: SPRING.snappy };
export const hoverLift = { whileHover: { y: -2 }, transition: SPRING.smooth };

/** List entrance; delay capped at 12 items so long lists don't trail. */
export const listItem = (i: number): Variants => ({
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE.out, delay: Math.min(i, 12) * 0.025 },
  },
});
