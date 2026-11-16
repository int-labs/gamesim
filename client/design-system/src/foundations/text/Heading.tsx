import { forwardRef, type HTMLAttributes } from "react";
import { tv, type VariantProps } from "../../lib/tv";
import { textTones } from "./Text";

export const headingVariants = tv({
  base: "text-balance",
  variants: {
    /** The heading role. The Figma screens set titles in Poppins and the wordmarks with a gradient. */
    variant: {
      // w-fit: the gradient spans the letters, not the whole line; a brand never wraps.
      wordmark: "w-fit type-wordmark bg-gradient-wordmark bg-clip-text whitespace-nowrap",
      "wordmark-player": "w-fit type-wordmark-player bg-gradient-wordmark bg-clip-text whitespace-nowrap",
      "page-title": "type-page-title",
      "modal-title": "type-modal-title",
      "section-title": "type-section-title",
      "panel-title": "type-panel-title",
      heading: "type-heading",
      "heading-sm": "type-heading-sm",
    },
    tone: textTones,
    align: {
      start: "text-start",
      center: "text-center",
      end: "text-end",
    },
    /** One line, cut with an ellipsis; never wider than its container, also in a flex column. */
    truncate: { true: "max-w-full truncate" },
  },
  compoundVariants: [
    // A wordmark paints its letters with the gradient, so a tone would hide it.
    { variant: ["wordmark", "wordmark-player"], className: "text-transparent" },
  ],
  defaultVariants: { tone: "primary" },
});

const defaultVariantForLevel = {
  1: "page-title",
  2: "section-title",
  3: "heading",
  4: "heading-sm",
  5: "heading-sm",
  6: "heading-sm",
} as const;

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headingVariants> {
  /** The document level (h1 to h6). The look comes from `variant`, which defaults by level. */
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

/** A heading: the document level and the look are chosen separately. */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level, variant, tone, align, truncate, className, ...props },
  ref,
) {
  const Element = `h${level}` as const;
  return (
    <Element
      ref={ref}
      className={headingVariants({ variant: variant ?? defaultVariantForLevel[level], tone, align, truncate, className })}
      {...props}
    />
  );
});
