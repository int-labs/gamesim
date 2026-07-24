import { useEffect, useState } from "react";
import { getSegments, createSegment, deleteSegment, activateSegment, deactivateSegment } from "../api";
import type { Segment } from "../types";

const BLANK = { simulationTypeId: "", name: "", description: "", key: "", icon: "", order: 0 };

export default function SegmentsPage() {
  const [rows, setRows] = useState<Segment[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSimType, setFilterSimType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getSegments(filterSimType || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSimType]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createSegment({ ...form, order: Number(form.order), active: true });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this segment? Products will also be deactivated.")) return;
    try {
      await deleteSegment(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handleActivate = async (id: string) => {
    try { await activateSegment(id); await load(); }
    catch (e: any) { setError(e.response?.data?.message ?? e.message); }
  };

  const handleDeactivate = async (id: string) => {
    try { await deactivateSegment(id); await load(); }
    catch (e: any) { setError(e.response?.data?.message ?? e.message); }
  };

  return (
    <div>
      <h2>Segments</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter by Simulation Type ID: <input value={filterSimType} onChange={e => setFilterSimType(e.target.value)} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Simulation Type ID</td><td><input value={form.simulationTypeId} onChange={e => setForm(f => ({ ...f, simulationTypeId: e.target.value }))} /></td></tr>
          <tr><td>Name</td><td><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></td></tr>
          <tr><td>Description</td><td><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></td></tr>
          <tr><td>Key</td><td><input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} /></td></tr>
          <tr><td>Icon</td><td><input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} /></td></tr>
          <tr><td>Order</td><td><input type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Segments</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>SimTypeId</th><th>Name</th><th>Key</th><th>Active</th><th>Order</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationTypeId}</td>
              <td>{r.name}</td>
              <td>{r.key}</td>
              <td>{r.active ? "✓" : "✗"}</td>
              <td>{r.order}</td>
              <td>
                {r.active
                  ? <button onClick={() => handleDeactivate(r._id)}>Deactivate</button>
                  : <button onClick={() => handleActivate(r._id)}>Activate</button>}
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
