import { useEffect, useState } from "react";
import { getProducts, createProduct, deleteProduct } from "../api";
import type { Product } from "../types";

const BLANK = {
  simulationTypeId: "",
  segmentId: "",
  productName: "",
  productType: "",
  description: "",
};

export default function ProductsPage() {
  
  const [baseVariablesJson, setBaseVariablesJson] = useState("{}");
  const [useChargeoffRate, setUseChargeoffRate] = useState(false);
  const [chargeoffRate, setChargeoffRate] = useState(0);
  const [rows, setRows] = useState<Product[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSimType, setFilterSimType] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [baseVariables, setBaseVariables] = useState<Record<string, number>>({});
  const [bvForm, setBvForm] = useState({ key: "", value: 0 });
  const [editingBvKey, setEditingBvKey] = useState<string | null>(null);

  const resetBvForm = () => {
    setBvForm({ key: "", value: 0 });
    setEditingBvKey(null);
  };

  const handleAdd = () => {
    if (!bvForm.key) return;
    setBaseVariables(bv => ({ ...bv, [bvForm.key]: bvForm.value }));
    resetBvForm();
  };

  const handleEdit = (key: string) => {
    setEditingBvKey(key);
    setBvForm({ key, value: baseVariables[key] });
  };

  const handleRemove = (key: string) => {
    setBaseVariables(bv => {
      const next = { ...bv };
      delete next[key];
      return next;
    });
    if (editingBvKey === key) resetBvForm();
  };

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
        baseVariables: {
          ...baseVariables,
          ...(useChargeoffRate ? { chargeoffRate } : {}),
        },
      });
      setForm({ ...BLANK });
      setBaseVariables({});
      resetBvForm();
      setUseChargeoffRate(false);
      setChargeoffRate(0);
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
          <tr><td>Description</td><td><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></td></tr>
          <tr>
            <td>Base Variables</td>
              <td>
                <table border={1} cellPadding={4}>
                  <thead>
                    <tr><th>key</th><th>value</th><th></th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(baseVariables).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{value}</td>
                        <td>
                          <button onClick={() => handleEdit(key)}>Edit</button>{" "}
                          <button onClick={() => handleRemove(key)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 4 }}>
                  <input
                    placeholder="key"
                    value={bvForm.key}
                    onChange={e => setBvForm(f => ({ ...f, key: e.target.value }))}
                    disabled={!!editingBvKey}
                  />
                  <input
                    type="number"
                    placeholder="value"
                    value={bvForm.value}
                    onChange={e => setBvForm(f => ({ ...f, value: Number(e.target.value) }))}
                  />
                  <button onClick={handleAdd}>{editingBvKey ? "Update" : "Add"} Variable</button>
                  {editingBvKey && <button onClick={resetBvForm}>Cancel</button>}
                </div>
              </td>
            </tr>
          <tr>
            <td>Use Chargeoff Rate</td>
            <td>
              <input
                type="checkbox"
                checked={useChargeoffRate}
                onChange={e => setUseChargeoffRate(e.target.checked)}
              />
              {useChargeoffRate && (
                <>
                  {" "}Rate:{" "}
                  <input
                    type="number"
                    value={chargeoffRate}
                    onChange={e => setChargeoffRate(Number(e.target.value))}
                    style={{ width: 100 }}
                  />
                </>
              )}
            </td>
          </tr>
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
