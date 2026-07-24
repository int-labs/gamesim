import { useEffect, useState } from "react";
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
    <div>
      <h2>Teams</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter by Simulation ID: <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Simulation ID</td><td><input value={form.simulationId} onChange={e => setForm(f => ({ ...f, simulationId: e.target.value }))} /></td></tr>
          <tr><td>Team Name</td><td><input value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))} /></td></tr>
          <tr><td>Team Leader</td><td><input value={form.teamLeader} onChange={e => setForm(f => ({ ...f, teamLeader: e.target.value }))} /></td></tr>
          <tr><td>Score</td><td><input type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))} /></td></tr>
          <tr><td>Market Share</td><td><input type="number" value={form.marketShare} onChange={e => setForm(f => ({ ...f, marketShare: Number(e.target.value) }))} /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Teams</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>SimId</th><th>Name</th><th>Leader</th><th>Score</th><th>Market Share</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationId}</td>
              <td>{r.teamName}</td>
              <td>{r.teamLeader}</td>
              <td>{r.score}</td>
              <td>{r.marketShare}</td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
