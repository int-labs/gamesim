import { motion } from "motion/react";
import * as React from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number; future?: boolean; highlight?: boolean };

/**
 * The Donezo signature bar chart (spec §8.2), hand-rolled.
 * Solid = actual, 45° hatch = future/not-yet-real. The highlighted bar carries
 * a floating value tag with a dot connector.
 */
export function WeeklyBars({
  data,
  height = 220,
  className,
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [hovered, setHovered] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const dim = hovered != null && hovered !== i;
          return (
            <div
              key={`${d.label}-${i}`}
              className="group/bar relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Floating value tag on the highlighted or hovered bar */}
              {(d.highlight || hovered === i) && d.value > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 z-10 -translate-x-1/2"
                  style={{ bottom: `calc(${pct}% + 12px)` }}
                >
                  <div className="flex flex-col items-center">
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold tnum text-background">
                      {d.value}
                    </span>
                    <span className="mt-0.5 size-1 rounded-full bg-foreground" />
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={reduced ? false : { height: 0 }}
                animate={{ height: `${Math.max(pct, 2)}%` }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.5, ease: EASE.out, delay: i * 0.04 }
                }
                className={cn(
                  "w-full rounded-lg transition-opacity duration-150",
                  d.future
                    ? "hatch border border-border bg-card"
                    : d.highlight
                      ? "bg-chart-2"
                      : "bg-chart-1",
                  dim && "opacity-55"
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
        {data.map((d, i) => (
          <span
            key={`${d.label}-lab-${i}`}
            className={cn(
              "flex-1 text-center text-[11px] font-medium transition-colors",
              hovered === i || d.highlight ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
