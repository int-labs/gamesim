import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getTeams, createTeam, deleteTeam } from "../api";
import type { Team } from "../types";

const BLANK = { simulationId: "", teamName: "", teamLeader: "", score: 0, marketShare: 0 };

export default function TeamsPage() {
  const [rows, setRows] = useState<Team[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSim, setFilterSim] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getTeams(filterSim || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSim]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createTeam({ ...form, score: Number(form.score), marketShare: Number(form.marketShare) });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team?")) return;
    try {
      await deleteTeam(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <>
      <PageHeader title="Teams" />
      {error && <Alert tone="danger">{error}</Alert>}

      <TextField label="Filter by Simulation ID" value={filterSim} onChange={e => setFilterSim(e.target.value)} />

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Simulation ID" value={form.simulationId} onChange={e => setForm(f => ({ ...f, simulationId: e.target.value }))} />
          <TextField label="Team Name" value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} />
          <TextField label="Team Leader" value={form.teamLeader} onChange={e => setForm(f => ({ ...f, teamLeader: e.target.value }))} />
          <TextField label="Score" type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))} />
          <TextField label="Market Share" type="number" value={form.marketShare} onChange={e => setForm(f => ({ ...f, marketShare: Number(e.target.value) }))} />
        </div>
        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Teams</Heading>
        <DataTable
          label="All Teams"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const COLUMNS: DataTableColumn<Team>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "simulationId", header: "SimId", cell: r => r.simulationId },
  { id: "teamName", header: "Name", cell: r => r.teamName, primary: true },
  { id: "teamLeader", header: "Leader", cell: r => r.teamLeader },
  { id: "score", header: "Score", cell: r => r.score },
  { id: "marketShare", header: "Market Share", cell: r => r.marketShare },
];
