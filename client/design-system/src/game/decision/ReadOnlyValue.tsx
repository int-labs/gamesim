import type { ReactNode } from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { tv } from "../../lib/tv";

/**
 * A value the round works out, where a decision's field would be (Figma's RRP line under
 * ShopLink's discounts, 3628:102771): Regular 16/24, a prefix such as "$" at the start and the
 * value at the end, as a field without its box. `lg` is a headline figure in Poppins SemiBold 24.
 * `brand` is Figma's pink in the shade that reads 4.5:1 on the slate panel (fg-link).
 */
export const readOnlyValueVariants = tv({
  slots: {
    // Short of room, the value goes under its prefix, still at the end, rather than break a number.
    root: "flex min-w-0 flex-wrap items-baseline gap-x-2 tabular-nums",
    prefix: "min-w-0",
    value: "min-w-0 wrap-break-word",
  },
  variants: {
    align: {
      between: { value: "ms-auto text-end" },
      end: { root: "justify-end", value: "text-end" },
      start: { root: "justify-start" },
      center: { root: "justify-center", value: "text-center" },
    },
    size: {
      md: { root: "type-body-lg" },
      lg: { root: "type-stat" },
    },
    tone: {
      default: { root: "text-fg-primary" },
      brand: { root: "text-fg-link" },
      muted: { root: "text-fg-muted" },
      danger: { root: "text-fg-danger" },
    },
  },
  defaultVariants: { align: "between", size: "md", tone: "default" },
});

/**
 * Where read-only values sit in a decision's column: `plain` starts them where a field's text
 * starts, 8 down, with nothing drawn (Figma's RRP line); `card` puts them on a white card with a
 * field's corners and padding, for values that stand in a row of fields (the Product's value card).
 * Cards in a row share the tallest one's height, their first lines level.
 */
export const readOnlyFieldVariants = tv({
  base: "flex min-w-0 flex-col gap-1",
  variants: {
    variant: {
      plain: "pt-2",
      card: "min-h-10 grow rounded-md bg-surface-card px-3 py-2",
    },
  },
  defaultVariants: { variant: "plain" },
});

export interface ReadOnlyFieldProps {
  /** `plain` (default) or `card`. */
  variant?: "plain" | "card";
  /** ReadOnlyValue, one per line. */
  children: ReactNode;
  className?: string;
}

/** The read-only values in a decision's column, lined up with the fields beside them. */
export function ReadOnlyField({ variant, children, className }: ReadOnlyFieldProps) {
  return <div className={readOnlyFieldVariants({ variant, className })}>{children}</div>;
}

export interface ReadOnlyValueProps {
  /** The value as the page writes it ("9,999", "Premium"); a number is grouped (1,250). */
  value: ReactNode;
  /** A number's decimal places. Default 0. */
  decimals?: number;
  /** Before the value: "$", "Total capacity:". */
  prefix?: ReactNode;
  /** Right after the value: "%", " units". */
  suffix?: ReactNode;
  /**
   * `between` (default): the prefix at the start and the value at the end, as in a field. `end`:
   * both at the end, 8 apart; `start`; `center`.
   */
  align?: "between" | "end" | "start" | "center";
  /** `lg`: a headline figure. */
  size?: "md" | "lg";
  /** `brand`: Figma's pink for a price the round works out (ShopLink's RRP); `muted`; `danger`. */
  tone?: "default" | "brand" | "muted" | "danger";
  className?: string;
}

/** One read-only value, read as a line of text: "$ 9,999". */
export function ReadOnlyValue({ value, decimals = 0, prefix, suffix, align, size, tone, className }: ReadOnlyValueProps) {
  const format = useNumberFormat();
  const slots = readOnlyValueVariants({ align, size, tone });
  return (
    <p className={slots.root({ className })}>
      {prefix !== undefined ? <span className={slots.prefix()}>{prefix}</span> : null}
      <span className={slots.value()}>
        {typeof value === "number" ? format.number(value, { decimals }) : value}
        {suffix}
      </span>
    </p>
  );
}
