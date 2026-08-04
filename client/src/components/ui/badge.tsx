import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A3 Badge/Chip. Status lives in chips — never in page furniture
 * (spec §1.2 r4). Every status chip keeps its text label, so colour is never
 * the only carrier of meaning.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-sans font-semibold whitespace-nowrap transition-colors",
  {
    variants: {
      tone: {
        success: "bg-success-tint text-success",
        warning: "bg-warning-tint text-warning",
        danger: "bg-destructive-tint text-destructive",
        info: "bg-info-tint text-info",
        neutral: "bg-neutral-tint text-neutral",
        brand: "bg-accent text-accent-foreground",
        navy: "bg-navy-50 text-navy-700 dark:bg-navy-900/60 dark:text-navy-100",
        /* Brand yellow chip — black text (16.5:1). Guidelines §4.3. */
        signal: "bg-yellow-500 text-signal-ink",
        outline: "border border-border bg-transparent text-body",
        count: "bg-muted text-muted-foreground tnum justify-center",
        onDark: "bg-white/12 text-white",
      },
      size: {
        sm: "h-[18px] px-2 text-[11px] leading-none",
        md: "h-[22px] px-2.5 text-[12px] leading-none",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, size, dot, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone, size }), dot && "pl-1.5", className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
);
Badge.displayName = "Badge";

export { badgeVariants };
