import type { ReactNode } from "react";
import { tv } from "../../lib/tv";

/** Where a value sits in its row, in today's revenue table's four bands. */
export type HeatBand = "high" | "good" | "fair" | "low";

/** The band of a score from 0 (the row's least) to 1 (its most): over 0.85, over 0.6, over 0.3, or less, as today's table. */
export function heatBand(score: number): HeatBand {
  if (score > 0.85) return "high";
  if (score > 0.6) return "good";
  if (score > 0.3) return "fair";
  return "low";
}

/** Each value's place in its row, from 0 (the least) to 1 (the most); 0.5 for every value of an even row, as today's table. */
export function heatScores(values: readonly number[]): number[] {
  const low = Math.min(...values);
  const range = Math.max(...values) - low;
  return values.map((value) => (range === 0 || !Number.isFinite(range) ? 0.5 : (value - low) / range));
}

/**
 * A value on the tone of its place in its row: today's revenue table colours its cells green,
 * lime, orange or red; here a tile in the cell takes the tone, a shade lighter, so the table
 * keeps its lines and the value reads at 9:1 or more in gray 900.
 */
export const heatCellVariants = tv({
  base: "inline-flex min-w-14 justify-end rounded-md px-2 py-0.5 font-semibold text-fg-primary tabular-nums",
  variants: {
    band: {
      high: "bg-(--heat-high)",
      good: "bg-(--heat-good)",
      fair: "bg-(--heat-fair)",
      low: "bg-(--heat-low)",
    },
  },
});

export interface HeatCellProps {
  /** The value's place in its row, from 0 to 1 (heatScores works it out). */
  score: number;
  /** The value, as the table writes it: "1.59". */
  children: ReactNode;
  /** Read after the value by screen readers, when its place matters more than the number: "highest". */
  srLabel?: string;
  className?: string;
}

/** A table value on the tone of its place in its row (DataTable's cells). */
export function HeatCell({ score, children, srLabel, className }: HeatCellProps) {
  const band = heatBand(score);
  return (
    <span data-band={band} className={heatCellVariants({ band, className })}>
      {children}
      {srLabel ? <span className="sr-only"> ({srLabel})</span> : null}
    </span>
  );
}
