import { useEffect, useState } from "react";
import { getSimulations, createSimulation, deleteSimulation } from "../api";
import type { Simulation } from "../types";

const BLANK = {
  simulationName: "",
  status: "Inactive",
  simulationTypeId: "",
  startDate: "",
  endDate: "",
};

export default function SimulationsPage() {
  const [rows, setRows] = useState<Simulation[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getSimulations();
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createSimulation(form);
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
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Simulations</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>Name</th><th>Status</th><th>SimTypeId</th><th>Start</th><th>End</th><th>Actions</th>
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
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
