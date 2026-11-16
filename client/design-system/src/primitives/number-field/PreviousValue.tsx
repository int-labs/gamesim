import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { tv } from "../../lib/tv";
import { Tooltip } from "../../overlays/tooltip/Tooltip";

/** Up to this many characters, "Previous:" and its value share one line (today's rule). */
const ONE_LINE_LENGTH = 22;

/**
 * The last round's value under a decision (Figma 2097:184137): "Previous: $5k" in italic 14/20
 * gray 600 at the field's end. Today's line is gray 400, which reads 2.5:1 on the slate panel.
 */
export const previousValueVariants = tv({
  slots: {
    root: "flex w-full type-hint text-fg-muted",
    value: "tabular-nums",
    clamped: "line-clamp-2 wrap-break-word",
  },
  variants: {
    align: {
      end: { root: "justify-end text-end" },
      start: { root: "justify-start text-start" },
    },
    long: {
      false: { root: "gap-1 whitespace-nowrap" },
      // Today's long values: "Previous:" on its own line, then the value on up to two.
      true: { root: "flex-col" },
    },
  },
  compoundVariants: [
    { long: true, align: "end", class: { root: "items-end" } },
    { long: true, align: "start", class: { root: "items-start" } },
  ],
  defaultVariants: { align: "end", long: false },
});

export interface PreviousValueProps {
  /** The last round's value, as the page writes it ("$5k", "Premium"); a number is grouped. Nothing: `noneLabel`. */
  value: string | number | null | undefined;
  /** Default "Previous". */
  label?: string;
  /** For a round without a value. Default "None". */
  noneLabel?: string;
  /** `end` under a decision field (default), `start` under a left-aligned control. */
  align?: "end" | "start";
  className?: string;
}

/**
 * The last round's value under a decision; a long one wraps to two lines and shows whole in a
 * tooltip. It carries data-previous, so a decision's column can space it from the control above.
 */
export function PreviousValue({ value, label = "Previous", noneLabel = "None", align, className }: PreviousValueProps) {
  const format = useNumberFormat();
  const text = typeof value === "number" ? value.toLocaleString(format.locale) : value || noneLabel;
  const long = text.length > ONE_LINE_LENGTH;
  const slots = previousValueVariants({ align, long });
  return (
    <p data-previous="" className={slots.root({ className })}>
      <span>{label}:</span>
      {long ? (
        <Tooltip content={text} describe={false}>
          <span className={slots.clamped()}>{text}</span>
        </Tooltip>
      ) : (
        <span className={slots.value()}>{text}</span>
      )}
    </p>
  );
}
