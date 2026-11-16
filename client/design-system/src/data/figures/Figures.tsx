import type { ReactNode } from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { tv } from "../../lib/tv";

/**
 * The round's figures beside a decision (Figma's read-only list in the segment card, 864:34269):
 * each label in Regular 12/16 gray 600 and its value at the end in Regular 14/20 gray 900, 8 in
 * from the start, 2 apart; the total in bold. A long label wraps; its value stays on one line.
 */
export const figuresVariants = tv({
  slots: {
    root: "flex flex-col gap-0.5",
    item: "flex items-center justify-between gap-2 ps-2",
    label: "min-w-0 type-caption text-fg-muted",
    value: "shrink-0 type-body whitespace-nowrap text-fg-primary tabular-nums",
  },
  variants: {
    total: { true: { label: "font-bold", value: "font-bold" } },
  },
});

export interface FiguresProps {
  /** Figure, in reading order. */
  children: ReactNode;
  className?: string;
}

/** A list of figures, each read with its label (a description list). */
export function Figures({ children, className }: FiguresProps) {
  return <dl className={figuresVariants().root({ className })}>{children}</dl>;
}

export interface FigureProps {
  /** What the figure is: "Current Number of people:", "Past Salary". */
  label: ReactNode;
  /** The figure as the page writes it ("$99,999"); a number is grouped (1,250). */
  value: ReactNode;
  /** A number's decimal places. Default 0. */
  decimals?: number;
  /** The figure the others add up to ("Total people end of year:"), in bold. */
  total?: boolean;
  className?: string;
}

/** One figure and its label. */
export function Figure({ label, value, decimals = 0, total = false, className }: FigureProps) {
  const format = useNumberFormat();
  const slots = figuresVariants({ total });
  return (
    <div className={slots.item({ className })}>
      <dt className={slots.label()}>{label}</dt>
      <dd className={slots.value()}>{typeof value === "number" ? format.number(value, { decimals }) : value}</dd>
    </div>
  );
}
