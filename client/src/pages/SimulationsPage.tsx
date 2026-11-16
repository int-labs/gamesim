import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, DatePicker, Heading, Input, PageHeader, Select, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getSimulations, createSimulation, deleteSimulation, updateSimulation } from "../api";
import type { Simulation } from "../types";

const BLANK = {
  simulationName: "",
  status: "Active",
  simulationTypeId: "",
  startDate: "",
  endDate: "",
  totalRounds: 1,
  // The SELECT below is what constrains this: an operator cannot type a third
  // value, so the stored `config.mode` is always one of the two and no reader
  // needs to defend against a typo.
  mode: "competitive" as SimulationMode,
};

/** How a simulation is run. Mirrors `SimulationMode` in the server model.
 *  competitive   — operator scores each round; market share is competed.
 *  single_player — the team's own projections are the result; no operator. */
type SimulationMode = "competitive" | "single_player";

const MODE_OPTIONS: { value: SimulationMode; label: string }[] = [
  { value: "competitive", label: "Competitive — operator calculates each round" },
  { value: "single_player", label: "Single player — projections are the result" },
];

export default function SimulationsPage() {
  const [rows, setRows] = useState<Simulation[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ totalRounds: 1, currRounds: 1, mode: "competitive" as SimulationMode });

  const load = async () => {
    try {
      const res = await getSimulations();
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateSimulation(id, {
        config: {
          totalRounds: editForm.totalRounds,
          currRounds: editForm.currRounds,
          mode: editForm.mode,
        },
      });
      setEditingId(null);
      await load(); // reuse whatever the existing fetch/reload function is named
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handleEditStart = (r: any) => {
    setEditingId(r._id);
    setEditForm({
      totalRounds: r.config?.totalRounds ?? 1,
      currRounds:  r.config?.currRounds ?? 1,
      // Simulations created before this field existed are operator-run.
      mode:        (r.config?.mode as SimulationMode) ?? "competitive",
    });
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createSimulation({
        ...form,
        config: { totalRounds: form.totalRounds, currRounds: 1, mode: form.mode },
      });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this simulation?")) return;
    try {
      await deleteSimulation(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const columns: DataTableColumn<Simulation>[] = [
    { id: "_id", header: "_id", cell: r => r._id },
    { id: "simulationName", header: "Name", cell: r => r.simulationName, primary: true },
    { id: "status", header: "Status", cell: r => r.status },
    { id: "simulationTypeId", header: "SimTypeId", cell: r => r.simulationTypeId },
    { id: "startDate", header: "Start", cell: r => (r.startDate ? new Date(r.startDate).toLocaleDateString() : "") },
    { id: "endDate", header: "End", cell: r => (r.endDate ? new Date(r.endDate).toLocaleDateString() : "") },
    {
      id: "config",
      header: "Config",
      cell: r =>
        editingId === r._id ? (
          <div className="flex flex-col gap-2">
            <Input size="sm" type="number" min={1} aria-label="Total" placeholder="Total" value={editForm.totalRounds} onChange={e => setEditForm(f => ({ ...f, totalRounds: Number(e.target.value) }))} />
            <Input size="sm" type="number" min={1} aria-label="Curr" placeholder="Curr" value={editForm.currRounds} onChange={e => setEditForm(f => ({ ...f, currRounds: Number(e.target.value) }))} />
            <Select
              size="sm"
              aria-label="Mode"
              options={MODE_OPTIONS.map(o => ({ value: o.value, label: o.value }))}
              value={editForm.mode}
              onValueChange={v => v && setEditForm(f => ({ ...f, mode: v }))}
            />
          </div>
        ) : (
          <>
            Total: {r.config?.totalRounds ?? "—"} / Curr: {r.config?.currRounds ?? "—"}
            <br />
            Mode: {(r.config?.mode as string) ?? "competitive"}
          </>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Simulations" />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={form.simulationName} onChange={e => setForm(f => ({ ...f, simulationName: e.target.value }))} />
          <Select label="Status" options={STATUS_OPTIONS} value={form.status} onValueChange={v => v && setForm(f => ({ ...f, status: v }))} />
          <TextField label="Simulation Type ID" value={form.simulationTypeId} onChange={e => setForm(f => ({ ...f, simulationTypeId: e.target.value }))} />
          <TextField label="Total Rounds" type="number" min={1} value={form.totalRounds} onChange={e => setForm(f => ({ ...f, totalRounds: Number(e.target.value) }))} />
          <DatePicker label="Start Date" value={form.startDate || null} onValueChange={v => setForm(f => ({ ...f, startDate: v ?? "" }))} />
          <DatePicker label="End Date" value={form.endDate || null} onValueChange={v => setForm(f => ({ ...f, endDate: v ?? "" }))} />
          <Select<SimulationMode>
            label="Mode"
            options={MODE_OPTIONS}
            value={form.mode}
            onValueChange={v => v && setForm(f => ({ ...f, mode: v }))}
          />
        </div>
        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Simulations</Heading>
        <DataTable
          label="All Simulations"
          columns={columns}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => editingId === r._id ? (
            <>
              <Button variant="text" onClick={() => handleUpdate(r._id)}>Save</Button>
              <Button variant="text" onClick={() => setEditingId(null)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="text" onClick={() => handleEditStart(r)}>Edit</Button>
              <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>
            </>
          )}
        />
      </Card>
    </>
  );
}

const STATUS_OPTIONS = ["Active", "Inactive", "Completed"].map(s => ({ value: s, label: s }));
