import type { ColumnDef } from "@tanstack/react-table";
import { Gauge, Package, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { EntityCell, IconTile, Sparkline } from "@/components/app/bits";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { driverCrud, useDrivers, useProducts } from "@/lib/api-hooks";

/**
 * Drivers — full CRUD.
 *
 * A driver is `{ productId, years }` and nothing else: a year-by-year series
 * the engine reads while calculating. The page used to render `name` and `key`
 * columns that the model has never had, so every row read "Unnamed driver".
 *
 * The model puts a UNIQUE index on productId, so a product has at most one.
 * That is why the product isn't a form field — it comes from the picker above
 * the table, and Create is disabled once the selected product has its driver.
 *
 * `/drivers` 400s without a productId, so that picker is load-bearing: it is
 * the query, not a filter over an already-fetched list.
 */
export default function DriversPage() {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const [productId, setProductId] = React.useState<string>("");

  React.useEffect(() => {
    if (!productId && products.length) setProductId(products[0]._id);
  }, [products, productId]);

  const { data = [], isLoading, isError, refetch } = useDrivers(productId || undefined);

  const crud = useResourceCrud<any>();
  const create = driverCrud.useCreate();
  const update = driverCrud.useUpdate();
  const remove = driverCrud.useDelete();

  const productName = React.useCallback(
    (id: string) => products.find((p: any) => p._id === id)?.productName ?? "Unknown product",
    [products]
  );

  const fields = React.useMemo<FormField[]>(
    () => [
      {
        key: "years",
        label: "Values by year",
        kind: "json",
        required: true,
        placeholder: '{\n  "2024": 1,\n  "2025": 1.15,\n  "2026": 1.3\n}',
        help: "One number per year. The engine reads the year it is calculating and ignores the rest.",
      },
    ],
    []
  );

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        id: "driver",
        header: "Driver",
        accessorFn: (r) => productName(r.productId),
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<Gauge />} tone="gold" />}
            primary={productName(row.original.productId)}
            secondary={`${Object.keys(row.original.years ?? {}).length} years`}
          />
        ),
      },
      {
        id: "years",
        header: "Years",
        size: 100,
        accessorFn: (r) => Object.keys(r.years ?? {}).length,
        cell: ({ row }) => (
          <Badge tone="count">{Object.keys(row.original.years ?? {}).length}</Badge>
        ),
      },
      {
        id: "span",
        header: "Span",
        size: 140,
        accessorFn: (r) => Object.keys(r.years ?? {}).sort()[0] ?? "",
        cell: ({ row }) => {
          const keys = Object.keys(row.original.years ?? {}).sort();
          return (
            <span className="text-[13px] tnum text-body">
              {keys.length ? `${keys[0]} – ${keys[keys.length - 1]}` : "—"}
            </span>
          );
        },
      },
      {
        id: "trend",
        header: "Trend",
        size: 150,
        enableSorting: false,
        cell: ({ row }) => {
          const record = row.original.years ?? {};
          const series = Object.keys(record)
            .sort()
            .map((k) => Number(record[k]) || 0);
          return series.length > 1 ? (
            <Sparkline data={series} />
          ) : (
            <span className="text-[13px] text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton label="Edit driver" onClick={() => crud.openEdit(row.original)}>
              <Pencil />
            </IconButton>
            <IconButton label="Delete driver" onClick={() => crud.openDelete(row.original)}>
              <Trash2 />
            </IconButton>
          </div>
        ),
      },
    ],
    [crud, productName]
  );

  const editing = crud.editing;

  if (!productsLoading && products.length === 0) {
    return (
      <>
        <PageHeader title="Drivers" subtitle="Per-product values that shape the market over a run." />
        <Card padded={false}>
          <EmptyState
            icon={<Package />}
            title="No products to attach a driver to"
            hint="Drivers hang off products. Add a product to the active simulation type first."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Drivers"
        count={data.length}
        subtitle="A year-by-year series per product. The engine reads the year it is calculating, so a driver is how a product's market moves across a run."
      />

      <div className="mb-4 w-[280px]">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Pick a product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p: any) => (
              <SelectItem key={p._id} value={p._id}>
                {p.productName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading || productsLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search drivers…"
        toolbarExtra={
          <Button size="sm" onClick={crud.openCreate} disabled={!productId || data.length > 0}>
            <Plus /> New driver
          </Button>
        }
        empty={
          <EmptyState
            icon={<Gauge />}
            title="No driver for this product"
            hint="Without one, this product's market stays flat for the whole run."
            action={
              <Button onClick={crud.openCreate} disabled={!productId}>
                <Plus /> New driver
              </Button>
            }
          />
        }
      />

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New driver"
        description={`For ${productName(productId)}. One per product — it takes effect the next time a round is calculated.`}
        fields={fields}
        submitting={create.isPending}
        onSubmit={(values) => create.mutateAsync({ productId, ...values })}
      />

      <ResourceFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && crud.setEditing(null)}
        title={`Edit ${editing ? productName(editing.productId) : "driver"}`}
        description="Rounds already calculated keep the numbers they were given; this changes the next calculation onward."
        fields={fields}
        initial={editing}
        submitting={update.isPending}
        onSubmit={(values) => update.mutateAsync({ id: editing._id, data: values })}
      />

      <DeleteResourceDialog
        row={crud.deleting}
        onOpenChange={(v) => !v && crud.setDeleting(null)}
        label="driver"
        name={crud.deleting ? productName(crud.deleting.productId) : undefined}
        loading={remove.isPending}
        consequence="This product's market stops moving year to year. Rounds already calculated keep the numbers they were given."
        onConfirm={() => remove.mutateAsync(crud.deleting._id)}
      />
    </>
  );
}
