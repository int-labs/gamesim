import { Field } from "@base-ui/react/field";
import { useId, type CSSProperties, type ReactNode } from "react";
import { tv } from "../../lib/tv";
import { DecisionLevelLabel, type DecisionLevel } from "./DecisionRow";

/**
 * The segment card (Figma 870:34335): a white card with 32 px corners holding slate tiles 16 apart,
 * one decision each. A tile's title sits in a slate 200 chip in Poppins SemiBold 18, the level
 * after it for a slider; its caption under it, then a gray 200 line. Its control is at the bottom:
 * a slider with its chips stacked beside it, or the round's figures with a field beside them under
 * the field's own label. Tiles in a row share the tallest one's height. After Submit the control
 * and its chips dim to 40%, as the rows do; the figures stay.
 */
export const decisionTileVariants = tv({
  slots: {
    tiles: [
      "decision-tiles grid gap-(--decision-tiles-gap) rounded-(--card-radius-container) bg-surface-card p-(--card-padding)",
      "shadow-card inset-ring inset-ring-line-subtle",
    ],
    tile: "flex min-w-0 flex-col justify-between gap-4 rounded-2xl bg-surface-panel p-4",
    header: "flex flex-col items-start gap-1 border-b border-line pb-(--decision-row-padding)",
    chip: "flex max-w-full items-center gap-3 rounded-lg bg-(--decision-label-bg) px-2 py-1",
    title: "min-w-0 type-heading wrap-break-word text-fg-primary",
    description: "ps-2 type-caption text-fg-muted",
    // The figures, the control and the chips share a bottom edge; a field with too little room
    // beside the figures goes under them.
    body: "flex flex-wrap items-end gap-x-(--decision-tile-gap) gap-y-3",
    figures: "w-(--decision-figures-width) shrink-0",
    control: [
      "flex min-w-(--decision-tile-field-min-width) flex-1 flex-col gap-1.5",
      "transition-opacity duration-fast ease-standard data-locked:opacity-40 motion-reduce:transition-none",
    ],
    label: "type-caption text-fg-primary",
    // The chips stacked, 8 apart, each a chip's full width and height (a chip shares a row's width
    // from a basis of 0; stacked, it keeps its own height).
    chips: [
      "w-(--chip-width) shrink-0 *:flex-col *:*:basis-auto",
      "transition-opacity duration-fast ease-standard data-locked:opacity-40 motion-reduce:transition-none",
    ],
  },
});

export interface DecisionTilesProps {
  /**
   * At most this many tiles side by side: the segment's columns. Default 3. Each tile keeps
   * at least Figma's 341 px, so a narrower card shows fewer in a row, and a phone one.
   */
  columns?: 1 | 2 | 3;
  /** DecisionTile. */
  children: ReactNode;
  className?: string;
}

/** The card that holds a segment's decisions as tiles. */
export function DecisionTiles({ columns = 3, children, className }: DecisionTilesProps) {
  const tracks = { "--decision-tiles-columns": columns } as CSSProperties;
  return (
    <div className={decisionTileVariants().tiles({ className })} style={tracks}>
      {children}
    </div>
  );
}

export interface DecisionTileProps {
  /** The decision's name, in its chip: "Number of RMs", "Training". */
  title: ReactNode;
  /** What it does: "Number of Relationship Managers hired."; the control's description. */
  description?: ReactNode;
  /** A slider's level after this round's change, beside the title: "18 (-2)". */
  level?: DecisionLevel;
  /** The round's figures, beside the control: Figures. */
  figures?: ReactNode;
  /**
   * The control's own label, above it: "New RMs", "Salary Level". Without one the title names the
   * control; with one the title names the tile.
   */
  label?: ReactNode;
  /** The decision's cost and energy (ResourceChips), stacked at the end. */
  chips?: ReactNode;
  /** The round's decisions are locked (after Submit): the control dims and stops answering. */
  disabled?: boolean;
  /** The field's name when a form is submitted. */
  name?: string;
  /** The control: NumberField, Select, Slider. */
  children: ReactNode;
  className?: string;
}

/**
 * One decision in the segment card. As a DecisionRow does, it names and describes its control
 * through Base UI Field: by the title, or by its own label when it has one, the tile then being a
 * group named by the title.
 */
export function DecisionTile({ title, description, level, figures, label, chips, disabled = false, name, children, className }: DecisionTileProps) {
  const slots = decisionTileVariants();
  const titleId = useId();
  const locked = disabled || undefined;
  return (
    <Field.Root
      disabled={disabled}
      name={name}
      role={label ? "group" : undefined}
      aria-labelledby={label ? titleId : undefined}
      className={slots.tile({ className })}
    >
      <div className={slots.header()}>
        <div className={slots.chip()}>
          {label ? (
            <span id={titleId} className={slots.title()}>
              {title}
            </span>
          ) : (
            <Field.Label className={slots.title()}>{title}</Field.Label>
          )}
          {level ? <DecisionLevelLabel level={level} /> : null}
        </div>
        {description ? <Field.Description className={slots.description()}>{description}</Field.Description> : null}
      </div>
      <div className={slots.body()}>
        {figures ? <div className={slots.figures()}>{figures}</div> : null}
        <div className={slots.control()} data-locked={locked}>
          {label ? <Field.Label className={slots.label()}>{label}</Field.Label> : null}
          {children}
        </div>
        {chips ? (
          <div className={slots.chips()} data-locked={locked}>
            {chips}
          </div>
        ) : null}
      </div>
    </Field.Root>
  );
}
