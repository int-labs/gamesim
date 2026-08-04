import type { ColumnDef } from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { CopyChip, EntityCell, IconTile } from "@/components/app/bits";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { useParamLists } from "@/lib/api-hooks";
import { relativeTime } from "@/lib/format";

export default function ParamListPage() {
  const { data = [], isLoading, isError, refetch } = useParamLists();

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        id: "name",
        header: "Parameter",
        accessorFn: (r) => r.name ?? r.key ?? r._id,
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<SlidersHorizontal />} tone="neutral" />}
            primary={row.original.name ?? row.original.key ?? "Unnamed"}
            secondary={<CopyChip value={row.original._id} />}
          />
        ),
      },
      {
        id: "value",
        header: "Value",
        accessorFn: (r) => String(r.value ?? ""),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[420px] font-mono text-[12px] text-body">
            {typeof row.original.value === "object"
              ? JSON.stringify(row.original.value)
              : String(row.original.value ?? "—")}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">{relativeTime(row.original.updatedAt)}</span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Param list"
        count={data.length}
        subtitle="Read-only. Tunable values the engine reads that aren't tied to a product or segment — the API exposes no way to write them, so they change in the seed data and ship with a deploy."
      />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search parameters…"
        empty={
          <EmptyState
            icon={<SlidersHorizontal />}
            title="No parameters yet"
            hint="Nothing seeded yet. These arrive with the simulation type's seed data rather than being created here."
          />
        }
      />
    </>
  );
}
