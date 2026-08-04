import type { ColumnDef } from "@tanstack/react-table";
import { ListChecks, Package, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { CopyChip, EntityCell, IconTile } from "@/components/app/bits";
import { Card } from "@/components/app/card";
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
import { productFieldCrud, useProducts } from "@/lib/api-hooks";
import { money } from "@/lib/format";

/**
 * Decision fields — full CRUD, across every product at once.
 *
 * These rows ARE the form teams fill in each round, and the exact inputs
 * `calcMarketModel` competes and `calcFinancials` prices. They live inside
 * `Product.fields[]`, so each one is addressed as `/products/:id/fields/:fid`
 * and carries the product it belongs to; a field can be renamed and retuned
 * here but never moved between products.
 */

/** What the engine actually branches on — see `calcFinancials.resolveValue`. */
const FIELD_TYPES = [
  { value: "number", label: "Number — a plain quantity" },
  { value: "money", label: "Money — priced per unit" },
  { value: "percentage", label: "Percentage — divided by 100 before use" },
  { value: "enum", label: "Choice — one of a fixed set of options" },
];

export default function ProductFieldsPage() {
  const { data: products = [], isLoading, isError, refetch } = useProducts();

  const crud = useResourceCrud<any>();
  const create = productFieldCrud.useCreate();
  const update = productFieldCrud.useUpdate();
  const remove = productFieldCrud.useDelete();

  const rows = React.useMemo(
    () =>
      products.flatMap((p: any) =>
        (p.fields ?? []).map((f: any) => ({
          // Fields are only unique within a product, so the row key carries both.
          _id: `${p._id}-${f._id}`,
          productId: p._id,
          fieldId: f._id,
          productName: p.productName,
          label: f.label,
          key: f.key,
          type: f.type,
          order: f.order ?? 0,
          required: f.required,
          minValue: f.minValue,
          maxValue: f.maxValue,
          direction: f.direction ?? 1,
          tightening: f.tightening ?? 3,
          unitCost: f.unitCost,
          options: f.options ?? {},
          coefficients: f.coefficients ?? {},
          coefficientCount: Object.keys(f.coefficients ?? {}).length,
        }))
      ),
    [products]
  );

  const productName = React.useCallback(
    (id: string) => products.find((p: any) => p._id === id)?.productName ?? "Unknown product",
    [products]
  );

  const fields = React.useMemo<FormField[]>(
    () => [
      {
        key: "productId",
        label: "Product",
        kind: "select",
        required: true,
        // A field is stored inside its product's document; there is no route
        // that moves one, so this is set once at creation.
        immutable: true,
        options: products.map((p: any) => ({ value: p._id, label: p.productName })),
        help: "Which decision form this appears on. Can't be changed later.",
        wide: true,
      },
      {
        key: "label",
        label: "Label",
        required: true,
        placeholder: "Selling price",
        help: "What a team reads on the form.",
      },
      {
        key: "key",
        label: "Key",
        required: true,
        immutable: true,
        placeholder: "selling_price",
        help: "The engine's name for this input. Fixed after creation — decisions already submitted point at it.",
      },
      {
        key: "type",
        label: "Type",
        kind: "select",
        required: true,
        options: FIELD_TYPES,
        help: "How the engine reads the value.",
        wide: true,
      },
      {
        key: "minValue",
        label: "Minimum",
        kind: "number",
        help: "Values below this are clamped up, not rejected.",
      },
      {
        key: "maxValue",
        label: "Maximum",
        kind: "number",
        help: "Values above this are clamped down.",
      },
      {
        key: "unitCost",
        label: "Unit cost",
        kind: "money",
        help: "Money fields only. What each unit costs the team, which is what makes this a cost rather than a price.",
      },
      {
        key: "order",
        label: "Order",
        kind: "number",
        help: "Position on the decision form. Lower shows first.",
      },
      {
        key: "direction",
        label: "Competitive weight",
        kind: "number",
        min: 0,
        max: 1,
        step: 0.1,
        help: "How hard this field separates teams: 1 scores higher values better, 0 makes it score the same for everyone.",
      },
      {
        key: "tightening",
        label: "Tightening",
        kind: "number",
        help: "Divides the spread before scoring. Higher means small differences between teams matter more.",
      },
      {
        key: "required",
        label: "Teams must answer",
        kind: "switch",
        help: "Blocks submission until this field has a value.",
      },
      {
        key: "options",
        label: "Choices",
        kind: "json",
        placeholder: '{ "Standard": 1, "Premium": 1.4 }',
        help: 'Choice fields only. Each label maps to the number the engine uses in its place.',
      },
      {
        key: "coefficients",
        label: "Coefficients",
        kind: "json",
        placeholder: '{ "segmentId": 0.8 }',
        help: "Per-segment multipliers applied on top of the value. Leave as {} if this field weighs the same everywhere.",
      },
    ],
    [products]
  );

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        // Grouping keys off the column id, so the product column has to be
        // `productId` — passing the row's field name alone groups nothing.
        id: "productId",
        header: "Product",
        accessorFn: (r) => r.productId,
        cell: () => null,
      },
      {
        accessorKey: "label",
        header: "Field",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<ListChecks />} tone="neutral" />}
            primary={row.original.label}
            secondary={<CopyChip value={row.original.key} />}
          />
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 110,
        cell: ({ row }) => (
          <Badge tone="navy" size="sm">
            {row.original.type}
          </Badge>
        ),
      },
      {
        id: "range",
        header: "Range",
        size: 130,
        accessorFn: (r) => r.minValue ?? 0,
        cell: ({ row }) => {
          const { minValue, maxValue } = row.original;
          return (
            <span className="text-[13px] tnum text-body">
              {minValue == null && maxValue == null
                ? "—"
                : `${minValue ?? "−∞"} – ${maxValue ?? "∞"}`}
            </span>
          );
        },
      },
      {
        accessorKey: "unitCost",
        header: "Unit cost",
        size: 120,
        cell: ({ row }) => (
          <span className="text-[13px] tnum text-body">
            {row.original.unitCost != null ? money(row.original.unitCost) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "direction",
        header: "Weight",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[13px] tnum text-body">{row.original.direction}</span>
        ),
      },
      {
        accessorKey: "coefficientCount",
        header: "Coefficients",
        size: 120,
        cell: ({ row }) => <Badge tone="count">{row.original.coefficientCount}</Badge>,
      },
      {
        id: "actions",
        header: "",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton label="Edit field" onClick={() => crud.openEdit(row.original)}>
              <Pencil />
            </IconButton>
            <IconButton label="Delete field" onClick={() => crud.openDelete(row.original)}>
              <Trash2 />
            </IconButton>
          </div>
        ),
      },
    ],
    [crud]
  );

  const editing = crud.editing;

  if (!isLoading && products.length === 0) {
    return (
      <>
        <PageHeader
          title="Decision fields"
          subtitle="The inputs teams fill in each round."
        />
        <Card padded={false}>
          <EmptyState
            icon={<Package />}
            title="No products to add fields to"
            hint="A decision field lives inside a product. Create a product first, then come back and give it the inputs teams answer."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Decision fields"
        count={rows.length}
        subtitle="Every input teams answer, across all products. These are exactly what the market model competes and the financials price."
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search fields…"
        groupBy="productId"
        groupLabel={(k) => <span>{productName(k)}</span>}
        toolbarExtra={
          <Button size="sm" onClick={crud.openCreate}>
            <Plus /> New field
          </Button>
        }
        empty={
          <EmptyState
            icon={<ListChecks />}
            title="No decision fields yet"
            hint="Without fields, a team's decision form is empty and there is nothing for the engine to score."
            action={
              <Button onClick={crud.openCreate}>
                <Plus /> New field
              </Button>
            }
          />
        }
      />

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New decision field"
        description="Teams answer this every round from the moment it exists — adding one mid-simulation changes the form under them."
        fields={fields}
        submitting={create.isPending}
        onSubmit={({ productId, ...data }) =>
          create.mutateAsync({ productId, data })
        }
      />

      <ResourceFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && crud.setEditing(null)}
        title={`Edit ${editing?.label ?? "field"}`}
        description={editing ? `On ${editing.productName}.` : undefined}
        fields={fields}
        initial={editing}
        submitting={update.isPending}
        onSubmit={(data) =>
          update.mutateAsync({
            productId: editing.productId,
            fieldId: editing.fieldId,
            data,
          })
        }
      />

      <DeleteResourceDialog
        row={crud.deleting}
        onOpenChange={(v) => !v && crud.setDeleting(null)}
        label="field"
        name={crud.deleting?.label}
        loading={remove.isPending}
        consequence="Decisions already submitted keep a value for it that nothing will read again, and any round scored on this field keeps results that can't be explained from the form."
        onConfirm={() =>
          remove.mutateAsync({
            productId: crud.deleting.productId,
            fieldId: crud.deleting.fieldId,
          })
        }
      />
    </>
  );
}
