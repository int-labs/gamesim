import { useEffect, useState } from "react";
import { getRounds, createRound, patchRound, deleteRound } from "../api";
import type { Round } from "../types";

const BLANK = { simulationId: "", roundNumber: 0, status: "Pending", durationMinutes: "" };

export default function RoundsPage() {
  const [rows, setRows] = useState<Round[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSim, setFilterSim] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getRounds(filterSim || undefined);
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
      const payload: any = {
        simulationId: form.simulationId,
        roundNumber: Number(form.roundNumber),
        status: form.status,
      };
      if (form.durationMinutes) {
        payload.timer = { durationMinutes: Number(form.durationMinutes) };
      }
      await createRound(payload);
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePatch = async (id: string, status: string, durationMinutes?: string) => {
    setError("");
    try {
      const payload: any = { status };
      if (durationMinutes) payload.timer = { durationMinutes: Number(durationMinutes) };
      await patchRound(id, payload);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this round?")) return;
    try {
      await deleteRound(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Rounds</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter by Simulation ID: <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr>
            <td>Simulation ID</td>
            <td><input value={form.simulationId} onChange={e => setForm(f => ({ ...f, simulationId: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Round Number</td>
            <td><input type="number" value={form.roundNumber} onChange={e => setForm(f => ({ ...f, roundNumber: Number(e.target.value) }))} /></td>
          </tr>
          <tr>
            <td>Status</td>
            <td>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option>Pending</option>
                <option>Active</option>
                <option>Completed</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>Duration (minutes)</td>
            <td><input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} /></td>
          </tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Rounds</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>SimId</th><th>Round#</th><th>Status</th><th>Start</th><th>Duration</th><th>End</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationId}</td>
              <td>{r.roundNumber}</td>
              <td>{r.status}</td>
              <td>{r.timer?.startDate ? new Date(r.timer.startDate).toLocaleString() : ""}</td>
              <td>{r.timer?.durationMinutes ?? ""}</td>
              <td>{r.timer?.endDate ? new Date(r.timer.endDate).toLocaleString() : ""}</td>
              <td>
                {r.status === "Pending" && (
                  <button onClick={() => handlePatch(r._id, "Active")}>→ Active</button>
                )}
                {r.status === "Active" && (
                  <button onClick={() => handlePatch(r._id, "Completed")}>→ Completed</button>
                )}
                {" "}
                <button onClick={() => handleDelete(r._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
