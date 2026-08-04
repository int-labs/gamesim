import { Globe, Pencil, Plus, Trash2, Zap } from "lucide-react";
import * as React from "react";
import { EntityCell, IconTile } from "@/components/app/bits";
import { Card, CardHeader } from "@/components/app/card";
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
import { Skeleton } from "@/components/ui/primitives";
import { globalInputCrud, useActiveSimulationTypeId, useGlobalInputs } from "@/lib/api-hooks";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Master–detail: groups on the left, their items on the right (spec §10.11). */
const FIELDS: FormField[] = [
  {
    key: "label",
    label: "Label",
    required: true,
    placeholder: "Marketing spend",
    help: "What a team sees on the decision form.",
  },
  {
    key: "key",
    label: "Key",
    required: true,
    immutable: true,
    placeholder: "marketing_spend",
    help: "The stable id the engine reads. Fixed once created, because decisions already reference it.",
  },
  {
    key: "category",
    label: "Category",
    required: true,
    placeholder: "notebook",
    help: "Groups related levers together in the player's UI.",
  },
  {
    key: "description",
    label: "Description",
    kind: "textarea",
    help: "One line on what pulling this lever actually does.",
  },
  {
    key: "type",
    label: "Input type",
    kind: "select",
    required: true,
    options: [
      { value: "checkbox", label: "Checkbox — pick any number" },
      { value: "radio", label: "Radio — pick exactly one" },
      { value: "number", label: "Number — type a value" },
    ],
    help: "How teams choose. The server rejects a lever without one.",
  },
  {
    key: "maxSelections",
    label: "Max selections",
    kind: "number",
    min: 0,
    help: "For multi-select levers. Leave blank for no limit.",
  },
];

export default function GlobalInputsPage() {
  const { data = [], isLoading, isError, refetch } = useGlobalInputs();
  const typeId = useActiveSimulationTypeId();

  const crud = useResourceCrud<any>();
  const create = globalInputCrud.useCreate();
  const update = globalInputCrud.useUpdate();
  const remove = globalInputCrud.useDelete();
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selected && data.length > 0) setSelected(data[0]._id);
  }, [data, selected]);

  const current = data.find((g: any) => g._id === selected);
  const items: any[] = current?.inputs ?? [];

  if (isError) {
    return (
      <>
        <PageHeader title="Global inputs" subtitle="Levers that apply across products within a round." />
        <Card padded={false}>
          <EmptyState
            kind="error"
            title="Couldn't load global inputs"
            hint="The request failed. The API may be down or unreachable."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  if (!isLoading && data.length === 0) {
    return (
      <>
        <PageHeader title="Global inputs" subtitle="Levers that apply across products within a round." />
        <Card padded={false}>
          <EmptyState
            icon={<Globe />}
            title="No global inputs yet"
            hint="Global inputs are shared levers — marketing spend, capacity, and similar — that affect every product."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Global inputs"
        count={data.length}
        subtitle="Levers that apply across products within a round, each carrying a cost and an energy draw."
        actions={
          <Button shape="pill" onClick={crud.openCreate} disabled={!typeId}>
            <Plus /> New lever
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4" padded={false}>
          <div className="border-b border-border p-4">
            <CardHeader title="Groups" subtitle={`${data.length} categories`} />
          </div>
          <div className="p-2">
            {isLoading &&
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="size-9 rounded-md" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            {data.map((g: any) => (
              <div key={g._id} className="group/row flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelected(g._id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors",
                  selected === g._id ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <IconTile icon={<Globe />} tone={selected === g._id ? "brand" : "peri"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-foreground">
                    {g.category ?? g.key}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">{g.key}</div>
                </div>
                <Badge tone="count" size="sm">
                  {(g.inputs ?? []).length}
                </Badge>
              </button>
              {/* Revealed on hover so the list stays calm when just browsing. */}
              <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                <IconButton label="Edit lever" size="sm" onClick={() => crud.openEdit(g)}>
                  <Pencil />
                </IconButton>
                <IconButton label="Delete lever" size="sm" onClick={() => crud.openDelete(g)}>
                  <Trash2 />
                </IconButton>
              </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-8" padded={false}>
          <div className="border-b border-border p-4">
            <CardHeader
              title={current?.category ?? current?.key ?? "Items"}
              subtitle={`${items.length} input${items.length === 1 ? "" : "s"}`}
            />
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={<Globe />}
              title="No items in this group"
              hint="Items are the individual levers teams choose between."
            />
          ) : (
            <div className="divide-y divide-border">
              {items.map((item: any) => (
                <div key={item._id} className="flex items-center gap-4 p-4">
                  <EntityCell
                    className="flex-1"
                    leading={<IconTile icon={<Zap />} tone="gold" size="sm" />}
                    primary={item.label ?? item.key}
                    secondary={item.key}
                  />
                  <div className="text-right">
                    <div className="text-[13px] font-semibold tnum text-foreground">
                      {money(item.cost ?? 0)}
                    </div>
                    <div className="text-[12px] tnum text-muted-foreground">
                      {item.energy ?? 0} energy
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ResourceFormDialog
        open={crud.creating}
        onOpenChange={crud.setCreating}
        title="New global input"
        description="A lever that applies across every product in a round, not to one product."
        fields={FIELDS}
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutateAsync({ ...values, simulationTypeId: typeId })
        }
      />

      <ResourceFormDialog
        open={!!crud.editing}
        onOpenChange={(v) => !v && crud.setEditing(null)}
        title={`Edit ${crud.editing?.label ?? crud.editing?.key ?? "lever"}`}
        fields={FIELDS}
        initial={crud.editing}
        submitting={update.isPending}
        onSubmit={(values) =>
          update.mutateAsync({ id: crud.editing._id, data: values })
        }
      />

      <DeleteResourceDialog
        row={crud.deleting}
        onOpenChange={(v) => !v && crud.setDeleting(null)}
        label="lever"
        name={crud.deleting?.label ?? crud.deleting?.key}
        loading={remove.isPending}
        consequence="Decisions already submitted keep the value they recorded, but the lever disappears from the form and stops affecting future rounds."
        onConfirm={() => remove.mutateAsync(crud.deleting._id)}
      />
    </>
  );
}
