import type { ColumnDef } from "@tanstack/react-table";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { ActiveChip, CopyChip, EntityCell, IconTile } from "@/components/app/bits";
import { DetailDialog, DetailMap } from "@/components/app/detail-dialog";
import { guessGenreId, resolveArt } from "@/lib/player-assets";
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
import { usePlayerConfig } from "@/lib/player-config-hooks";

/**
 * Products — full CRUD.
 *
 * A product's `fields[]` ARE the decision form teams fill in, so this page is
 * where a facilitator shapes what players are asked. It had become a read-only
 * table, which made the whole authoring half of the console unusable.
 */
/**
 * A product IS its decision fields — they are the form the player fills in and
 * the input the scorer reads. The table can only count them.
 *
 * The two properties that matter and were invisible everywhere:
 *
 * - **Unit cost**, which COGS is priced from. A `PATCH` that didn't restate it
 *   used to erase it silently, and nothing surfaced the loss.
 * - **Direction**, which decides whether a money field contributes to the price
 *   reference `calcFinancials` judges a team's selling price against. A product
 *   with no positive-direction money field earns nothing at all — revenue is
 *   structurally zero while COGS is charged anyway. That is not inferable from
 *   any column on this page, so it is called out by name.
 */
function ProductDetail({
  product,
  segmentName,
  genreIds,
  onOpenChange,
}: {
  product: any | null;
  segmentName: (id: string) => string;
  genreIds: string[];
  onOpenChange: (v: boolean) => void;
}) {
  if (!product) return null;

  const fields: any[] = product.fields ?? [];
  const art = resolveArt(product, guessGenreId(product.productName, genreIds));

  // The exact rule in calcFinancials: money fields with direction > 0,
  // excluding selling_price.
  const priceReference = fields.filter(
    (f) => f.type === "money" && Number(f.direction) > 0 && f.key !== "selling_price"
  );

  return (
    <DetailDialog
      open={!!product}
      onOpenChange={onOpenChange}
      eyebrow="Product"
      title={product.productName}
      subtitle={`${segmentName(product.segmentId)} · ${fields.length} decision field${
        fields.length === 1 ? "" : "s"
      }`}
      leading={
        art ? (
          <img
            src={art}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
            className="size-11 shrink-0 rounded-md bg-muted object-cover"
          />
        ) : (
          <IconTile icon={<Package />} tone="success" />
        )
      }
      sections={[
        {
          title: "Setup",
          fields: [
            { label: "Segment", value: segmentName(product.segmentId) },
            { label: "Type", value: product.productType, empty: !product.productType },
            {
              label: "Available market",
              value:
                product.baseVariables?.availableMarket != null
                  ? new Intl.NumberFormat("en-US").format(product.baseVariables.availableMarket)
                  : "—",
              mono: true,
              empty: product.baseVariables?.availableMarket == null,
            },
            { label: "Active", value: product.active ? "Yes" : "No" },
            { label: "Id", value: product._id, mono: true, wide: true },
            {
              label: "Price reference",
              wide: true,
              value:
                priceReference.length > 0 ? (
                  <span className="text-success">
                    {priceReference.length} money field
                    {priceReference.length === 1 ? "" : "s"} with a positive direction — revenue can
                    be earned.
                  </span>
                ) : (
                  <span className="text-destructive">
                    No money field has a direction above zero, so this product has no price
                    reference. Every round scores it at zero revenue while still charging COGS.
                  </span>
                ),
            },
          ],
        },
        {
          title: "Decision fields",
          fields:
            fields.length === 0
              ? [
                  {
                    label: "Fields",
                    value: "No decision fields — the player has nothing to submit.",
                    wide: true,
                    empty: true,
                  },
                ]
              : fields.map((f) => ({
                  label: `${f.label ?? "Unlabelled"} · ${f.key ?? "no key"}`,
                  wide: true,
                  value: (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="outline" size="sm">
                        {f.type}
                      </Badge>
                      {f.unitCost != null && (
                        <Badge tone="neutral" size="sm">
                          unit cost {f.unitCost}
                        </Badge>
                      )}
                      {f.direction != null && (
                        <Badge tone={Number(f.direction) > 0 ? "success" : "neutral"} size="sm">
                          direction {f.direction}
                        </Badge>
                      )}
                      {(f.minValue != null || f.maxValue != null) && (
                        <Badge tone="outline" size="sm">
                          {f.minValue ?? "−∞"} … {f.maxValue ?? "∞"}
                        </Badge>
                      )}
                      {f.options && Object.keys(f.options).length > 0 && (
                        <DetailMap value={f.options} />
                      )}
                    </span>
                  ),
                })),
        },
      ]}
    />
  );
}

export default function ProductsPage() {
  const { data = [], isLoading, isError, refetch } = useProducts();
  const { data: segments = [] } = useSegments();
  const typeId = useActiveSimulationTypeId();

  // The cover art lives in the player and is resolved by convention from the
  // genre id, so the genre list is what lets the console show it at all.
  const config = usePlayerConfig(typeId ?? undefined);
  const genreIds = React.useMemo<string[]>(
    () => ((config.data as any)?.config?.genres ?? []).map((g: any) => String(g.id)),
    [config.data]
  );

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

  const [detail, setDetail] = React.useState<any>(null);

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Product",
        cell: ({ row }) => {
          const art = resolveArt(row.original, guessGenreId(row.original.productName, genreIds));
          return (
            <EntityCell
              leading={
                art ? (
                  <img
                    src={art}
                    alt=""
                    // The art is the product's own cover; if it 404s (a genre
                    // with no PNG yet) fall back to the icon rather than
                    // leaving a broken-image glyph in the table.
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    className="size-9 shrink-0 rounded-md bg-muted object-cover"
                  />
                ) : (
                  <IconTile icon={<Package />} tone="success" />
                )
              }
              primary={row.original.productName}
              secondary={row.original.productType ?? <CopyChip value={row.original._id} />}
            />
          );
        },
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
    [segmentName, crud, genreIds]
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
        onRowClick={(row: any) => setDetail(row)}
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

      <ProductDetail
        product={detail}
        segmentName={segmentName}
        genreIds={genreIds}
        onOpenChange={(v: boolean) => !v && setDetail(null)}
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
