import { useEffect, useState } from "react";
import { getDrivers, createDriver, deleteDriver } from "../api";
import type { Driver } from "../types";

const BLANK = { productId: "", segmentId: "", years: "{}" };

export default function DriversPage() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterProduct, setFilterProduct] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getDrivers(filterProduct || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterProduct]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      let years = {};
      try { years = JSON.parse(form.years); } catch { setError("years must be valid JSON"); setLoading(false); return; }
      await createDriver({ productId: form.productId, segmentId: form.segmentId, years });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this driver?")) return;
    try {
      await deleteDriver(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const YearsTable = ({ years }: { years: Record<string, any> | null }) => {
    if (!years) return <span style={{ color: "#888" }}>—</span>;

    const yearKeys = Object.keys(years);

    return (
      <div style={{ maxWidth: 420, maxHeight: 280, overflow: "auto" }}>
        {yearKeys.map(yearKey => {
          const metrics = years[yearKey] || {};
          const metricKeys = Object.keys(metrics);

          // union of property keys across this year's metrics, in case they differ
          const propertyKeys = Array.from(
            new Set(metricKeys.flatMap(m => Object.keys(metrics[m] || {})))
          );

          return (
            <div key={yearKey} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 11 }}>{yearKey}</strong>
              <table style={{ fontSize: 10, borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #ccc", padding: 2, textAlign: "left" }}>metric</th>
                    {propertyKeys.map(p => (
                      <th key={p} style={{ border: "1px solid #ccc", padding: 2 }}>{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricKeys.map(m => (
                    <tr key={m}>
                      <td style={{ border: "1px solid #ccc", padding: 2 }}>{m}</td>
                      {propertyKeys.map(p => (
                        <td key={p} style={{ border: "1px solid #ccc", padding: 2, textAlign: "right" }}>
                          {metrics[m]?.[p] !== undefined ? String(metrics[m][p]) : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <h2>Drivers</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <label>Filter Product ID: <input value={filterProduct} onChange={e => setFilterProduct(e.target.value)} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Product ID</td><td><input value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} /></td></tr>
          <tr><td>Years (JSON)</td><td><textarea value={form.years} onChange={e => setForm(f => ({ ...f, years: e.target.value }))} rows={3} cols={40} /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Drivers</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>ProductId</th><th>Years (preview)</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.productId}</td>
              <td><YearsTable years={r.years} /></td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
