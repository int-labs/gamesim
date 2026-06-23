import { useEffect, useState } from "react";
import { getInitiatives, createInitiative, deleteInitiative } from "../api";
import type { Initiative } from "../types";

const BLANK = { name: "", details: "", costConsumption: 0, energyConsumption: 0 };

export default function InitiativesPage() {
  const [rows, setRows] = useState<Initiative[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getInitiatives();
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
      await createInitiative({
        ...form,
        costConsumption: Number(form.costConsumption),
        energyConsumption: Number(form.energyConsumption),
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
    if (!confirm("Delete this initiative?")) return;
    try {
      await deleteInitiative(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Initiatives</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Name</td><td><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></td></tr>
          <tr><td>Details</td><td><textarea value={form.details} rows={2} cols={40} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} /></td></tr>
          <tr><td>Cost Consumption</td><td><input type="number" value={form.costConsumption} onChange={e => setForm(f => ({ ...f, costConsumption: Number(e.target.value) }))} /></td></tr>
          <tr><td>Energy Consumption</td><td><input type="number" value={form.energyConsumption} onChange={e => setForm(f => ({ ...f, energyConsumption: Number(e.target.value) }))} /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Initiatives</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>Name</th><th>Details</th><th>Cost</th><th>Energy</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.name}</td>
              <td>{r.details}</td>
              <td>{r.costConsumption}</td>
              <td>{r.energyConsumption}</td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
