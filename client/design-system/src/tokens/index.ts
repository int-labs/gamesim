import { tokens } from "./generated/tokens";

export { tokens, type Tokens } from "./generated/tokens";

/** Milliseconds or seconds from a duration token ("200ms", "0.2s"). */
function toSeconds(value: string): number {
  const amount = parseFloat(value);
  return value.endsWith("ms") ? amount / 1000 : amount;
}

type Keys<T> = keyof T & string;

function mapValues<T extends Record<string, unknown>, R>(source: T, map: (value: T[Keys<T>]) => R): { [K in Keys<T>]: R } {
  const out = {} as { [K in Keys<T>]: R };
  for (const key of Object.keys(source) as Keys<T>[]) out[key] = map(source[key]);
  return out;
}

/**
 * Motion values in the units Motion (motion/react) expects: durations and staggers in seconds,
 * easings as cubic-bezier arrays, springs as transition objects.
 */
export const motionTokens = {
  duration: mapValues(tokens.duration, toSeconds),
  stagger: mapValues(tokens.stagger, toSeconds),
  ease: mapValues(tokens.ease, (points) => [...points] as [number, number, number, number]),
  spring: mapValues(tokens.spring, (spring) => ({ type: "spring" as const, ...spring })),
};

export type MotionDuration = keyof typeof motionTokens.duration;
export type MotionEase = keyof typeof motionTokens.ease;
export type MotionSpring = keyof typeof motionTokens.spring;
