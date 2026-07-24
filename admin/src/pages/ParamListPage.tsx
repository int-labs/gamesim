import { useEffect, useState } from "react";
import { getParamLists, createParamList, deleteParamList } from "../api";
import type { ParamList } from "../types";

const BLANK = { segmentId: "", productId: "", parameters: "[]" };

export default function ParamListPage() {
  const [rows, setRows] = useState<ParamList[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSegment, setFilterSegment] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getParamLists(filterSegment || undefined, filterProduct || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSegment, filterProduct]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      let parameters: unknown[] = [];
      try { parameters = JSON.parse(form.parameters); } catch { setError("parameters must be valid JSON array"); setLoading(false); return; }
      await createParamList({ segmentId: form.segmentId, productId: form.productId, parameters });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this param list?")) return;
    try {
      await deleteParamList(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Param List</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter Segment ID: <input value={filterSegment} onChange={e => setFilterSegment(e.target.value)} /></label>
      {" "}
      <label>Filter Product ID: <input value={filterProduct} onChange={e => setFilterProduct(e.target.value)} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Segment ID</td><td><input value={form.segmentId} onChange={e => setForm(f => ({ ...f, segmentId: e.target.value }))} /></td></tr>
          <tr><td>Product ID</td><td><input value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} /></td></tr>
          <tr><td>Parameters (JSON array)</td><td><textarea value={form.parameters} rows={4} cols={50} onChange={e => setForm(f => ({ ...f, parameters: e.target.value }))} /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Param Lists</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>SegmentId</th><th>ProductId</th><th>Parameters</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.segmentId}</td>
              <td>{r.productId}</td>
              <td><pre style={{ margin: 0, maxWidth: 300, overflow: "auto", fontSize: 11 }}>{JSON.stringify(r.parameters, null, 2)}</pre></td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
