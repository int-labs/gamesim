import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A1 Button. Brand §7.3: pink is the CTA colour. `--primary` resolves to
 * pink-600 (5.02:1 against white) so 14px labels stay WCAG AA — the canonical
 * #F9137D is reserved for chips/accents where it isn't carrying small text.
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold",
    "transition-colors duration-150 outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-navy-800",
        tinted: "bg-accent text-accent-foreground hover:bg-pink-100 dark:hover:bg-accent/70",
        outline: "border border-border bg-card text-body hover:bg-muted hover:text-foreground",
        ghost: "text-body hover:bg-muted hover:text-foreground",
        /* destructive-solid, not destructive: the dark-theme text hue is far
           too light to sit behind white labels (2.85:1). */
        destructive: "bg-destructive-solid text-destructive-foreground hover:brightness-110",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
        onDark: "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-4",
        md: "h-9 px-4 text-[14px] [&_svg]:size-4",
        lg: "h-11 px-5 text-[15px] [&_svg]:size-5",
        icon: "h-9 w-9 [&_svg]:size-4",
        iconSm: "h-8 w-8 [&_svg]:size-4",
      },
      shape: {
        pill: "rounded-full",
        rounded: "rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md", shape: "rounded" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, shape, asChild = false, loading = false, children, disabled, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, shape }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            {/* Label stays put so the button never changes width mid-action. */}
            <Loader2 className="absolute left-1/2 -translate-x-1/2 animate-spin" />
            <span className="invisible contents">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
