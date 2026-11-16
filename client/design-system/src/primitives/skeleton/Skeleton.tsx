import type { HTMLAttributes } from "react";
import { tv, type VariantProps } from "../../lib/tv";

/**
 * A grey placeholder where content is loading, breathing slowly (still with reduced motion). Size
 * and round it with classes, as the apps size today's MUI Skeleton: a button `h-10 w-24 rounded-xl`,
 * an avatar `size-10` with the circle shape, a line of text `w-3/5` with the text shape.
 */
export const skeletonVariants = tv({
  base: "block shrink-0 animate-pulse bg-surface-hover motion-reduce:animate-none",
  variants: {
    shape: {
      /** A block; the default. */
      rect: "rounded-lg",
      /** A line of body text: the 20 px line box, drawn at 60% of its height as MUI's text skeleton. */
      text: "h-5 scale-y-60 rounded-sm",
      /** An avatar or a round icon. */
      circle: "rounded-full",
    },
  },
  defaultVariants: { shape: "rect" },
});

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof skeletonVariants> {}

/**
 * Stands in for content that is loading. It is hidden from assistive technology; mark the region
 * that is loading with aria-busy, and say what is loading where it matters.
 */
export function Skeleton({ shape, className, ...props }: SkeletonProps) {
  return <span aria-hidden className={skeletonVariants({ shape, className })} {...props} />;
}
