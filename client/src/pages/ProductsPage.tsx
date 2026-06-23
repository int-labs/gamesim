import { useEffect, useState } from "react";
import { getProducts, createProduct, deleteProduct } from "../api";
import type { Product } from "../types";

const BLANK = {
  simulationTypeId: "", segmentId: "", productName: "", productType: "",
  chargeoffCoefficient: 0, useChargeoff: false, order: 0,
  chartPosition: "", description: "", displayDescription: "", displayTitle: "",
};

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSimType, setFilterSimType] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getProducts(filterSimType || undefined, filterSegment || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSimType, filterSegment]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createProduct({
        ...form,
        active: true,
        chargeoffCoefficient: Number(form.chargeoffCoefficient),
        order: Number(form.order),
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
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Products</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter Simulation Type ID: <input value={filterSimType} onChange={e => setFilterSimType(e.target.value)} /></label>
      {" "}
      <label>Filter Segment ID: <input value={filterSegment} onChange={e => setFilterSegment(e.target.value)} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Simulation Type ID</td><td><input value={form.simulationTypeId} onChange={e => setForm(f => ({ ...f, simulationTypeId: e.target.value }))} /></td></tr>
          <tr><td>Segment ID</td><td><input value={form.segmentId} onChange={e => setForm(f => ({ ...f, segmentId: e.target.value }))} /></td></tr>
          <tr><td>Product Name</td><td><input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} /></td></tr>
          <tr><td>Product Type</td><td><input value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))} /></td></tr>
          <tr><td>Display Title</td><td><input value={form.displayTitle} onChange={e => setForm(f => ({ ...f, displayTitle: e.target.value }))} /></td></tr>
          <tr><td>Order</td><td><input type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} /></td></tr>
          <tr><td>Chart Position</td><td><input value={form.chartPosition} onChange={e => setForm(f => ({ ...f, chartPosition: e.target.value }))} /></td></tr>
          <tr>
            <td>Use Chargeoff</td>
            <td><input type="checkbox" checked={form.useChargeoff} onChange={e => setForm(f => ({ ...f, useChargeoff: e.target.checked }))} /></td>
          </tr>
          <tr><td>Chargeoff Coefficient</td><td><input type="number" value={form.chargeoffCoefficient} onChange={e => setForm(f => ({ ...f, chargeoffCoefficient: Number(e.target.value) }))} /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Products</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>SimTypeId</th><th>SegmentId</th><th>Name</th><th>Type</th><th>Active</th><th>Order</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationTypeId}</td>
              <td>{r.segmentId}</td>
              <td>{r.productName}</td>
              <td>{r.productType}</td>
              <td>{r.active ? "✓" : "✗"}</td>
              <td>{r.order}</td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
