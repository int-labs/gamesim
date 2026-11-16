import { Fragment, useRef, type CSSProperties, type ReactNode } from "react";
import { tv } from "../../lib/tv";
import { useOverflows } from "../../lib/useOverflows";

/**
 * The statement tables of the Figma player (Tables 904:131713: Business Performance, PNL, Balance
 * Sheet, Cash Flow), measured: a white table with 16 px corners, a gray 200 edge and the default
 * drop shadow; a slate 200 header and 44 px rows on a gray 200 rule, all in 16/24; the labels in
 * the column that takes the rest, the figures right-aligned in 164 px columns, then the change. A
 * total is SemiBold on slate 100 (Net Interest Income), and so is a section's heading (Assets); a
 * line under a parent sits 20 px further in, in italic (Salary under Operating Expense); a 22 px
 * slate 200 band parts the groups. Figma's header labels are gray 500 (3.9:1 on slate); they use
 * gray 600, as the Admin table's do. Figma colours the change green or red, but whether a rise is
 * good depends on the line (costs, a ratio of bad loans), so it stays gray unless the game says
 * which way this line reads (`changeTone`).
 */
export const statementTableVariants = tv({
  slots: {
    // The frame clips the header's corners and draws the edge above everything inside it.
    frame: [
      "relative isolate overflow-hidden rounded-(--statement-radius) bg-surface-card shadow-sm",
      "after:pointer-events-none after:absolute after:inset-0 after:z-raised after:rounded-(--statement-radius) after:inset-ring after:inset-ring-line",
    ],
    scroller: "table-scrollbar relative w-full overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
    table: "w-full border-separate border-spacing-0",
    // The labels stay in view while the figures scroll sideways under them.
    headerLabel: [
      "sticky inset-s-0 z-raised h-(--statement-row-height) min-w-(--statement-label-min-width) border-b border-line bg-surface-header",
      "px-(--table-cell-padding-x) py-(--statement-cell-padding-y) text-start type-body-lg font-semibold text-fg-muted",
    ],
    headerValue: [
      "h-(--statement-row-height) w-(--statement-value-width) border-b border-line bg-surface-header",
      "px-(--table-cell-padding-x) py-(--statement-cell-padding-y) text-end type-body-lg font-semibold whitespace-nowrap text-fg-muted",
    ],
    label: [
      "sticky inset-s-0 z-raised h-(--statement-row-height) min-w-(--statement-label-min-width) border-b border-line",
      "statement-indent py-(--statement-cell-padding-y) pe-(--table-cell-padding-x) text-start type-body-lg wrap-break-word text-fg-body",
    ],
    value: [
      "h-(--statement-row-height) border-b border-line px-(--table-cell-padding-x) py-(--statement-cell-padding-y)",
      "text-end type-body-lg whitespace-nowrap text-fg-body tabular-nums",
    ],
    change: [
      "h-(--statement-row-height) border-b border-line px-(--table-cell-padding-x) py-(--statement-cell-padding-y)",
      "text-end type-body-lg whitespace-nowrap tabular-nums",
    ],
    // A figure the game doesn't have yet.
    missing: "text-fg-subtle",
    gap: "h-(--statement-gap-height) border-b border-line bg-surface-header p-0",
    // In the table's own frame, so it reads the same on a card or on the page.
    empty: "rounded-(--statement-radius) bg-surface-card px-(--table-cell-padding-x) py-6 text-center type-body-lg text-fg-subtle shadow-sm inset-ring inset-ring-line",
  },
  variants: {
    kind: {
      line: { label: "bg-surface-card font-normal", value: "bg-surface-card font-normal", change: "bg-surface-card font-normal" },
      total: { label: "bg-surface-panel font-semibold", value: "bg-surface-panel font-semibold", change: "bg-surface-panel font-semibold" },
      section: { label: "bg-surface-panel font-semibold", value: "bg-surface-panel font-semibold", change: "bg-surface-panel font-semibold" },
    },
    // Gray 500 reads 4.8:1 on white; on slate 100 it falls to 4.4:1, so a total's change is gray 600.
    tone: {
      neutral: { change: "text-fg-subtle" },
      positive: { change: "text-fg-success" },
      negative: { change: "text-fg-danger" },
    },
    italic: { true: { label: "italic" } },
    // A config's bottom border: the firm rule accounts draw under a total.
    ruled: {
      true: { label: "border-b-2 border-b-fg-primary", value: "border-b-2 border-b-fg-primary", change: "border-b-2 border-b-fg-primary" },
    },
  },
  compoundVariants: [
    { kind: ["total", "section"], tone: "neutral", class: { change: "text-fg-muted" } },
    { kind: ["total", "section"], class: { missing: "text-fg-muted" } },
  ],
  defaultVariants: { kind: "line", tone: "neutral", italic: false, ruled: false },
});

/** How a line's change reads, when the game knows whether a rise is good for it. */
export type StatementTone = "neutral" | "positive" | "negative";

export interface StatementRow {
  /** A stable key: the line's field key. */
  id: string;
  /** The line's name, as the game translates it. */
  label: ReactNode;
  /**
   * The line's figures, one per column, formatted by the game ("$5,540,791,948", "44.69%"). `null`
   * is a figure the game doesn't have yet, shown as "N/A" in gray; left out, the cell stays empty
   * (a heading, or a parent whose lines below carry the figures).
   */
  values?: readonly (ReactNode | null)[];
  /** The change column's words: "(+2.4%)", "N/A". Left out, the cell stays empty. */
  change?: ReactNode;
  /** Gray (default) unless the game knows which way is good for this line: `positive` green, `negative` red. */
  changeTone?: StatementTone;
  /**
   * `line` (default); `total`, a subtotal or total, SemiBold on slate (Net Interest Income);
   * `section`, a heading over the lines that follow, SemiBold on slate (Assets).
   */
  kind?: "line" | "total" | "section";
  /** How many levels under a parent: 20 px further in each, and a line (not a total or a heading) in italic. Default 0. */
  indent?: number;
  /** In italic without an indent. */
  italic?: boolean;
  /** A slate band above the line, parting it from the group before (Figma's 22 px spacer row). */
  gapBefore?: boolean;
  /** An admin's own colour for the line (a statement config's row colour), over white or a total's slate. */
  color?: string;
  /** A firm rule under the line (a statement config's bottom border), as accounts draw under a total. */
  ruleBelow?: boolean;
}

export interface StatementTableMessages {
  /** Shown for a figure the game doesn't have yet (`null`). Default "N/A". */
  noValue: string;
  /** Names the labels' column for screen readers while `labelHeader` is left out. Default "Line item". */
  labelColumn: string;
}

const defaultMessages: StatementTableMessages = {
  noValue: "N/A",
  labelColumn: "Line item",
};

export interface StatementTableProps {
  /** Names the table for assistive technology: the statement ("Business Performance"). */
  label: string;
  /** Heads the figures' columns, oldest first ("Round 1", "Year 2"). */
  columns: readonly ReactNode[];
  /** Heads the change column ("YoY Change"); left out, the table has no change column. */
  changeHeader?: ReactNode;
  /** Heads the labels' column (Figma's "KEY INDICATORS"); empty to the eye by default. */
  labelHeader?: ReactNode;
  /** The lines, in order. */
  rows: readonly StatementRow[];
  /** Shown instead of the table while there are no lines: "No performance data available for this level." */
  empty?: ReactNode;
  /** Words for assistive technology and missing figures, for translation. */
  messages?: Partial<StatementTableMessages>;
  className?: string;
}

/**
 * A statement: lines down the side, a round or a year in each column, and the change against an
 * earlier column at the end. The game computes and formats every figure; the table lays them out.
 * On a narrow screen the figures scroll sideways inside the frame while the labels stay in view.
 */
export function StatementTable({ label, columns, changeHeader, labelHeader, rows, empty, messages: messageOverrides, className }: StatementTableProps) {
  const messages = { ...defaultMessages, ...messageOverrides };
  const slots = statementTableVariants();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overflows = useOverflows(scrollerRef);
  const hasChange = changeHeader !== undefined && changeHeader !== null;
  const columnCount = 1 + columns.length + (hasChange ? 1 : 0);

  if (rows.length === 0 && empty !== undefined) return <p className={slots.empty({ className })}>{empty}</p>;

  return (
    <div className={slots.frame({ className })}>
      <div ref={scrollerRef} className={slots.scroller()} {...(overflows ? { tabIndex: 0, role: "region", "aria-label": label } : {})}>
        <table aria-label={label} className={slots.table()}>
          <thead>
            <tr>
              <th scope="col" className={slots.headerLabel()}>
                {labelHeader ?? <span className="sr-only">{messages.labelColumn}</span>}
              </th>
              {columns.map((column, index) => (
                <th key={index} scope="col" className={slots.headerValue()}>
                  {column}
                </th>
              ))}
              {hasChange ? (
                <th scope="col" className={slots.headerValue()}>
                  {changeHeader}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const level = Math.max(0, Math.floor(row.indent ?? 0));
              const kind = row.kind ?? "line";
              const cells = statementTableVariants({
                kind,
                tone: row.changeTone,
                // Figma's sub-lines are in italic; a total or a heading set in keeps its upright SemiBold.
                italic: row.italic === true || (level > 0 && kind === "line"),
                ruled: row.ruleBelow === true,
              });
              // Each cell carries the line's colour, the sticky label too, so the figures pass under it.
              const colour: CSSProperties | undefined = row.color ? { backgroundColor: row.color } : undefined;
              const labelStyle: CSSProperties | undefined =
                level > 0 ? ({ ...colour, "--statement-level": level } as CSSProperties) : colour;
              return (
                <Fragment key={row.id}>
                  {row.gapBefore ? (
                    <tr aria-hidden="true">
                      <td colSpan={columnCount} className={cells.gap()} />
                    </tr>
                  ) : null}
                  <tr>
                    <th scope="row" className={cells.label()} style={labelStyle}>
                      {row.label}
                    </th>
                    {columns.map((_, index) => {
                      const value = row.values?.[index];
                      return (
                        <td key={index} className={cells.value()} style={colour}>
                          {value === null ? <span className={cells.missing()}>{messages.noValue}</span> : value}
                        </td>
                      );
                    })}
                    {hasChange ? (
                      <td className={cells.change()} style={colour}>
                        {row.change}
                      </td>
                    ) : null}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
