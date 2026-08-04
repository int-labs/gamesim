import type { ColumnDef } from "@tanstack/react-table";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
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
  productCrud,
  useActiveSimulationTypeId,
  useProducts,
  useSegments,
} from "@/lib/api-hooks";

/**
 * Products — full CRUD.
 *
 * A product's `fields[]` ARE the decision form teams fill in, so this page is
 * where a facilitator shapes what players are asked. It had become a read-only
 * table, which made the whole authoring half of the console unusable.
 */
export default function ProductsPage() {
  const { data = [], isLoading, isError, refetch } = useProducts();
  const { data: segments = [] } = useSegments();
  const typeId = useActiveSimulationTypeId();

  const crud = useResourceCrud<any>();
  const create = productCrud.useCreate();
  const update = productCrud.useUpdate();
  const remove = productCrud.useDelete();

  const segmentName = React.useCallback(
    (id: string) => segments.find((s: any) => s._id === id)?.name ?? "Unassigned",
    [segments]
  );

  const fields = React.useMemo<FormField[]>(
    () => [
      {
        key: "productName",
        label: "Name",
        required: true,
        placeholder: "Student Notebook",
        help: "What teams see on their decision form.",
      },
      {
        key: "productType",
        label: "Type",
        placeholder: "notebook",
        help: "A free label for grouping. The scoring model ignores it.",
      },
      {
        key: "segmentId",
        label: "Segment",
        kind: "select",
        required: true,
        options: segments.map((s: any) => ({ value: s._id, label: s.name })),
        help: "Which audience this competes for. A product can only sell into an active segment.",
        wide: true,
      },
      {
        key: "active",
        label: "Available to teams",
        kind: "switch",
        help: "Turn off to retire a product without deleting decisions that reference it.",
      },
    ],
    [segments]
  );

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Product",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<Package />} tone="success" />}
            primary={row.original.productName}
            secondary={row.original.productType ?? <CopyChip value={row.original._id} />}
          />
        ),
      },
      {
        id: "fields",
        header: "Decision fields",
        size: 150,
        accessorFn: (r) => r.fields?.length ?? 0,
        cell: ({ row }) => <Badge tone="count">{row.original.fields?.length ?? 0}</Badge>,
      },
      {
        id: "market",
        header: "Available market",
        size: 170,
        accessorFn: (r) => r.baseVariables?.availableMarket ?? 0,
        cell: ({ row }) => (
          <span className="text-[13px] font-semibold tnum text-foreground">
            {row.original.baseVariables?.availableMarket != null
              ? new Intl.NumberFormat("en-US").format(row.original.baseVariables.availableMarket)
              : "—"}
          </span>
        ),
      },
      {
        // Must match `groupBy` — TanStack groups by column id, not row key.
        id: "segmentId",
        header: "Segment",
        size: 180,
        accessorFn: (r) => segmentName(r.segmentId),
        cell: ({ row }) => (
          <Badge tone="navy" size="sm">
            {segmentName(row.original.segmentId)}
          </Badge>
        ),
      },
      {
        accessorKey: "active",
        header: "State",
        size: 110,
        cell: ({ row }) => <ActiveChip active={row.original.active} />,
      },
      {
        id: "actions",
        header: "",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton label="Edit product" onClick={() => crud.openEdit(row.original)}>
              <Pencil />
            </IconButton>
            <IconButton label="Delete product" onClick={() => crud.openDelete(row.original)}>
              <Trash2 />
            </IconButton>
          </div>
        ),
      },
    ],
    [segmentName, crud]
  );

  const editing = crud.editing;

  return (
    <>
      <PageHeader
        title="Products"
        count={data.length}
        subtitle="Each product's fields are the decision form teams fill in — and the inputs the market model scores."
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search products…"
        groupBy="segmentId"
        groupLabel={(k) => <span>{segmentName(k)}</span>}
        // Search and the primary action share one toolbar row, rather than
        // sitting in two separate bands stacked above the table.
        toolbarExtra={
          <Button size="sm" onClick={crud.openCreate} disabled={!typeId}>
            <Plus /> New product
          </Button>
        }
        empty={
          <EmptyState
            icon={<Package />}
            title="No products yet"
            hint="Products carry the decision fields teams compete on. They belong to a simulation type and segment."
            action={
              <Button onClick={crud.openCreate} disabled={!typeId}>
                <Plus /> New product
              </Button>
            }
          />
        }
      />

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New product"
        description="Teams see this on their decision form for every round it stays active."
        fields={fields}
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutateAsync({ ...values, simulationTypeId: typeId, active: values.active ?? true })
        }
      />

      <ResourceFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && crud.setEditing(null)}
        title={`Edit ${editing?.productName ?? "product"}`}
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
        label="product"
        name={crud.deleting?.productName}
        loading={remove.isPending}
        consequence="Its decision fields go with it, and any round already scored against this product keeps results that no longer have a product to point at."
        onConfirm={() => remove.mutateAsync(crud.deleting._id)}
      />
    </>
  );
}
