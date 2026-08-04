import { motion } from "motion/react";
import * as React from "react";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The console's core surface. Hierarchy comes from the surface step
 * (tinted canvas → white card), not from borders — spec §1.2 r1.
 * Radius 20px per brand guidelines §11.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { hero?: boolean; interactive?: boolean; padded?: boolean }
>(({ className, hero, interactive, padded = true, children, ...props }, ref) => {
  const base = cn(
    hero ? "hero-surface" : "card-surface border border-border",
    hero && "dark:border dark:border-navy-500/40",
    padded && "p-6",
    className
  );

  if (interactive) {
    return (
      <motion.div
        ref={ref}
        whileHover={{ y: -2 }}
        transition={SPRING.smooth}
        className={cn(base, "transition-shadow duration-150 hover:shadow-hover")}
        {...(props as React.ComponentProps<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div ref={ref} className={base} {...props}>
      {children}
    </div>
  );
});
Card.displayName = "Card";

export function CardHeader({
  title,
  subtitle,
  action,
  eyebrow,
  className,
  onDark,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className={cn("eyebrow mb-1.5", onDark ? "text-hero-muted" : "text-muted-foreground")}>
            {eyebrow}
          </div>
        )}
        <h3
          className={cn(
            "truncate font-sans text-[16px] font-semibold leading-[22px]",
            onDark ? "text-hero-fg" : "text-foreground"
          )}
        >
          {title}
        </h3>
        {subtitle && (
          <p className={cn("mt-0.5 text-[13px] leading-[18px]", onDark ? "text-hero-muted" : "text-muted-foreground")}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}
