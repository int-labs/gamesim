import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type GroupingState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Search,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";
import { Card } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Checkbox, Skeleton } from "@/components/ui/primitives";
import { useHotkey } from "@/hooks/use-hotkey";
import { DUR, EASE, SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type BulkAction = {
  label: string;
  icon?: React.ReactNode;
  onClick: (ids: string[]) => void;
  destructive?: boolean;
};

export function DataTable<T extends { _id?: string }>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  empty,
  searchPlaceholder = "Search…",
  toolbarExtra,
  groupBy,
  groupLabel,
  bulkActions,
  onRowClick,
  initialSorting,
  pageSize: initialPageSize = 20,
}: {
  columns: ColumnDef<T, any>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  empty: React.ReactNode;
  searchPlaceholder?: string;
  toolbarExtra?: React.ReactNode;
  groupBy?: string;
  groupLabel?: (key: string) => React.ReactNode;
  bulkActions?: BulkAction[];
  onRowClick?: (row: T) => void;
  initialSorting?: SortingState;
  pageSize?: number;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? []);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [grouping] = React.useState<GroupingState>(groupBy ? [groupBy] : []);
  const searchRef = React.useRef<HTMLInputElement>(null);

  useHotkey("/", () => searchRef.current?.focus());

  const selectionColumn = React.useMemo<ColumnDef<T, any>>(
    () => ({
      id: "__select",
      size: 40,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
    }),
    []
  );

  const allColumns = React.useMemo(
    () => (bulkActions?.length ? [selectionColumn, ...columns] : columns),
    [bulkActions, columns, selectionColumn]
  );

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      grouping,
      // The column being grouped by is the band header; rendering it as a
      // column too would repeat the same value down every row.
      columnVisibility: groupBy ? { [groupBy]: false } : {},
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (row, i) => (row as any)._id ?? String(i),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    // Without the expanded row model, grouped sub-rows never render.
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: initialPageSize },
      // Bands open by default — a collapsed table looks empty.
      expanded: true,
    },
    autoResetPageIndex: false,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="space-y-4">
      {/* O5 TableToolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[280px]">
          <Input
            ref={searchRef}
            inputSize="sm"
            icon={<Search />}
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            onClear={() => setGlobalFilter("")}
          />
        </div>
        {toolbarExtra}
        <div className="ml-auto flex items-center gap-2">
          {globalFilter && (
            <Badge tone="count">
              {total} match{total === 1 ? "" : "es"}
            </Badge>
          )}
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border bg-muted">
                  {hg.headers.map((header) => {
                    const sortable = header.column.getCanSort();
                    const dir = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        aria-sort={
                          dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
                        }
                        className="px-4 py-2.5 text-left"
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="eyebrow inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {dir === "asc" ? (
                              <ChevronDown className="size-3 rotate-180" />
                            ) : dir === "desc" ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          <span className="eyebrow text-muted-foreground">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody>
              {isLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                    {allColumns.map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <Skeleton className={cn("h-4", j === 0 ? "w-32" : "w-20")} />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading && isError && (
                <tr>
                  <td colSpan={allColumns.length}>
                    <div className="flex flex-col items-center gap-3 py-14 text-center">
                      <p className="text-[14px] font-semibold text-foreground">Couldn't load this</p>
                      <p className="max-w-[320px] text-[13px] text-muted-foreground">
                        The request failed. The API may be unreachable.
                      </p>
                      {onRetry && (
                        <Button variant="outline" onClick={onRetry}>
                          Try again
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={allColumns.length}>{empty}</td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                rows.map((row, i) => {
                  if (row.getIsGrouped()) {
                    return (
                      <tr key={row.id} className="border-b border-border bg-muted/60">
                        <td colSpan={allColumns.length} className="px-4 py-2">
                          <button
                            type="button"
                            onClick={row.getToggleExpandedHandler()}
                            className="inline-flex items-center gap-2 text-[12px] font-semibold text-foreground"
                          >
                            {row.getIsExpanded() ? (
                              <ChevronDown className="size-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            )}
                            {groupLabel ? groupLabel(String(row.groupingValue)) : String(row.groupingValue)}
                            <Badge tone="count" size="sm">
                              {row.subRows.length}
                            </Badge>
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: DUR.base,
                        ease: EASE.out,
                        delay: Math.min(i, 12) * 0.02,
                      }}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      className={cn(
                        "border-b border-border transition-colors duration-100 last:border-0",
                        row.getIsSelected() ? "bg-accent/50" : "hover:bg-muted",
                        onRowClick && "cursor-pointer"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* M9 PaginationFooter */}
        {!isLoading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-[12px] tnum text-muted-foreground">
              <NumberFlow value={from} />–<NumberFlow value={to} /> of <NumberFlow value={total} />
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => table.setPageSize(Number(v))}
              >
                <SelectTrigger size="sm" className="h-8 w-[76px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="iconSm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="iconSm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* M16 BulkActionBar — doubles as the aria-live selection announcer */}
      <AnimatePresence>
        {bulkActions && selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0 }}
            transition={SPRING.smooth}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
          >
            <div
              role="status"
              aria-live="polite"
              className="flex h-13 items-center gap-1 rounded-full bg-navy-900 px-2 py-2 shadow-modal"
            >
              <span className="px-3 text-[13px] font-semibold text-white tnum">
                Selected · <NumberFlow value={selectedIds.length} />
              </span>
              <span className="h-6 w-px bg-white/15" />
              {bulkActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => action.onClick(selectedIds)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition-colors [&_svg]:size-4",
                    action.destructive
                      ? "text-[color:var(--destructive)] hover:bg-destructive-tint/20"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
              <span className="h-6 w-px bg-white/15" />
              <button
                type="button"
                onClick={() => setRowSelection({})}
                aria-label="Clear selection"
                className="flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const trashIcon = <Trash2 />;
