import { Fragment, useId, type MouseEvent, type ReactNode } from "react";
import { tv } from "../../lib/tv";
import { Checkbox } from "../../primitives/checkbox/Checkbox";
import { ResourceChip } from "../resource-chip/ResourceChip";

/**
 * The initiative picker of the Figma Enterprise page (2101:491037, chosen rows 2107:219929) and
 * its history (2101:486664): a white table with 16 px corners and a gray 200 edge, a gray 50
 * header, rows on a gray 200 rule. The picker's header is 44 px in Regular 14/20; each row holds
 * Figma's 28 px box, the name in SemiBold 16/24 (320 wide), the description, and the cost and
 * energy as flat chips stacked 10 apart, all from the row's top. A chosen row turns slate 200 in
 * every cell; one chosen in an earlier round dims to 40% with its check, as Figma's next round
 * (2230:184619). One that cannot be chosen now (at the limit, short of energy) keeps its text
 * readable, to weigh against the chosen ones; only its box dims. The body scrolls within 484 px
 * under its header. On a phone each row stacks its name, description and chips beside its box,
 * rather than four columns to scroll across; explicit table roles keep it a table for screen
 * readers there. The history's header is 48 px in SemiBold 16/24.
 */
export const initiativeTableVariants = tv({
  slots: {
    frame: [
      "relative isolate overflow-hidden rounded-(--initiative-radius) bg-surface-card",
      "after:pointer-events-none after:absolute after:inset-0 after:z-raised after:rounded-(--initiative-radius) after:inset-ring after:inset-ring-line",
    ],
    scroller: "table-scrollbar initiative-scroller relative w-full overflow-auto",
    table: "w-full border-separate border-spacing-0 text-start",
    pickerTable: "max-sm:block sm:min-w-(--initiative-min-width)",
    // On a phone the header row stays for screen readers only, and the body is a column of rows.
    pickerHead: "max-sm:sr-only",
    pickerBody: "max-sm:block",
    headerCell: [
      "sticky top-0 z-raised h-(--initiative-header-height) border-b border-line bg-surface-header-subtle px-(--table-cell-padding-x) text-start align-middle",
      "type-body whitespace-nowrap text-fg-muted uppercase",
    ],
    // The history's header scrolls with the page.
    historyHeaderCell: [
      "h-(--initiative-history-header-height) border-b border-line bg-surface-header-subtle px-(--table-cell-padding-x) text-start align-middle",
      "type-body-lg font-semibold whitespace-nowrap text-fg-muted uppercase",
    ],
    historyColumn: "w-(--initiative-history-column-width)",
    historyCell: "text-fg-body",
    checkHeader: "w-(--initiative-check-width) px-0",
    nameHeader: "w-(--initiative-name-width)",
    costHeader: "w-(--initiative-cost-width)",
    section: "border-b border-line bg-surface-panel px-4 py-3 text-start type-body font-semibold text-fg-body max-sm:block",
    sectionRow: "max-sm:block",
    row: [
      "initiative-row group/row transition-colors duration-fast ease-standard max-sm:border-b max-sm:border-line",
      "data-chosen:bg-(--initiative-chosen-bg) not-data-fixed:cursor-pointer not-data-fixed:not-data-chosen:hover:bg-surface-panel",
    ],
    // Every cell of a row chosen before dims with it, as Figma draws the next round.
    cell: [
      "border-b border-line px-(--table-cell-padding-x) py-(--table-cell-padding-y) align-top type-body-lg text-fg-primary",
      "transition-opacity duration-fast ease-standard group-data-locked/row:opacity-40 motion-reduce:transition-none",
    ],
    checkCell: "ps-4 pe-2 pt-4 max-sm:row-span-3 max-sm:border-b-0",
    nameCell: "font-semibold max-sm:border-b-0 max-sm:ps-0 max-sm:pb-1",
    descriptionCell: "max-sm:border-b-0 max-sm:ps-0 max-sm:py-1",
    costCell: "max-sm:ps-0 max-sm:pt-1 max-sm:border-b-0",
    chips: "flex w-(--initiative-chip-width) flex-col gap-2.5 *:basis-auto max-sm:w-auto max-sm:flex-row max-sm:*:w-(--initiative-chip-width) max-sm:*:grow-0",
  },
});

/** Where an initiative stands this round. */
export type InitiativeState = "open" | "chosen" | "before" | "unavailable";

export interface InitiativeRow {
  /** A stable key: the option's key. */
  key: string;
  /** The initiative's name; it names its box. */
  name: string;
  description?: ReactNode;
  /** What it costs, in the app's currency, and the energy it takes: flat chips. */
  cost?: number;
  energy?: number;
  /**
   * `open` (default), `chosen` this round, chosen `before` (in an earlier round: checked, dimmed,
   * fixed), or `unavailable` now (at the limit, not enough energy: its box dimmed and fixed).
   */
  state?: InitiativeState;
  /** Why it cannot be chosen now, heard with its box: "You can select up to 3 initiatives." */
  reason?: string;
}

export interface InitiativeSection {
  /** The group's band over its rows: "Digital", "People". */
  label: ReactNode;
  /** An admin's own colour for the band (today's section colour). Default slate 100. */
  color?: string;
  rows: readonly InitiativeRow[];
}

export interface InitiativeTableMessages {
  /** Heads the column of boxes, for screen readers. */
  chosen: string;
  name: string;
  description: string;
  cost: string;
  /** Heard with an initiative chosen in an earlier round. */
  before: string;
}

export const defaultInitiativeTableMessages: InitiativeTableMessages = {
  chosen: "Chosen",
  name: "Initiatives",
  description: "Description",
  cost: "Cost",
  before: "Chosen in an earlier round.",
};

export interface InitiativeTableProps {
  /** Names the table when no title does: "Select your Initiatives". */
  "aria-label"?: string;
  /** The id of the title above the table, which names it. */
  "aria-labelledby"?: string;
  /** The initiatives, in order; or `sections`. */
  rows?: readonly InitiativeRow[];
  /** The initiatives in groups, each under its band (today's sections). */
  sections?: readonly InitiativeSection[];
  /** The player chose or cleared an open or chosen initiative. */
  onToggle: (key: string, chosen: boolean) => void;
  /**
   * The player pressed an initiative that cannot change (at the limit, not enough energy, chosen
   * before): the page can say why, as Figma's alert does ("You can select up to 3 initiatives.").
   */
  onRefused?: (row: InitiativeRow) => void;
  /** The round's decisions are locked (after Submit): no box answers. */
  disabled?: boolean;
  /** A cost's decimal places. Default 0. */
  costDecimals?: number;
  messages?: Partial<InitiativeTableMessages>;
  /** Classes for the frame. */
  className?: string;
}

/** Text the player may be selecting: a click that ends a selection chooses nothing. */
function endsSelection() {
  return window.getSelection()?.type === "Range";
}

/**
 * The initiatives to choose from. Each row's box is a checkbox named by the initiative, and a press
 * anywhere on an open row chooses or clears it; the keyboard reaches the boxes. The page decides
 * each row's state (the limit, the energy, earlier rounds) and says why a press was refused.
 */
export function InitiativeTable({
  rows = [],
  sections,
  onToggle,
  onRefused,
  disabled = false,
  costDecimals = 0,
  messages,
  className,
  ...labelling
}: InitiativeTableProps) {
  const text = { ...defaultInitiativeTableMessages, ...messages };
  const slots = initiativeTableVariants();
  const id = useId();
  // With no box to reach (after Submit, or every initiative fixed), the scrolling body takes focus
  // itself, so the keyboard can still scroll it.
  const all = sections ? sections.flatMap((section) => section.rows) : rows;
  const reachable = !disabled && all.some((row) => row.state === undefined || row.state === "open" || row.state === "chosen");
  const scrollerFocus = reachable ? {} : { tabIndex: 0, role: "region", ...labelling };

  const press = (event: MouseEvent<HTMLTableRowElement>, row: InitiativeRow, state: InitiativeState) => {
    if (disabled || endsSelection()) return;
    if (state === "before" || state === "unavailable") {
      onRefused?.(row);
      return;
    }
    // The box answers its own presses.
    if ((event.target as Element).closest("[role='checkbox']")) return;
    onToggle(row.key, state !== "chosen");
  };

  const renderRow = (row: InitiativeRow) => {
    const state = row.state ?? "open";
    const fixed = disabled || state === "before" || state === "unavailable";
    const nameId = `${id}-${row.key}-name`;
    const reasonId = `${id}-${row.key}-reason`;
    const reason = state === "before" ? text.before : state === "unavailable" ? row.reason : undefined;
    return (
      <tr
        key={row.key}
        role="row"
        data-chosen={state === "chosen" || undefined}
        data-fixed={fixed || undefined}
        data-locked={state === "before" || undefined}
        className={slots.row()}
        onClick={(event) => press(event, row, state)}
      >
        <td role="cell" className={slots.cell({ className: slots.checkCell() })}>
          <Checkbox
            variant="choice"
            checked={state === "chosen" || state === "before"}
            disabled={fixed}
            onCheckedChange={(checked) => onToggle(row.key, checked)}
            aria-labelledby={nameId}
            aria-describedby={reason ? reasonId : undefined}
          />
          {reason ? (
            <span id={reasonId} hidden>
              {reason}
            </span>
          ) : null}
        </td>
        <td id={nameId} role="cell" className={slots.cell({ className: slots.nameCell() })}>
          {row.name}
        </td>
        <td role="cell" className={slots.cell({ className: slots.descriptionCell() })}>
          {row.description}
        </td>
        <td role="cell" className={slots.cell({ className: slots.costCell() })}>
          <div className={slots.chips()}>
            {row.cost !== undefined ? <ResourceChip kind="cost" value={row.cost} decimals={costDecimals} flat /> : null}
            {row.energy !== undefined ? <ResourceChip kind="energy" value={row.energy} flat /> : null}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className={slots.frame({ className })}>
      <div className={slots.scroller()} {...scrollerFocus}>
        <table role="table" className={slots.table({ className: slots.pickerTable() })} {...labelling}>
          <thead role="rowgroup" className={slots.pickerHead()}>
            <tr role="row">
              <th role="columnheader" scope="col" className={slots.headerCell({ className: slots.checkHeader() })}>
                <span className="sr-only">{text.chosen}</span>
              </th>
              <th role="columnheader" scope="col" className={slots.headerCell({ className: slots.nameHeader() })}>
                {text.name}
              </th>
              <th role="columnheader" scope="col" className={slots.headerCell()}>
                {text.description}
              </th>
              <th role="columnheader" scope="col" className={slots.headerCell({ className: slots.costHeader() })}>
                {text.cost}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup" className={slots.pickerBody()}>
            {sections
              ? sections.map((section, index) => (
                  <Fragment key={index}>
                    <tr role="row" className={slots.sectionRow()}>
                      <th
                        role="columnheader"
                        colSpan={4}
                        scope="colgroup"
                        className={slots.section()}
                        style={section.color ? { backgroundColor: section.color } : undefined}
                      >
                        {section.label}
                      </th>
                    </tr>
                    {section.rows.map(renderRow)}
                  </Fragment>
                ))
              : rows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface InitiativeHistoryRound {
  /** The round as the page writes it: "Round 1". */
  round: ReactNode;
  /** When its decisions were submitted: "Wed 16 Apr, 2:13 PM". */
  date?: ReactNode;
  /** The initiatives chosen in it, by name. */
  initiatives: readonly ReactNode[];
}

export interface InitiativeHistoryMessages {
  round: string;
  date: string;
  initiatives: string;
  /** In place of the rows before any round has initiatives. */
  empty: string;
  /** A round without initiatives. */
  none: string;
}

/** Today's words (InitiativesHistoryPanel), with Figma's columns. */
export const defaultInitiativeHistoryMessages: InitiativeHistoryMessages = {
  round: "Round",
  date: "Date & time",
  initiatives: "Initiatives",
  empty: "No initiatives history available",
  none: "No initiatives selected",
};

export interface InitiativeHistoryProps {
  "aria-label"?: string;
  /** The id of the title above the table ("Initiatives History"), which names it. */
  "aria-labelledby"?: string;
  /** Earlier rounds, oldest first. */
  rounds: readonly InitiativeHistoryRound[];
  messages?: Partial<InitiativeHistoryMessages>;
  className?: string;
}

/** The initiatives chosen in earlier rounds: the round, when, and the initiatives as a list. */
export function InitiativeHistory({ rounds, messages, className, ...labelling }: InitiativeHistoryProps) {
  const text = { ...defaultInitiativeHistoryMessages, ...messages };
  const slots = initiativeTableVariants();
  const cell = slots.cell({ className: slots.historyCell() });
  return (
    <div className={slots.frame({ className })}>
      <table className={slots.table()} {...labelling}>
        <thead>
          <tr>
            <th scope="col" className={slots.historyHeaderCell({ className: slots.historyColumn() })}>
              {text.round}
            </th>
            <th scope="col" className={slots.historyHeaderCell({ className: slots.historyColumn() })}>
              {text.date}
            </th>
            <th scope="col" className={slots.historyHeaderCell()}>
              {text.initiatives}
            </th>
          </tr>
        </thead>
        <tbody>
          {rounds.length === 0 ? (
            <tr>
              <td colSpan={3} className={slots.cell({ className: "text-fg-muted" })}>
                {text.empty}
              </td>
            </tr>
          ) : (
            rounds.map((round, index) => (
              <tr key={index}>
                <td className={cell}>{round.round}</td>
                <td className={cell}>{round.date}</td>
                <td className={cell}>
                  {round.initiatives.length > 0 ? (
                    <ul className="list-disc ps-5">
                      {round.initiatives.map((initiative, at) => (
                        <li key={at}>{initiative}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-fg-muted">{text.none}</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
