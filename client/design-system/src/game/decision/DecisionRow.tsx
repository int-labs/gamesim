import { Field } from "@base-ui/react/field";
import { Children, createContext, useContext, useId, type ReactNode } from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { Heading } from "../../foundations/text/Heading";
import { tv } from "../../lib/tv";

/**
 * The player's decisions (Figma 830:87100 and 832:92216 in the "Set Your Strategy Inputs" panel,
 * Frame 38752): rows on the slate panel, 12 apart, a gray 200 line under each. A row is its title
 * in a slate 200 chip (Source Sans 16/24), a caption under it in gray 600, and its control at the
 * end: a 168 field, or a 260 slider 40 after the text, the text 300 wide at most. On a phone the
 * control goes under the text, at full width. After Submit the control's column dims to 40% as
 * one, as Figma draws the submitted page (data-locked): the controls in it do not dim again.
 */
export const decisionVariants = tv({
  slots: {
    panel: "flex flex-col gap-(--decision-panel-gap) rounded-2xl bg-surface-panel p-(--decision-panel-padding)",
    rows: "flex flex-col gap-(--decision-row-gap)",
    row: "flex flex-col gap-3 border-b border-line pb-(--decision-row-padding) sm:flex-row sm:items-start sm:justify-between",
    text: "flex min-w-0 flex-1 flex-col items-start sm:max-w-(--decision-text-width)",
    chip: "flex max-w-full items-center gap-2 rounded-lg bg-(--decision-label-bg) px-2 py-1",
    label: "type-body-lg font-semibold text-fg-primary",
    level: "flex shrink-0 items-baseline gap-0.5 text-fg-accent",
    levelValue: "type-heading tabular-nums",
    levelChange: "type-badge tabular-nums",
    description: "ps-2 type-caption text-fg-muted",
    control: "flex w-full shrink-0 flex-col gap-1.5 transition-opacity duration-fast ease-standard data-locked:opacity-40 motion-reduce:transition-none",
  },
  variants: {
    control: {
      field: { row: "sm:gap-(--decision-field-gap)", control: "sm:w-(--number-field-width)" },
      // The chips 12 under the slider; last round's value 16 under it (Figma 864:26041).
      slider: {
        row: "sm:gap-(--decision-slider-gap)",
        control: "gap-3 sm:w-(--decision-slider-width) *:data-previous:mt-1",
        description: "mt-1",
      },
    },
  },
  defaultVariants: { control: "field" },
});

/**
 * Decisions with a column per sub-product (Figma's ShopLink Channel Execution, 2709:179027, and
 * GrowthLab's Segment Level Decision): the section's title and caption in a 320 block, the
 * columns' names in Poppins Regular 20 over their columns with a 1 x 30 line between them, and a
 * gray 200 line under the whole header; under it, the slate panel of rows, 16 apart. A row's
 * title is plain Source Sans 16/24 over its caption, 320 wide; its cells share 620 px at the
 * end, 49 apart with a line in each gutter: three of 174, two of 285.5. On a phone the cells go
 * under the title, one under another, each with its column's name.
 */
export const decisionColumnsVariants = tv({
  slots: {
    section: "flex flex-col gap-4",
    header: "flex flex-col gap-2 border-b border-line pb-(--decision-header-padding) sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pe-4",
    heading: "flex min-w-0 flex-col sm:w-(--decision-label-width)",
    headingDescription: "type-caption text-fg-muted",
    names: "hidden sm:flex sm:w-(--decision-columns-width) sm:shrink-0 sm:divide-x sm:divide-line",
    name: "box-content min-w-0 flex-1 basis-0 px-(--decision-column-gutter) type-panel-title font-normal wrap-break-word text-fg-primary first:ps-0 last:pe-0",
    panel: "flex flex-col gap-4 rounded-2xl bg-surface-panel p-4",
    row: "flex flex-col gap-3 border-b border-line pb-(--decision-row-padding) sm:flex-row sm:items-start sm:justify-between sm:gap-8",
    text: "flex min-w-0 flex-col gap-1 sm:w-(--decision-label-width) sm:shrink-0",
    title: "type-body-lg font-semibold text-fg-primary",
    description: "type-caption text-fg-muted",
    cells: "flex flex-col gap-4 sm:w-(--decision-columns-width) sm:shrink-0 sm:flex-row sm:gap-0 sm:divide-x sm:divide-line",
    cell: [
      "flex min-w-0 flex-col gap-1.5 transition-opacity duration-fast ease-standard data-locked:opacity-40 motion-reduce:transition-none",
      "sm:box-content sm:flex-1 sm:basis-0 sm:px-(--decision-column-gutter) sm:first:ps-0 sm:last:pe-0",
    ],
    cellName: "type-body font-semibold text-fg-muted sm:hidden",
  },
  variants: {
    tone: {
      default: {},
      // A price the round works out, in Figma's pink (ShopLink's RRP line, 3628:102777), in the
      // shade that reads 4.5:1 on the slate panel.
      brand: { title: "text-fg-link", description: "text-fg-link" },
    },
  },
});

/** The columns of a DecisionPanel, for its rows and their cells. */
const DecisionColumnsContext = createContext<readonly ReactNode[] | null>(null);

interface DecisionCellContextValue {
  index: number;
  label: ReactNode;
  description?: ReactNode;
  disabled: boolean;
}

const DecisionCellContext = createContext<DecisionCellContextValue | null>(null);

export interface DecisionPanelProps {
  /** "Set Your Strategy Inputs", "Channel Execution". */
  title: ReactNode;
  /** A line under the title: "Set specific pricing to capture market share in each channel." */
  description?: ReactNode;
  /**
   * The sub-products' names, one column each ("Modern", "Traditional", "Online"): the panel takes
   * Figma's section look, the names over the rows' DecisionCells.
   */
  columns?: readonly ReactNode[];
  /** The heading's level on the page. Default 2. */
  headingLevel?: 2 | 3 | 4;
  /** DecisionRow. */
  children: ReactNode;
  className?: string;
}

/**
 * The slate panel that holds a page's decisions, under its title; with `columns`, a section whose
 * header names a column per sub-product over the panel of rows.
 */
export function DecisionPanel({ title, description, columns, headingLevel = 2, children, className }: DecisionPanelProps) {
  const titleId = useId();
  if (columns) {
    const slots = decisionColumnsVariants();
    return (
      <section aria-labelledby={titleId} className={slots.section({ className })}>
        <div className={slots.header()}>
          <div className={slots.heading()}>
            <Heading id={titleId} level={headingLevel} variant="panel-title">
              {title}
            </Heading>
            {description ? <p className={slots.headingDescription()}>{description}</p> : null}
          </div>
          {/* Each cell's field says its column itself, so the names are for the eye. */}
          <div aria-hidden className={slots.names()}>
            {columns.map((column, index) => (
              <span key={index} className={slots.name()}>
                {column}
              </span>
            ))}
          </div>
        </div>
        <DecisionColumnsContext.Provider value={columns}>
          <div className={slots.panel()}>{children}</div>
        </DecisionColumnsContext.Provider>
      </section>
    );
  }
  const slots = decisionVariants();
  return (
    <section aria-labelledby={titleId} className={slots.panel({ className })}>
      <Heading id={titleId} level={headingLevel} variant="panel-title">
        {title}
      </Heading>
      {description ? <p className={slots.description({ className: "-mt-2 ps-0" })}>{description}</p> : null}
      <div className={slots.rows()}>{children}</div>
    </section>
  );
}

export interface DecisionLevel {
  /** The level, after this round's change. */
  value: number;
  /** This round's change, in brackets after it. */
  change?: number;
}

/** A decision's level in its title chip (Figma 3.6): "18" in Poppins SemiBold 18 indigo, then "(-2)" in 10/16. */
export function DecisionLevelLabel({ level }: { level: DecisionLevel }) {
  const format = useNumberFormat();
  const slots = decisionVariants();
  return (
    <span className={slots.level()}>
      <span className={slots.levelValue()}>{format.number(level.value)}</span>
      {level.change !== undefined ? <span className={slots.levelChange()}>({format.number(level.change, { signed: true })})</span> : null}
    </span>
  );
}

export interface DecisionRowProps {
  /** The decision's name; it labels the control. */
  label: ReactNode;
  /** What it does; the control's description. */
  description?: ReactNode;
  /** A single-column slider's level beside the title, as today: "18 (0)". */
  level?: DecisionLevel;
  /** `field` (default): a 168 control at the end. `slider`: a 260 one, 40 after the text. */
  control?: "field" | "slider";
  /**
   * In a panel with columns, `brand` sets a read-only decision's title and caption in Figma's pink,
   * as its values (ShopLink's RRP line).
   */
  tone?: "default" | "brand";
  /** The round's decisions are locked (after Submit): the control dims and stops answering. */
  disabled?: boolean;
  /** The field's name when a form is submitted. */
  name?: string;
  /**
   * The control (NumberField, the slider, the select), then what goes under it: the previous value,
   * the chips. In a panel with columns: a DecisionCell for each column, in order.
   */
  children: ReactNode;
  className?: string;
}

/**
 * One decision. Its title and description label and describe the control through Base UI Field,
 * so a NumberField, a slider or a select inside is named for assistive technology without ids. In
 * a panel with columns each DecisionCell is named by the title and its column ("Pricing, Modern").
 */
export function DecisionRow({ label, description, level, control, tone, disabled = false, name, children, className }: DecisionRowProps) {
  const columns = useContext(DecisionColumnsContext);
  const titleId = useId();
  if (columns) {
    const slots = decisionColumnsVariants({ tone });
    return (
      <div role="group" aria-labelledby={titleId} className={slots.row({ className })}>
        <div className={slots.text()}>
          <span id={titleId} className={slots.title()}>
            {label}
          </span>
          {description ? <p className={slots.description()}>{description}</p> : null}
        </div>
        <div className={slots.cells()}>
          {Children.toArray(children).map((cell, index) => (
            <DecisionCellContext.Provider key={index} value={{ index, label, description, disabled }}>
              {cell}
            </DecisionCellContext.Provider>
          ))}
        </div>
      </div>
    );
  }
  const slots = decisionVariants({ control });
  return (
    <Field.Root disabled={disabled} name={name} className={slots.row({ className })}>
      <div className={slots.text()}>
        <div className={slots.chip()}>
          <Field.Label className={slots.label()}>{label}</Field.Label>
          {level ? <DecisionLevelLabel level={level} /> : null}
        </div>
        {description ? <Field.Description className={slots.description()}>{description}</Field.Description> : null}
      </div>
      <div className={slots.control()} data-locked={disabled || undefined}>
        {children}
      </div>
    </Field.Root>
  );
}

export interface DecisionCellProps {
  /** The column's control and what goes under it. Leave it empty where a sub-product does not take the decision: the column stays. */
  children?: ReactNode;
  className?: string;
}

/**
 * One column of a DecisionRow in a panel with columns. Its control is named by the row's title
 * and the column ("Pricing (Base price/unit), Modern") and described by the row's caption; after
 * Submit it dims with its row's other cells. Read in order, a cell starts with its title and
 * column, so a read-only value (ReadOnlyField) is read with them; the caption, shown once beside
 * the row, only describes a control.
 */
export function DecisionCell({ children, className }: DecisionCellProps) {
  const columns = useContext(DecisionColumnsContext);
  const cell = useContext(DecisionCellContext);
  const slots = decisionColumnsVariants();
  if (!columns || !cell) throw new Error("DecisionCell belongs in a DecisionRow of a DecisionPanel with columns.");
  if (!children) return <div className={slots.cell({ className })} />;
  const column = columns[cell.index];
  return (
    <Field.Root disabled={cell.disabled} data-locked={cell.disabled || undefined} className={slots.cell({ className })}>
      <Field.Label className="sr-only">
        {cell.label}, {column}
      </Field.Label>
      {cell.description ? <Field.Description hidden>{cell.description}</Field.Description> : null}
      <span aria-hidden className={slots.cellName()}>
        {column}
      </span>
      {children}
    </Field.Root>
  );
}
