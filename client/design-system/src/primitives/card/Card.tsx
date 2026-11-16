import type { HTMLAttributes, ReactNode } from "react";
import { Heading } from "../../foundations/text/Heading";
import { Text } from "../../foundations/text/Text";
import { tv, type VariantProps } from "../../lib/tv";

/**
 * The surfaces of the Figma screens, measured: white cards with 16, 24 or 32 px corners by role,
 * and slate panels inside them. Their edges are inset rings, as Figma's inside strokes: they take
 * nothing from the padding.
 */
export const cardVariants = tv({
  base: "flex flex-col",
  variants: {
    variant: {
      /**
       * A card on the page: the Admin list card. White, 16 px corners, 16 px padding, 24 px between
       * blocks; a black 8% edge and Figma's card shadow lift it off the page (Figma's 16% outline
       * read as a grey frame). The summary and container cards share the edge and the shadow.
       */
      card: "gap-6 rounded-(--card-radius) bg-surface-card p-(--card-padding) shadow-card inset-ring inset-ring-line-subtle",
      /** A card resting on a slate panel: the chart cards. Its edge is slate 200. */
      nested: "gap-6 rounded-(--card-radius) bg-surface-card p-(--card-padding) inset-ring inset-ring-line-card",
      /** The Admin page's header card: 24 px corners, 16 px above and below, 24 px at the sides. */
      summary: "gap-4 rounded-(--card-radius-summary) bg-surface-card px-(--card-padding-lg) py-(--card-padding) shadow-card inset-ring inset-ring-line-subtle",
      /** A large container: the round card, the statement tables; 32 px corners. */
      container: "gap-6 rounded-(--card-radius-container) bg-surface-card p-(--card-padding) shadow-card inset-ring inset-ring-line-subtle",
      /** A slate panel inside a container: the strategy inputs, the event and metrics panels. */
      panel: "gap-4 rounded-(--card-radius) bg-surface-panel p-5",
    },
  },
  defaultVariants: { variant: "card" },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

/** A surface that groups related content. */
export function Card({ variant, className, ...props }: CardProps) {
  return <div className={cardVariants({ variant, className })} {...props} />;
}

export interface CardHeaderProps {
  /** The card's title: "Revenue Comparison", "Event History". */
  title: ReactNode;
  /** Its heading level in the page. Default 2. */
  level?: 2 | 3 | 4;
  /** A line under the title. */
  description?: ReactNode;
  /** At the right of the title: buttons, a menu. */
  actions?: ReactNode;
  /** An id for the title, so what the card holds can be named by it (aria-labelledby). */
  titleId?: string;
}

/**
 * The title row of a card: Poppins Medium 16 in gray 800, as the Figma chart cards. The actions
 * sit at the right while the title keeps at least 192 px beside them; when they need more, they
 * move under the title rather than squeeze it.
 */
export function CardHeader({ title, level = 2, description, actions, titleId }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <Heading id={titleId} level={level} variant="heading-sm" tone="body">
          {title}
        </Heading>
        {description ? <Text tone="muted">{description}</Text> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
