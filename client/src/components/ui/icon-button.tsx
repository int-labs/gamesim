import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpRight } from "lucide-react";
import * as React from "react";
import { WithTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** A2 IconButton — tooltip is mandatory, it doubles as the accessible label. */
const iconButtonVariants = cva(
  [
    "inline-flex items-center justify-center shrink-0 outline-none",
    "transition-[color,background-color,transform] duration-150",
    "hover:scale-[1.06] active:scale-95",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        outline: "border border-border bg-card text-body hover:bg-muted hover:text-foreground",
        solid: "bg-primary text-primary-foreground hover:bg-primary-hover",
        onDark: "text-white/70 hover:text-white hover:bg-white/10",
      },
      size: {
        sm: "size-7 [&_svg]:size-3.5",
        md: "size-8 [&_svg]:size-4",
        lg: "size-9 [&_svg]:size-[18px]",
      },
      shape: { circle: "rounded-full", rounded: "rounded-sm" },
    },
    defaultVariants: { variant: "ghost", size: "md", shape: "circle" },
  }
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  label: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, shape, label, tooltipSide = "top", children, ...props }, ref) => (
    <WithTooltip label={label} side={tooltipSide}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(iconButtonVariants({ variant, size, shape }), className)}
        {...props}
      >
        {children}
      </button>
    </WithTooltip>
  )
);
IconButton.displayName = "IconButton";

/**
 * "Cards are doors" (spec §2.8 r8) — the 32px outline arrow that sits top-right
 * of every navigable card. Nudges up-right and fills pink on hover.
 */
export const CardArrow = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string; onDark?: boolean }
>(({ className, label = "Open", onDark = false, ...props }, ref) => (
  <WithTooltip label={label}>
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "group/arrow inline-flex size-8 shrink-0 items-center justify-center rounded-full border outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        onDark
          ? "border-white/25 text-white/80 hover:border-transparent hover:bg-white hover:text-navy-900"
          : "border-border text-muted-foreground hover:border-transparent hover:bg-primary hover:text-primary-foreground",
        className
      )}
      {...props}
    >
      <ArrowUpRight className="size-4 transition-transform duration-150 group-hover/arrow:translate-x-[1px] group-hover/arrow:-translate-y-[1px]" />
    </button>
  </WithTooltip>
));
CardArrow.displayName = "CardArrow";
