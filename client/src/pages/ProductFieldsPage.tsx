import { useState, useEffect } from "react";
import {
  getSimulationTypes,
  getProducts,
  getProductFields,
  createProductField,
  updateProductField,
  deleteProductField,
} from "../api"; // adjust path to match where the rest of the pages import from

export default function ProductFieldsPage() {
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [fields, setFields] = useState<any[]>([]);
  const [form, setForm] = useState({ key: "", label: "", type: "number", order: 0, required: false });
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSimulationTypes()
      .then(res => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedSimType) {
      setProducts([]);
      setSelectedProductId("");
      return;
    }
    getProducts(selectedSimType)
      .then(res => setProducts(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, [selectedSimType]);

  const loadFields = async () => {
    if (!selectedProductId) {
      setFields([]);
      return;
    }
    try {
      const res = await getProductFields(selectedProductId);
      setFields(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadFields();
  }, [selectedProductId]);

  const resetForm = () => {
    setForm({ key: "", label: "", type: "number", order: 0, required: false });
    setEditingFieldId(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingFieldId) {
        await updateProductField(selectedProductId, editingFieldId, {
          label: form.label,
          type: form.type,
          order: form.order,
          required: form.required,
        });
      } else {
        await createProductField(selectedProductId, form);
      }
      resetForm();
      loadFields();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (field: any) => {
    setEditingFieldId(field._id);
    setForm({
      key: field.key,
      label: field.label,
      type: field.type,
      order: field.order,
      required: field.required,
    });
  };

  const handleDelete = async (fieldId: string) => {
    try {
      await deleteProductField(selectedProductId, fieldId);
      loadFields();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Product Fields</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginBottom: 12 }}>
        <label>
          Simulation Type:{" "}
          <select value={selectedSimType} onChange={e => setSelectedSimType(e.target.value)}>
            <option value="">-- select --</option>
            {simulationTypes.map((st: any) => (
              <option key={st._id} value={st._id}>{st.name ?? st._id}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>
          Product:{" "}
          <select
            value={selectedProductId}
            onChange={e => { setSelectedProductId(e.target.value); resetForm(); }}
            disabled={!selectedSimType}
          >
            <option value="">-- select --</option>
            {products.map((p: any) => (
              <option key={p._id} value={p._id}>{p.productName}</option>
            ))}
          </select>
        </label>
      </div>

      {selectedProductId && (
        <>
          <h3>Fields</h3>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>key</th><th>label</th><th>type</th><th>order</th><th>required</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f: any) => (
                <tr key={f._id}>
                  <td>{f.key}</td>
                  <td>{f.label}</td>
                  <td>{f.type}</td>
                  <td>{f.order}</td>
                  <td>{f.required ? "yes" : "no"}</td>
                  <td>
                    <button onClick={() => handleEdit(f)}>Edit</button>{" "}
                    <button onClick={() => handleDelete(f._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>{editingFieldId ? "Edit Field" : "Add Field"}</h4>
          <div>
            <input
              placeholder="key"
              value={form.key}
              onChange={e => setForm({ ...form, key: e.target.value })}
              disabled={!!editingFieldId}
            />
            <input
              placeholder="label"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
            />
            <input
              placeholder="type (e.g. number, text, drag-drop-image)"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            />
            <input
              type="number"
              placeholder="order"
              value={form.order}
              onChange={e => setForm({ ...form, order: Number(e.target.value) })}
            />
            <label>
              <input
                type="checkbox"
                checked={form.required}
                onChange={e => setForm({ ...form, required: e.target.checked })}
              />
              {" "}required
            </label>
            <button onClick={handleSubmit}>{editingFieldId ? "Update" : "Add"} Field</button>
            {editingFieldId && <button onClick={resetForm}>Cancel</button>}
          </div>
        </>
      )}
    </div>
  );
}