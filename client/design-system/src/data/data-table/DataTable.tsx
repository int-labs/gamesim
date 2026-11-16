import { useRender } from "@base-ui/react/use-render";
import { ArrowDown, ArrowDownUp, ArrowRight, ArrowUp } from "lucide-react";
import { useRef, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { cn } from "../../lib/cn";
import { tv } from "../../lib/tv";
import { useOverflows } from "../../lib/useOverflows";
import { Checkbox } from "../../primitives/checkbox/Checkbox";
import { Skeleton } from "../../primitives/skeleton/Skeleton";

export type SortDirection = "ascending" | "descending";

export interface DataTableSort {
  /** The id of the sorted column. */
  column: string;
  direction: SortDirection;
}

export interface DataTableColumn<Row> {
  /** Identifies the column, in `sort` too. */
  id: string;
  header: ReactNode;
  /** Text sits on the row's line; an element (a Badge, buttons) is centred in the row as a box. */
  cell: (row: Row) => ReactNode;
  /** The row's main column, its name: Regular gray 800 where the other cells are SemiBold gray 500. */
  primary?: boolean;
  /** `end` for numbers, so their digits line up. Default `start`. */
  align?: "start" | "center" | "end";
  /** The header becomes a button that asks for this column's order through onSortChange. */
  sortable?: boolean;
  /** The column's width in pixels, as Figma fixes them (Status 180, Rounds 120); leave it out on the column that takes the rest. */
  width?: number;
  /** Classes for this column's cells: wrapping or truncation. */
  className?: string;
}

export interface DataTableMessages {
  /** Names a row's link. Default "Open {name}". */
  open: (name: string) => string;
  /** Names a row's checkbox. Default "Select {name}". */
  select: (name: string) => string;
  /** Names the header checkbox. Default "Select all rows on this page". */
  selectAll: string;
  /** Read while loading. Default "Loading". */
  loading: string;
  /** Heads the actions column for screen readers. Default "Actions". */
  actionsColumn: string;
  /** Heads the links column for screen readers. Default "Open". */
  linkColumn: string;
}

const defaultMessages: DataTableMessages = {
  open: (name) => `Open ${name}`,
  select: (name) => `Select ${name}`,
  selectAll: "Select all rows on this page",
  loading: "Loading",
  actionsColumn: "Actions",
  linkColumn: "Open",
};

export interface DataTableProps<Row> {
  /**
   * Names the table for assistive technology ("Simulations"): a screen may hold several tables.
   * A table under a visible title (a CardHeader) takes the title's words.
   */
  label: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /** A stable key per row, such as the server id: pages and refetches replace the data. */
  rowKey: (row: Row) => string;
  /** Names a row for its link and checkbox ("Novabank Growth Simulation"). */
  rowLabel?: (row: Row) => string;
  /** Sorting happens on the server: the table shows `sort` and reports header presses. */
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  /** Where a row leads: the Figma arrow in the last cell becomes this link, and the row opens it on click. */
  rowHref?: (row: Row) => string;
  /** The router's link for a row, instead of rowHref: (row) => <Link to={`/simulations/${row.id}`} />. */
  rowLink?: (row: Row) => ReactElement;
  /** Buttons or a menu at the end of each row. */
  rowActions?: (row: Row) => ReactNode;
  /** Selection, controlled: a checkbox column appears when onSelectionChange is given. */
  selectedKeys?: ReadonlySet<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Skeleton rows in place of the body, and the table marked busy. */
  loading?: boolean;
  /** How many skeleton rows. Default 5. */
  loadingRows?: number;
  /** Shown in the body when there are no rows: an EmptyState. */
  empty?: ReactNode;
  /** Alternate rows in slate (the Figma zebra variant). */
  striped?: boolean;
  /** `compact`: 40 px rows, 12 px at the sides and 14/20 text, for a dense table or a slide. Default Figma's 52 px rows. */
  density?: "default" | "compact";
  /** Words for assistive technology, for translation. */
  messages?: Partial<DataTableMessages>;
  /** Classes for the scrolling area: give it a height (max-h-...) to keep the header in view. */
  className?: string;
}

/**
 * The Admin table of the Figma screens, measured: a 12 px frame with a gray 200 edge drawn over
 * its rows, a slate header, 52 px rows on a gray 200 rule, the name in Regular gray 800 and the
 * rest in SemiBold gray 500, and the pink arrow that opens a row, sliding right while the row is
 * hovered. Figma draws the header labels in gray 500 (3.9:1 on slate); they use gray 600, as do
 * the other cells of a row while it is slate (gray 500 reads 4.4:1 there).
 */
export const dataTableVariants = tv({
  slots: {
    // The frame clips the header's corners and draws the edge above everything inside it.
    frame: [
      "relative isolate overflow-hidden rounded-(--table-radius)",
      "after:pointer-events-none after:absolute after:inset-0 after:z-raised after:rounded-(--table-radius) after:inset-ring after:inset-ring-line",
    ],
    scroller: "table-scrollbar relative w-full overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
    table: "w-full border-separate border-spacing-0 text-start",
    // A row's rule is its bottom border, balanced by 1 px at the top: the content stays centred on
    // all 52 px, as under Figma's inside stroke (text at 14, a badge at 17, the arrow at 13).
    headerCell: [
      "sticky top-0 z-raised h-(--table-row-height) border-b border-line bg-surface-header px-(--table-cell-padding-x) pt-px",
      "type-body-lg font-semibold whitespace-nowrap text-fg-muted",
    ],
    sortButton: [
      "-mx-1 inline-flex cursor-pointer items-center gap-2.5 rounded-sm px-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "hover:text-fg-primary",
    ],
    row: "group/row transition-colors duration-fast ease-standard",
    cell: "h-(--table-row-height) border-b border-line px-(--table-cell-padding-x) pt-px type-body-lg",
    subtleCell: "font-semibold text-fg-subtle transition-colors duration-fast ease-standard",
    primaryCell: "text-fg-body",
    // An element in a cell is centred as a box, not set on the text's baseline.
    content: "flex items-center gap-2",
    controlCell: "w-12",
    linkCell: "w-20",
    link: [
      "inline-flex h-(--table-link-height) w-(--table-link-width) items-center justify-center rounded-md text-primary",
      "transition-transform duration-fast ease-standard group-hover/row:translate-x-(--table-link-shift) motion-reduce:transition-none",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
    ],
  },
  variants: {
    striped: { true: { row: "even:bg-surface-zebra", subtleCell: "group-even/row:text-fg-muted" } },
    clickable: { true: { row: "cursor-pointer hover:bg-surface-panel", subtleCell: "group-hover/row:text-fg-muted" } },
    density: {
      default: {},
      compact: {
        // The type role sets its own weight, so the header takes SemiBold again after it.
        headerCell: "h-(--table-row-height-compact) px-(--table-cell-padding-x-compact) type-body font-semibold",
        cell: "h-(--table-row-height-compact) px-(--table-cell-padding-x-compact) type-body",
      },
    },
  },
  defaultVariants: { density: "default" },
});

type Align = NonNullable<DataTableColumn<unknown>["align"]>;

const alignClass: Record<Align, string> = { start: "text-start", center: "text-center", end: "text-end tabular-nums" };
const justifyClass: Record<Align, string> = { start: "justify-start", center: "justify-center", end: "justify-end" };

function alignOf<Row>(column: DataTableColumn<Row>) {
  return alignClass[column.align ?? "start"];
}

function justifyOf<Row>(column: DataTableColumn<Row>) {
  return justifyClass[column.align ?? "start"];
}

/** Text is left to the cell's line box; anything else is wrapped to be centred as a box. */
function isText(content: ReactNode): content is string | number {
  return typeof content === "string" || typeof content === "number";
}

/**
 * The row's interactive parts handle their own clicks; the rest of the row opens its link. Cmd,
 * Ctrl or Shift and the middle button open it in a new tab, as they would on the link: browsers
 * ignore those keys on a click the page makes itself. A click that ends a text selection leaves
 * the row where it is.
 */
function openRowLink(event: MouseEvent<HTMLTableRowElement>) {
  const target = event.target as Element;
  if (target.closest("a, button, input, select, textarea, label, [role='checkbox'], [role='button'], [role='menuitem']")) return;
  if (window.getSelection()?.type === "Range") return;
  const link = event.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]");
  if (!link) return;
  if (event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey) window.open(link.href, "_blank", "noopener");
  else link.click();
}

/** The middle button fires auxclick, not click; the right button keeps its menu. */
function openRowLinkAux(event: MouseEvent<HTMLTableRowElement>) {
  if (event.button === 1) openRowLink(event);
}

function RowLink({ element, href, label }: { element?: ReactElement; href?: string; label: string }) {
  const { link } = dataTableVariants();
  return useRender({
    defaultTagName: "a",
    render: element,
    props: {
      href,
      "aria-label": label,
      "data-row-link": "",
      className: link(),
      children: <Icon icon={ArrowRight} size="sm" />,
    },
  });
}

/**
 * The Admin table. Sorting, paging and loading are driven from outside (the server does them);
 * the header stays in view while the body scrolls, and on a narrow screen the table scrolls
 * sideways inside its frame, never the page.
 */
export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  rowLabel,
  sort,
  onSortChange,
  rowHref,
  rowLink,
  rowActions,
  selectedKeys,
  onSelectionChange,
  loading = false,
  loadingRows = 5,
  empty,
  striped = false,
  density,
  messages: messageOverrides,
  className,
}: DataTableProps<Row>) {
  const messages = { ...defaultMessages, ...messageOverrides };
  const selectable = onSelectionChange !== undefined;
  const linked = rowHref !== undefined || rowLink !== undefined;
  const selected = selectedKeys ?? new Set<string>();
  const pageKeys = rows.map(rowKey);
  const selectedOnPage = pageKeys.filter((key) => selected.has(key)).length;
  const allSelected = pageKeys.length > 0 && selectedOnPage === pageKeys.length;
  const nameOf = (row: Row) => (rowLabel ? rowLabel(row) : rowKey(row));
  const slots = dataTableVariants({ striped, clickable: linked, density });
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overflows = useOverflows(scrollerRef);
  const columnCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0) + (linked ? 1 : 0);
  const cellClass = (column: DataTableColumn<Row>) =>
    slots.cell({ className: cn(alignOf(column), column.primary ? slots.primaryCell() : slots.subtleCell(), column.className) });
  const cellContent = (column: DataTableColumn<Row>, row: Row) => {
    const content = column.cell(row);
    if (content === null || content === undefined || typeof content === "boolean" || isText(content)) return content;
    return <div className={slots.content({ className: justifyOf(column) })}>{content}</div>;
  };

  const toggleAll = (checked: boolean) => {
    const next = new Set(selected);
    for (const key of pageKeys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onSelectionChange?.(next);
  };
  const toggleRow = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectionChange?.(next);
  };

  return (
    <div className={slots.frame()}>
      {/* Says when loading starts; the skeleton rows themselves are hidden from assistive technology. */}
      <p role="status" className="sr-only">
        {loading ? messages.loading : ""}
      </p>
      <div
        ref={scrollerRef}
        className={slots.scroller({ className })}
        {...(overflows ? { tabIndex: 0, role: "region", "aria-label": label } : {})}
      >
        <table aria-label={label} aria-busy={loading || undefined} className={slots.table()}>
          <thead>
            <tr>
              {selectable ? (
                <th scope="col" className={slots.headerCell({ className: slots.controlCell() })}>
                  <div className={slots.content()}>
                    <Checkbox
                      aria-label={messages.selectAll}
                      checked={allSelected}
                      indeterminate={selectedOnPage > 0 && !allSelected}
                      disabled={loading || rows.length === 0}
                      onCheckedChange={(checked) => toggleAll(checked)}
                    />
                  </div>
                </th>
              ) : null}
              {columns.map((column) => {
                const active = sort?.column === column.id;
                const direction = active ? sort.direction : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={column.sortable ? (direction ?? "none") : undefined}
                    style={column.width === undefined ? undefined : { width: column.width }}
                    className={slots.headerCell({ className: cn(alignOf(column), column.className) })}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className={slots.sortButton()}
                        onClick={() =>
                          onSortChange({ column: column.id, direction: active && direction === "ascending" ? "descending" : "ascending" })
                        }
                      >
                        {column.header}
                        <Icon
                          icon={direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowDownUp}
                          size="md"
                          className={active ? "text-fg-primary" : "text-fg-subtle"}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {rowActions ? (
                <th scope="col" className={slots.headerCell()}>
                  <span className="sr-only">{messages.actionsColumn}</span>
                </th>
              ) : null}
              {linked ? (
                <th scope="col" className={slots.headerCell({ className: slots.linkCell() })}>
                  <span className="sr-only">{messages.linkColumn}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: loadingRows }, (_, index) => (
                <tr key={index} className={slots.row()}>
                  {selectable ? <td className={slots.cell({ className: slots.controlCell() })} /> : null}
                  {columns.map((column, cell) => (
                    <td key={column.id} className={slots.cell({ className: column.className })}>
                      <Skeleton shape="text" className={cn(cell % 2 === 0 ? "w-3/5" : "w-2/5", column.align === "end" && "ms-auto")} />
                    </td>
                  ))}
                  {rowActions ? <td className={slots.cell()} /> : null}
                  {linked ? <td className={slots.cell({ className: slots.linkCell() })} /> : null}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className={slots.cell({ className: "h-auto" })}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const isSelected = selected.has(key);
                return (
                  <tr
                    key={key}
                    onClick={linked ? openRowLink : undefined}
                    onAuxClick={linked ? openRowLinkAux : undefined}
                    className={slots.row()}
                  >
                    {selectable ? (
                      <td className={slots.cell({ className: slots.controlCell() })}>
                        <div className={slots.content()}>
                          <Checkbox aria-label={messages.select(nameOf(row))} checked={isSelected} onCheckedChange={(checked) => toggleRow(key, checked)} />
                        </div>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.id} className={cellClass(column)}>
                        {cellContent(column, row)}
                      </td>
                    ))}
                    {rowActions ? (
                      <td className={slots.cell({ className: "whitespace-nowrap" })}>
                        <div className={slots.content({ className: "justify-end" })}>{rowActions(row)}</div>
                      </td>
                    ) : null}
                    {linked ? (
                      <td className={slots.cell({ className: slots.linkCell() })}>
                        <div className={slots.content()}>
                          <RowLink element={rowLink?.(row)} href={rowHref?.(row)} label={messages.open(nameOf(row))} />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
