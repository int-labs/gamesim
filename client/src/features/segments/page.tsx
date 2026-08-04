import type { ColumnDef } from "@tanstack/react-table";
import { ChartPie, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { ActiveChip, CopyChip, EntityCell, IconTile } from "@/components/app/bits";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import {
  DeleteResourceDialog,
  ResourceFormDialog,
  useResourceCrud,
  type FormField,
} from "@/components/app/resource-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  segmentCrud,
  useActiveSimulationTypeId,
  useSegments,
  useSimulationTypes,
} from "@/lib/api-hooks";
import { relativeTime } from "@/lib/format";

export default function SegmentsPage() {
  const { data = [], isLoading, isError, refetch } = useSegments();
  const { data: types = [] } = useSimulationTypes();
  const typeId = useActiveSimulationTypeId();

  const crud = useResourceCrud<any>();
  const create = segmentCrud.useCreate();
  const update = segmentCrud.useUpdate();
  const remove = segmentCrud.useDelete();

  const fields = React.useMemo<FormField[]>(
    () => [
      {
        key: "name",
        label: "Name",
        required: true,
        placeholder: "Students",
        help: "The audience as a facilitator would say it out loud.",
      },
      {
        key: "description",
        label: "Description",
        kind: "textarea",
        placeholder: "Budget-conscious note-takers who buy in volume.",
        help: "Shown alongside the segment when someone is deciding who to sell to.",
      },
      {
        key: "active",
        label: "In play",
        kind: "switch",
        help: "A product can only sell into an active segment, so turning this off takes its products off the board too.",
      },
    ],
    []
  );

  const typeName = React.useCallback(
    (id: string) => types.find((t: any) => t._id === id)?.name ?? "—",
    [types]
  );

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Segment",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<ChartPie />} tone="gold" />}
            primary={row.original.name}
            secondary={<CopyChip value={row.original._id} label={row.original.key} />}
          />
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[420px] text-[13px] text-body">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        id: "type",
        header: "Simulation type",
        size: 180,
        accessorFn: (r) => typeName(r.simulationTypeId),
        cell: ({ row }) => (
          <Badge tone="navy" size="sm">
            {typeName(row.original.simulationTypeId)}
          </Badge>
        ),
      },
      {
        accessorKey: "active",
        header: "State",
        size: 120,
        cell: ({ row }) => <ActiveChip active={row.original.active} />,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton label="Edit segment" onClick={() => crud.openEdit(row.original)}>
              <Pencil />
            </IconButton>
            <IconButton label="Delete segment" onClick={() => crud.openDelete(row.original)}>
              <Trash2 />
            </IconButton>
          </div>
        ),
      },
    ],
    [typeName, crud]
  );

  const editing = crud.editing;

  return (
    <>
      <PageHeader
        title="Segments"
        count={data.length}
        subtitle="Customer segments a simulation type competes across. Products and market sizes hang off these."
      />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search segments…"
        toolbarExtra={
          <Button size="sm" onClick={crud.openCreate} disabled={!typeId}>
            <Plus /> New segment
          </Button>
        }
        empty={
          <EmptyState
            icon={<ChartPie />}
            title="No segments yet"
            hint="Segments define who the products are sold to. They're created per simulation type."
            action={
              <Button onClick={crud.openCreate} disabled={!typeId}>
                <Plus /> New segment
              </Button>
            }
          />
        }
      />

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New segment"
        description="An audience the products in this simulation type compete for."
        fields={fields}
        submitting={create.isPending}
        onSubmit={(values) =>
          create
            .mutateAsync({ ...values, simulationTypeId: typeId, active: values.active ?? true })
            
        }
      />

      <ResourceFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && crud.setEditing(null)}
        title={`Edit ${editing?.name ?? "segment"}`}
        fields={fields}
        initial={editing}
        submitting={update.isPending}
        onSubmit={(values) =>
          update.mutateAsync({ id: editing._id, data: values })
        }
      />

      <DeleteResourceDialog
        row={crud.deleting}
        onOpenChange={(v) => !v && crud.setDeleting(null)}
        label="segment"
        name={crud.deleting?.name}
        loading={remove.isPending}
        consequence="Products pointing at this segment lose the audience they were competing for, and the market sizes recorded against it in base data no longer resolve."
        onConfirm={() => remove.mutateAsync(crud.deleting._id)}
      />
    </>
  );
}
