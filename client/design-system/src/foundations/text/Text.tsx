import { forwardRef, type HTMLAttributes } from "react";
import { tv, type VariantProps } from "../../lib/tv";

/** Text colours: the fg tokens (color.fg.*). `inherit` keeps the colour of the surrounding text. */
export const textTones = {
  inherit: "",
  primary: "text-fg-primary",
  body: "text-fg-body",
  muted: "text-fg-muted",
  subtle: "text-fg-subtle",
  faint: "text-fg-faint",
  disabled: "text-fg-disabled",
  link: "text-fg-link",
  accent: "text-fg-accent",
  success: "text-fg-success",
  danger: "text-fg-danger",
  info: "text-fg-info",
  warning: "text-fg-warning",
  "on-primary": "text-fg-on-primary",
  "on-accent": "text-fg-on-accent",
  "on-energy": "text-fg-on-energy",
  "on-danger": "text-fg-on-danger",
  "on-inverse": "text-fg-on-inverse",
  "on-inverse-muted": "text-fg-on-inverse-muted",
} as const;

export const textVariants = tv({
  variants: {
    /** The text role (typography.* tokens): family, size, weight, line height and letter spacing together. */
    variant: {
      "body-lg": "type-body-lg",
      body: "type-body",
      label: "type-label",
      button: "type-button",
      caption: "type-caption",
      badge: "type-badge",
      overline: "type-overline",
      hint: "type-hint",
      "modal-body": "type-modal-body",
      "kpi-label": "type-kpi-label",
      "kpi-value": "type-kpi-value",
      tab: "type-tab",
      stat: "type-stat",
      timer: "type-timer",
    },
    tone: textTones,
    /** Overrides the role's weight, for the Figma pairs such as Body 14/20 regular and semibold. */
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    align: {
      start: "text-start",
      center: "text-center",
      end: "text-end",
    },
    /** One line, cut with an ellipsis; never wider than its container, also in a flex column. */
    truncate: { true: "max-w-full truncate" },
    /** Digits of equal width, so columns and counters line up (Source Sans 3 only; Poppins has none). */
    numeric: { true: "tabular-nums" },
  },
  defaultVariants: { variant: "body", tone: "inherit" },
});

type TextElement = "p" | "span" | "div" | "label" | "strong" | "em" | "small" | "li" | "dt" | "dd" | "figcaption" | "legend" | "time";

export interface TextProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof textVariants> {
  /** The element to render. Default `p`. */
  as?: TextElement;
  /** For `as="label"`. */
  htmlFor?: string;
  /** For `as="time"`. */
  dateTime?: string;
}

/** Running text in one of the design system's text roles. */
export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as: Element = "p", variant, tone, weight, align, truncate, numeric, className, ...props },
  ref,
) {
  return (
    <Element
      // The element type varies, so the ref is typed as the common HTMLElement.
      ref={ref as never}
      className={textVariants({ variant, tone, weight, align, truncate, numeric, className })}
      {...props}
    />
  );
});
