import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import * as React from "react";
import { CopyChip, EntityCell, IconTile } from "@/components/app/bits";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import {
  DeleteResourceDialog,
  ResourceFormDialog,
  useResourceCrud,
  type FormField,
} from "@/components/app/resource-form";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { simulationTypeCrud, useSimulationTypes } from "@/lib/api-hooks";
import { relativeTime } from "@/lib/format";

const FIELDS: FormField[] = [
  {
    key: "name",
    label: "Name",
    required: true,
    placeholder: "Notebook Business Sim",
    help: "How this game appears everywhere in the console.",
  },
  {
    key: "brandName",
    label: "Brand name",
    placeholder: "Int Labs",
    help: "Shown to players if the game is white-labelled for a client.",
  },
  {
    key: "description",
    label: "Description",
    kind: "textarea",
    placeholder: "A 90-day notebook business across three phases.",
    help: "What this game teaches. For facilitators, not players.",
  },
];

export default function SimulationTypesPage() {
  const { data = [], isLoading, isError, refetch } = useSimulationTypes();

  const crud = useResourceCrud<any>();
  const create = simulationTypeCrud.useCreate();
  const update = simulationTypeCrud.useUpdate();
  const remove = simulationTypeCrud.useDelete();

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Type",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<Shapes />} tone="navy" />}
            primary={row.original.name}
            secondary={row.original.brandName ?? <CopyChip value={row.original._id} />}
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
        id: "years",
        header: "Year range",
        size: 130,
        accessorFn: (r) => r.yearRange?.start ?? 0,
        cell: ({ row }) => {
          const y = row.original.yearRange;
          return (
            <span className="text-[13px] font-semibold tnum text-foreground">
              {y ? `${y.start} – ${y.end}` : "—"}
            </span>
          );
        },
      },
      {
        id: "outputs",
        header: "Outputs",
        size: 110,
        accessorFn: (r) => r.outputs?.length ?? 0,
        cell: ({ row }) => <Badge tone="count">{row.original.outputs?.length ?? 0}</Badge>,
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
            <IconButton label="Edit type" onClick={() => crud.openEdit(row.original)}>
              <Pencil />
            </IconButton>
            <IconButton label="Delete type" onClick={() => crud.openDelete(row.original)}>
              <Trash2 />
            </IconButton>
          </div>
        ),
      },
    ],
    [crud]
  );

  const editing = crud.editing;

  return (
    <>
      <PageHeader
        title="Simulation types"
        count={data.length}
        subtitle="The template layer. A type carries its market model, products, segments and output definitions."
      />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search types…"
        toolbarExtra={
          <Button size="sm" onClick={crud.openCreate}>
            <Plus /> New type
          </Button>
        }
        empty={
          <EmptyState
            icon={<Shapes />}
            title="No simulation types yet"
            hint="A type is the reusable game definition every simulation instance is built from."
            action={
              <Button onClick={crud.openCreate}>
                <Plus /> New type
              </Button>
            }
          />
        }
      />

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New simulation type"
        description="A reusable game definition. You add its products, segments and base data afterwards."
        fields={FIELDS}
        submitting={create.isPending}
        onSubmit={(values) => create.mutateAsync(values)}
      />

      <ResourceFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && crud.setEditing(null)}
        title={`Edit ${editing?.name ?? "type"}`}
        fields={FIELDS}
        initial={editing}
        submitting={update.isPending}
        onSubmit={(values) =>
          update.mutateAsync({ id: editing._id, data: values })
        }
      />

      <DeleteResourceDialog
        row={crud.deleting}
        onOpenChange={(v) => !v && crud.setDeleting(null)}
        label="type"
        name={crud.deleting?.name}
        loading={remove.isPending}
        consequence="Every product, segment, base-data document and published game content belonging to this type is orphaned, and simulations built from it lose their template."
        onConfirm={() => remove.mutateAsync(crud.deleting._id)}
      />
    </>
  );
}
