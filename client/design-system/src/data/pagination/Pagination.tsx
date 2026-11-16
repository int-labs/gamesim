import { ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { useId } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { Select } from "../../primitives/select/Select";
import { pageItems } from "./pages";

/**
 * The Preline pagination of the Figma table footer, measured: "Rows per page:" and its slate chip
 * at the left; at the right, 38 px items with no gap between them, SemiBold 16/24 gray 500,
 * chevrons in gray 600, the current page on a slate square with 8 px corners. Gray 500 reads
 * 3.9:1 on that square and 4.4:1 on the hover, so the current and hovered pages take gray 600.
 * On a phone, Previous and Next keep only their chevrons.
 */
export const paginationVariants = tv({
  slots: {
    root: "flex flex-wrap items-center gap-4",
    rowsPerPage: "flex items-center",
    rowsPerPageLabel: "px-(--pagination-padding-x) type-body-lg font-semibold text-fg-subtle",
    rowsPerPageSelect: "w-auto",
    nav: "ms-auto flex",
    list: "flex flex-wrap items-center",
    step: [
      "inline-flex h-(--pagination-item-size) cursor-pointer items-center gap-2 rounded-(--pagination-radius) px-(--pagination-padding-x)",
      "type-body-lg font-semibold text-fg-subtle transition-colors duration-fast ease-standard",
      "not-disabled:hover:bg-surface-panel not-disabled:hover:text-fg-muted",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
    ],
    stepLabel: "max-sm:sr-only",
    chevron: "text-fg-muted",
    page: [
      "inline-flex size-(--pagination-item-size) cursor-pointer items-center justify-center rounded-(--pagination-radius)",
      "type-body-lg font-semibold text-fg-subtle tabular-nums transition-colors duration-fast ease-standard",
      "hover:bg-surface-panel hover:text-fg-muted",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "aria-[current=page]:bg-surface-header aria-[current=page]:text-fg-muted",
    ],
    gap: "inline-flex size-(--pagination-item-size) items-center justify-center text-fg-subtle",
  },
});

export interface PaginationMessages {
  /** Names the navigation landmark. Default "Pagination". */
  label: string;
  previous: string;
  next: string;
  /** Names a page button. Default "Page {n}". */
  page: (page: number) => string;
  /** Labels the rows-per-page choice. Default "Rows per page:". */
  rowsPerPage: string;
}

const defaultMessages: PaginationMessages = {
  label: "Pagination",
  previous: "Previous",
  next: "Next",
  page: (page) => `Page ${page}`,
  rowsPerPage: "Rows per page:",
};

const defaultRowsPerPageOptions: readonly number[] = [10, 25, 50];

export interface PaginationProps {
  /** The current page, from 1. */
  page: number;
  pageCount: number;
  /** Paging happens on the server: the pagination reports the page asked for. */
  onPageChange: (page: number) => void;
  /** Rows per page, chosen at the left as in the Figma table footer; leave it out to show the pages alone. */
  rowsPerPage?: number;
  /** The choices. Default 10, 25 and 50. */
  rowsPerPageOptions?: readonly number[];
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  /** Words, for translation. */
  messages?: Partial<PaginationMessages>;
  className?: string;
}

/** The table footer: rows per page, then Previous, the pages around the current one, Next. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  rowsPerPage,
  rowsPerPageOptions = defaultRowsPerPageOptions,
  onRowsPerPageChange,
  messages: messageOverrides,
  className,
}: PaginationProps) {
  const messages = { ...defaultMessages, ...messageOverrides };
  const slots = paginationVariants();
  const rowsPerPageLabelId = useId();
  const go = (next: number) => {
    if (next >= 1 && next <= pageCount && next !== page) onPageChange(next);
  };
  // The current choice is always one of the options, even when the app offers another.
  const choices =
    rowsPerPage === undefined || rowsPerPageOptions.includes(rowsPerPage)
      ? rowsPerPageOptions
      : [...rowsPerPageOptions, rowsPerPage].sort((a, b) => a - b);
  return (
    <div className={slots.root({ className })}>
      {rowsPerPage !== undefined ? (
        <div className={slots.rowsPerPage()}>
          <span id={rowsPerPageLabelId} className={slots.rowsPerPageLabel()}>
            {messages.rowsPerPage}
          </span>
          <Select
            aria-labelledby={rowsPerPageLabelId}
            variant="filled"
            size="sm"
            options={choices.map((choice) => ({ value: String(choice), label: String(choice) }))}
            value={String(rowsPerPage)}
            onValueChange={(next) => {
              if (next !== null) onRowsPerPageChange?.(Number(next));
            }}
            className={slots.rowsPerPageSelect()}
          />
        </div>
      ) : null}
      <nav aria-label={messages.label} className={slots.nav()}>
        <ul className={slots.list()}>
          <li>
            <button type="button" className={slots.step()} disabled={page <= 1} onClick={() => go(page - 1)}>
              <Icon icon={ChevronLeft} size="md" className={slots.chevron()} />
              <span className={slots.stepLabel()}>{messages.previous}</span>
            </button>
          </li>
          {pageItems(page, pageCount).map((item, index) =>
            item === "gap" ? (
              <li key={`gap-${index}`} aria-hidden className={slots.gap()}>
                <Icon icon={Ellipsis} size="md" />
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  aria-label={messages.page(item)}
                  aria-current={item === page ? "page" : undefined}
                  className={slots.page()}
                  onClick={() => go(item)}
                >
                  {item}
                </button>
              </li>
            ),
          )}
          <li>
            <button type="button" className={slots.step()} disabled={page >= pageCount} onClick={() => go(page + 1)}>
              <span className={slots.stepLabel()}>{messages.next}</span>
              <Icon icon={ChevronRight} size="md" className={slots.chevron()} />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
