import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import * as React from "react";
import { EntityCell, IconTile } from "@/components/app/bits";
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
import { paramListCrud, useParamLists, useProducts, useSegments } from "@/lib/api-hooks";
import { relativeTime } from "@/lib/format";

/**
 * Param lists — full CRUD.
 *
 * ── TWO THINGS WERE WRONG HERE ──────────────────────────────────────────────
 * 1. This page rendered `name`, `key` and `value`, none of which the model has.
 *    A ParamList is `{ segmentId, productId, parameters[] }`, so every row read
 *    "Unnamed" — the same failure the Drivers page had.
 *
 * 2. It was labelled read-only, and the navigation was reorganised around that
 *    claim. It isn't: `paramRoutes.ts` is mounted at `/param-list` with POST,
 *    PATCH `/:id/parameters` and DELETE. The earlier survey looked for a file
 *    called `paramListRoutes.ts`, didn't find it, and concluded there was no
 *    write API.
 *
 * A list belongs to one segment × product pair and holds the tunable values the
 * engine reads for it.
 */

const PARAM_TYPES = ["number", "percentage", "currency", "text"];

export default function ParamListPage() {
  const { data = [], isLoading, isError, refetch } = useParamLists();
  const { data: segments = [] } = useSegments();
  const { data: products = [] } = useProducts();

  const crud = useResourceCrud<any>();
  const create = paramListCrud.useCreate();
  const remove = paramListCrud.useDelete();
  const upsertParam = paramListCrud.useUpsertParameter();

  const segmentName = React.useCallback(
    (id: string) => segments.find((s: any) => s._id === id)?.name ?? "Unassigned",
    [segments]
  );
  const productName = React.useCallback(
    (id: string) => products.find((p: any) => p._id === id)?.productName ?? "Unassigned",
    [products]
  );

  const createFields = React.useMemo<FormField[]>(
    () => [
      {
        key: "segmentId",
        label: "Segment",
        kind: "select",
        required: true,
        options: segments.map((s: any) => ({ value: s._id, label: s.name })),
        help: "Which audience these values apply to.",
      },
      {
        key: "productId",
        label: "Product",
        kind: "select",
        required: true,
        options: products.map((p: any) => ({ value: p._id, label: p.productName })),
        help: "Which product these values apply to.",
      },
    ],
    [segments, products]
  );

  /**
   * The server upserts ONE parameter at a time, keyed by `paramCode` — so this
   * form edits a single entry rather than the whole array. That is also what
   * makes it safe: two operators editing different parameters in the same list
   * don't overwrite each other.
   */
  const paramFields = React.useMemo<FormField[]>(
    () => [
      {
        key: "paramCode",
        label: "Code",
        required: true,
        placeholder: "holding_rate",
        help: "The engine's name for this value. Reusing an existing code edits that parameter.",
      },
      { key: "paramTitle", label: "Title", required: true, placeholder: "Holding rate" },
      {
        key: "paramType",
        label: "Type",
        kind: "select",
        options: PARAM_TYPES.map((t) => ({ value: t, label: t })),
      },
      { key: "paramValue", label: "Value", kind: "number", required: true },
      { key: "paramCount", label: "Count", kind: "number", help: "Optional multiplier or quantity." },
    ],
    []
  );

  const [editingList, setEditingList] = React.useState<any>(null);

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        id: "pair",
        header: "Applies to",
        accessorFn: (r) => `${productName(r.productId)} · ${segmentName(r.segmentId)}`,
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<SlidersHorizontal />} tone="neutral" />}
            primary={productName(row.original.productId)}
            secondary={segmentName(row.original.segmentId)}
          />
        ),
      },
      {
        id: "count",
        header: "Parameters",
        size: 130,
        accessorFn: (r) => r.parameters?.length ?? 0,
        cell: ({ row }) => <Badge tone="count">{row.original.parameters?.length ?? 0}</Badge>,
      },
      {
        id: "sample",
        header: "Values",
        cell: ({ row }) => {
          const ps: any[] = row.original.parameters ?? [];
          if (ps.length === 0) {
            return <span className="text-[13px] text-muted-foreground">none yet</span>;
          }
          return (
            <span className="line-clamp-1 max-w-[420px] font-mono text-[12px] text-body">
              {ps.slice(0, 4).map((p) => `${p.paramCode}=${p.paramValue}`).join("  ")}
              {ps.length > 4 ? ` +${ps.length - 4}` : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        size: 120,
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">
            {relativeTime(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton label="Add or edit a parameter" onClick={() => setEditingList(row.original)}>
              <Pencil />
            </IconButton>
            <IconButton label="Delete param list" onClick={() => crud.openDelete(row.original)}>
              <Trash2 />
            </IconButton>
          </div>
        ),
      },
    ],
    [crud, productName, segmentName]
  );

  return (
    <>
      <PageHeader
        title="Param list"
        count={data.length}
        subtitle="Tunable values the engine reads for one product in one segment. Editing a parameter reuses its code — a new code adds one."
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search parameters…"
        toolbarExtra={
          <Button size="sm" onClick={crud.openCreate}>
            <Plus /> New param list
          </Button>
        }
        empty={
          <EmptyState
            icon={<SlidersHorizontal />}
            title="No param lists yet"
            hint="A param list holds the tunable values for one product in one segment."
            action={
              <Button onClick={crud.openCreate}>
                <Plus /> New param list
              </Button>
            }
          />
        }
      />

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New param list"
        description="Pick the product and segment it applies to; add its values afterwards."
        fields={createFields}
        submitting={create.isPending}
        onSubmit={(values) => create.mutateAsync(values)}
      />

      <ResourceFormDialog
        open={!!editingList}
        onOpenChange={(v) => !v && setEditingList(null)}
        title={editingList ? `Parameter for ${productName(editingList.productId)}` : "Parameter"}
        description="Saving a code that already exists updates that parameter; a new code adds one."
        fields={paramFields}
        submitting={upsertParam.isPending}
        submitLabel="Save parameter"
        onSubmit={(values) =>
          upsertParam.mutateAsync({ id: editingList._id, data: values })
        }
      />

      <DeleteResourceDialog
        row={crud.deleting}
        onOpenChange={(v) => !v && crud.setDeleting(null)}
        label="param list"
        name={crud.deleting ? productName(crud.deleting.productId) : undefined}
        loading={remove.isPending}
        consequence="Every parameter in it goes too, and the engine falls back to its built-in defaults for this product and segment."
        onConfirm={() => remove.mutateAsync(crud.deleting._id)}
      />
    </>
  );
}
