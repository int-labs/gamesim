import { useEffect, useState } from "react";
import { getSimulations, createSimulation, deleteSimulation, updateSimulation } from "../api";
import type { Simulation } from "../types";

const BLANK = {
  simulationName: "",
  status: "Active",
  simulationTypeId: "",
  startDate: "",
  endDate: "",
  totalRounds: 1,
};

export default function SimulationsPage() {
  const [rows, setRows] = useState<Simulation[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ totalRounds: 1, currRounds: 1 });

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
      await updateSimulation(id, { config: { totalRounds: editForm.totalRounds, currRounds: editForm.currRounds } });
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
    });
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createSimulation({
        ...form,
        config: { totalRounds: form.totalRounds, currRounds: 1 },
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

  return (
    <div>
      <h2>Simulations</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Create</h3>
      <table>
        <tbody>
          <tr>
            <td>Name</td>
            <td><input value={form.simulationName} onChange={e => setForm(f => ({ ...f, simulationName: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Status</td>
            <td>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option>Active</option>
                <option>Inactive</option>
                <option>Completed</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>Simulation Type ID</td>
            <td><input value={form.simulationTypeId} onChange={e => setForm(f => ({ ...f, simulationTypeId: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Start Date</td>
            <td><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>End Date</td>
            <td><input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Total Rounds</td>
            <td><input type="number" min={1} value={form.totalRounds} onChange={e => setForm(f => ({ ...f, totalRounds: Number(e.target.value) }))} /></td>
          </tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Simulations</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>Name</th><th>Status</th><th>SimTypeId</th><th>Start</th><th>End</th><th>Config</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationName}</td>
              <td>{r.status}</td>
              <td>{r.simulationTypeId}</td>
              <td>{r.startDate ? new Date(r.startDate).toLocaleDateString() : ""}</td>
              <td>{r.endDate ? new Date(r.endDate).toLocaleDateString() : ""}</td>
              <td>
                {editingId === r._id ? (
                  <>
                    Total: <input type="number" min={1} style={{ width: 50 }} value={editForm.totalRounds} onChange={e => setEditForm(f => ({ ...f, totalRounds: Number(e.target.value) }))} /><br />
                    Curr: <input type="number" min={1} style={{ width: 50 }} value={editForm.currRounds} onChange={e => setEditForm(f => ({ ...f, currRounds: Number(e.target.value) }))} />
                  </>
                ) : (
                  <>Total: {r.config?.totalRounds ?? "—"} / Curr: {r.config?.currRounds ?? "—"}</>
                )}
              </td>
              <td>
                {editingId === r._id ? (
                  <>
                    <button onClick={() => handleUpdate(r._id)}>Save</button>{" "}
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEditStart(r)}>Edit</button>{" "}
                    <button onClick={() => handleDelete(r._id)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
