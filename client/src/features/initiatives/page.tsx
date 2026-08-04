import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Rocket, Trash2, Zap } from "lucide-react";
import * as React from "react";
import { EntityCell, IconTile, ProgressLinear } from "@/components/app/bits";
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
import { initiativeCrud, useInitiatives } from "@/lib/api-hooks";
import { money } from "@/lib/format";

/**
 * Initiatives — full CRUD.
 *
 * The page could create and delete but not edit, so a typo in a name or a
 * wrong cost meant deleting the row and typing it again. It also carried its
 * own hand-rolled dialog; it now uses the shared form like every other
 * collection, which is where the edit path comes from for free.
 */
export default function InitiativesPage() {
  const { data = [], isLoading, isError, refetch } = useInitiatives();

  const crud = useResourceCrud<any>();
  const create = initiativeCrud.useCreate();
  const update = initiativeCrud.useUpdate();
  const remove = initiativeCrud.useDelete();

  const maxEnergy = Math.max(1, ...data.map((i: any) => i.energyConsumption ?? 0));

  const fields = React.useMemo<FormField[]>(
    () => [
      {
        key: "name",
        label: "Name",
        required: true,
        placeholder: "Regional marketing push",
        help: "What teams see when choosing. Must be unique.",
      },
      {
        key: "costConsumption",
        label: "Cost",
        kind: "money",
        help: "Charged to the team's budget when they take it.",
      },
      {
        key: "energyConsumption",
        label: "Energy",
        kind: "number",
        help: "Spent from the team's energy for the round. Energy is the cap on how much a team can do at once.",
      },
      {
        key: "details",
        label: "Details",
        kind: "textarea",
        placeholder: "What this buys the team, in a sentence.",
        help: "Shown under the name. Say what it does, not what it is called.",
      },
    ],
    []
  );

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Initiative",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<Rocket />} tone="brand" />}
            primary={row.original.name}
            secondary={row.original.details}
          />
        ),
      },
      {
        accessorKey: "costConsumption",
        header: "Cost",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[13px] font-semibold tnum text-foreground">
            {money(row.original.costConsumption)}
          </span>
        ),
      },
      {
        accessorKey: "energyConsumption",
        header: "Energy",
        size: 180,
        cell: ({ row }) => (
          <div className="w-32">
            <div className="mb-1 flex items-center gap-1 text-[13px] font-semibold tnum text-foreground">
              <Zap className="size-3.5 text-warning" />
              {row.original.energyConsumption ?? 0}
            </div>
            <ProgressLinear
              thin
              value={row.original.energyConsumption ?? 0}
              total={maxEnergy}
              tone="warning"
            />
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton label="Edit initiative" onClick={() => crud.openEdit(row.original)}>
              <Pencil />
            </IconButton>
            <IconButton label="Delete initiative" onClick={() => crud.openDelete(row.original)}>
              <Trash2 />
            </IconButton>
          </div>
        ),
      },
    ],
    [maxEnergy, crud]
  );

  const editing = crud.editing;

  return (
    <>
      <PageHeader
        title="Initiatives"
        count={data.length}
        subtitle="Optional plays teams can buy into during a round, each costing budget and energy."
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search initiatives…"
        toolbarExtra={
          <Button size="sm" onClick={crud.openCreate}>
            <Plus /> New initiative
          </Button>
        }
        empty={
          <EmptyState
            icon={<Rocket />}
            title="No initiatives yet"
            hint="Initiatives give teams extra levers beyond their product decisions."
            action={
              <Button onClick={crud.openCreate}>
                <Plus /> New initiative
              </Button>
            }
          />
        }
      />

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New initiative"
        description="Available to every team from the next round they submit."
        fields={fields}
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutateAsync({
            costConsumption: 0,
            energyConsumption: 0,
            ...values,
          })
        }
      />

      <ResourceFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && crud.setEditing(null)}
        title={`Edit ${editing?.name ?? "initiative"}`}
        fields={fields}
        initial={editing}
        submitting={update.isPending}
        onSubmit={(values) => update.mutateAsync({ id: editing._id, data: values })}
      />

      <DeleteResourceDialog
        row={crud.deleting}
        onOpenChange={(v) => !v && crud.setDeleting(null)}
        label="initiative"
        name={crud.deleting?.name}
        loading={remove.isPending}
        consequence="Teams will no longer see it when submitting decisions. Rounds where teams already took it keep the cost they were charged."
        onConfirm={() => remove.mutateAsync(crud.deleting._id)}
      />
    </>
  );
}
