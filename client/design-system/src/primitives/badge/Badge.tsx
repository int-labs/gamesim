import type { HTMLAttributes } from "react";
import { tv, type VariantProps } from "../../lib/tv";

/**
 * The Preline soft badge of the Figma file: the tone's 100 shade with its label in the 800 shade.
 * `sm` is the status badge of the Admin tables and headers (ACTIVE, COMPLETED, DRAFT, CANCELED,
 * PENDING): 18 px tall and one shared width, so a column of them lines up. `md` is the delta
 * badge of the KPI bar (+99%, -99%, 0%): a 24 px pill with a faint edge and a SemiBold figure.
 */
export const badgeVariants = tv({
  base: "inline-flex shrink-0 items-center justify-center whitespace-nowrap",
  variants: {
    tone: {
      info: "bg-info-soft text-info-soft-fg",
      success: "bg-success-soft text-success-soft-fg",
      warning: "bg-warning-soft text-warning-soft-fg",
      danger: "bg-danger-soft text-danger-soft-fg",
      neutral: "bg-neutral-soft text-neutral-soft-fg",
    },
    size: {
      sm: "h-(--badge-height) min-w-(--badge-width) rounded-(--badge-radius) px-(--badge-padding-x) type-badge",
      md: "h-(--delta-height) rounded-full px-(--delta-padding-x) type-body font-semibold tabular-nums inset-ring inset-ring-line-subtle",
    },
  },
  defaultVariants: { tone: "neutral", size: "sm" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/** A short status or change, in one of the soft tones. */
export function Badge({ tone, size, className, ...props }: BadgeProps) {
  return <span className={badgeVariants({ tone, size, className })} {...props} />;
}
