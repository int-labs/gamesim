import type { ColumnDef } from "@tanstack/react-table";
import { MonitorPlay, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { CopyChip, EntityCell, IconTile, SimulationStatusChip } from "@/components/app/bits";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ResourceFormDialog, type FormField } from "@/components/app/resource-form";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { IconButton } from "@/components/ui/icon-button";
import { Label } from "@/components/ui/primitives";
import {
  simulationCrud,
  useCreateSimulation,
  useDeleteSimulation,
  useSimulationTypes,
  useSimulations,
} from "@/lib/api-hooks";
import { relativeTime, shortDate } from "@/lib/format";
import { useScope } from "@/lib/scope-store";

function CreateSimulationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: types = [] } = useSimulationTypes();
  const create = useCreateSimulation();

  const [form, setForm] = React.useState({
    simulationName: "",
    simulationTypeId: "",
    status: "Active",
    startDate: "",
    endDate: "",
    totalRounds: 3,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setForm({
        simulationName: "",
        simulationTypeId: "",
        status: "Active",
        startDate: "",
        endDate: "",
        totalRounds: 3,
      });
      setErrors({});
    }
  }, [open]);

  const submit = () => {
    const next: Record<string, string> = {};
    if (!form.simulationName.trim()) next.simulationName = "Simulation name is required";
    if (!form.simulationTypeId) next.simulationTypeId = "Pick a simulation type";
    if (form.totalRounds < 1) next.totalRounds = "Needs at least one round";
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate))
      next.endDate = "End date must be after start date";
    setErrors(next);
    if (Object.keys(next).length) return;

    create.mutate(
      {
        simulationName: form.simulationName.trim(),
        simulationTypeId: form.simulationTypeId,
        status: form.status,
        ...(form.startDate ? { startDate: new Date(form.startDate).toISOString() } : {}),
        ...(form.endDate ? { endDate: new Date(form.endDate).toISOString() } : {}),
        config: { totalRounds: Number(form.totalRounds), currRounds: 0 },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="max-w-[520px]">
        <DialogTitle>Create simulation</DialogTitle>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sim-name">Name</Label>
            <Input
              id="sim-name"
              value={form.simulationName}
              error={!!errors.simulationName}
              onChange={(e) => setForm({ ...form, simulationName: e.target.value })}
              placeholder="Q3 Banking Simulation"
            />
            {errors.simulationName && <p className="text-[12px] text-destructive">{errors.simulationName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Simulation type</Label>
            <Select
              value={form.simulationTypeId}
              onValueChange={(v) => setForm({ ...form, simulationTypeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a type…" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t: any) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.simulationTypeId && (
              <p className="text-[12px] text-destructive">{errors.simulationTypeId}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Active", "Inactive", "Completed"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-rounds">Total rounds</Label>
              <Input
                id="sim-rounds"
                type="number"
                min={1}
                className="tnum"
                value={form.totalRounds}
                error={!!errors.totalRounds}
                onChange={(e) => setForm({ ...form, totalRounds: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sim-start">Start date</Label>
              <Input
                id="sim-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-end">End date</Label>
              <Input
                id="sim-end"
                type="date"
                value={form.endDate}
                error={!!errors.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
              {errors.endDate && <p className="text-[12px] text-destructive">{errors.endDate}</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create simulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SimulationsPage() {
  const { data = [], isLoading, isError, refetch } = useSimulations();
  const { data: types = [] } = useSimulationTypes();
  const del = useDeleteSimulation();
  const { setScope } = useScope();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<any>(null);

  // Simulations were create-and-delete only: there was no way to rename a
  // cohort or move it to Completed, which is the state that unlocks the
  // debrief for teams. `updateSimulation` had existed unused the whole time.
  const update = simulationCrud.useUpdate();
  const [editing, setEditing] = React.useState<any>(null);

  const editFields = React.useMemo<FormField[]>(
    () => [
      {
        key: "simulationName",
        label: "Name",
        required: true,
        wide: true,
        help: "What this cohort is called everywhere in the console.",
      },
      {
        key: "status",
        label: "Status",
        kind: "select",
        required: true,
        options: ["Active", "Inactive", "Completed"].map((v) => ({ value: v, label: v })),
        help: "A debrief only unlocks for teams once the simulation is Completed.",
      },
      { key: "startDate", label: "Starts", placeholder: "YYYY-MM-DD" },
      { key: "endDate", label: "Ends", placeholder: "YYYY-MM-DD" },
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
        accessorKey: "simulationName",
        header: "Simulation",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<MonitorPlay />} tone="brand" />}
            primary={row.original.simulationName}
            secondary={<CopyChip value={row.original._id} />}
          />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        cell: ({ row }) => <SimulationStatusChip status={row.original.status} />,
      },
      {
        id: "type",
        header: "Type",
        size: 180,
        accessorFn: (r) => typeName(r.simulationTypeId),
        cell: ({ row }) => (
          <Badge tone="navy" size="sm">
            {typeName(row.original.simulationTypeId)}
          </Badge>
        ),
      },
      {
        id: "rounds",
        header: "Rounds",
        size: 110,
        accessorFn: (r) => r.config?.currRounds ?? 0,
        cell: ({ row }) => (
          <span className="text-[13px] font-semibold tnum text-foreground">
            {row.original.config?.currRounds ?? 0}
            <span className="text-muted-foreground"> / {row.original.config?.totalRounds ?? "—"}</span>
          </span>
        ),
      },
      {
        accessorKey: "startDate",
        header: "Window",
        size: 190,
        cell: ({ row }) => (
          <span className="text-[13px] text-body">
            {shortDate(row.original.startDate)} → {shortDate(row.original.endDate)}
          </span>
        ),
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
        size: 56,
        enableSorting: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Row actions" size="sm">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setScope(row.original._id, row.original.simulationName)}
                >
                  <MonitorPlay /> Set as active scope
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                  <Pencil /> Edit simulation
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => setPendingDelete(row.original)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [typeName, setScope, setEditing]
  );

  const activeCount = data.filter((s: any) => s.status === "Active").length;
  const totalRounds = data.reduce((acc: number, s: any) => acc + (s.config?.totalRounds ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Simulations"
        count={data.length}
        subtitle="Every run of a simulation type — its rounds, teams and decisions live underneath."
        actions={
          <Button shape="pill" onClick={() => setCreateOpen(true)}>
            <Plus /> Create simulation
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard compact label="Total simulations" value={data.length} />
        <StatCard compact label="Active now" value={activeCount} />
        <StatCard compact label="Rounds configured" value={totalRounds} />
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search simulations…"
        initialSorting={[{ id: "createdAt", desc: true }]}
        onRowClick={(row) => setScope(row._id, row.simulationName)}
        empty={
          <EmptyState
            icon={<MonitorPlay />}
            title="No simulations yet"
            hint="Create one to run your first game with teams and rounds."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Create simulation
              </Button>
            }
          />
        }
      />

      <CreateSimulationDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ResourceFormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={`Edit ${editing?.simulationName ?? "simulation"}`}
        description="Renaming is safe at any time. Moving to Completed is what unlocks the debrief for teams."
        fields={editFields}
        initial={editing}
        submitting={update.isPending}
        onSubmit={(values) => update.mutateAsync({ id: editing._id, data: values })}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.simulationName}?`}
        description="This deletes the simulation. Its rounds, teams and decisions become orphaned and teams will lose access."
        confirmText={pendingDelete?.simulationName}
        confirmLabel="Delete simulation"
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(pendingDelete._id, { onSuccess: () => setPendingDelete(null) })
        }
      />
    </>
  );
}
