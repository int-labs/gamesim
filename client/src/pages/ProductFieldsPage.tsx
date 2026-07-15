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
  
  const selectedSimTypeObj = simulationTypes.find((st: any) => st._id === selectedSimType);
  const yearKeys = selectedSimTypeObj?.yearRange
    ? Array.from(
        { length: selectedSimTypeObj.yearRange.end - selectedSimTypeObj.yearRange.start + 1 },
        (_, i) => String(selectedSimTypeObj.yearRange.start + i)
      )
    : [];
// when selectedSimType changes, derive years from config
// e.g. if years run -2 to 5: [-2, -1, 0, 1, 2, 3, 4, 5]

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [fields, setFields] = useState<any[]>([]);
  const [form, setForm] = useState({
    key:          "",
    label:        "",
    type:         "number",
    order:        0,
    required:     false,
    minValue:     null as number | null,
    maxValue:     null as number | null,
    direction:    0.5,
    tightening:   3,
    coefficients: {} as Record<string, number>,
    options: {} as Record<string, number>,
    unitCost: null as number | null,
  });

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
    setForm({
      key:          "",
      label:        "",
      type:         "number",
      order:        0,
      required:     false,
      minValue:     null,
      maxValue:     null,
      direction:    0.5,
      tightening:   3,
      coefficients: Object.fromEntries(yearKeys.map(y => [y, 0])),
      options: {},
      unitCost: null as number | null,
    });
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
          minValue: form.minValue,
          maxValue: form.maxValue,
          direction:    form.direction,
          tightening:   form.tightening,
          coefficients: form.coefficients,
          options: form.options,
          unitCost: form.unitCost,
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
      key:          field.key,
      label:        field.label,
      type:         field.type,
      order:        field.order,
      required:     field.required,
      minValue:     field.minValue ?? null,
      maxValue:     field.maxValue ?? null,
      direction:    field.direction ?? "higher",
      tightening:   field.tightening ?? 3,
      coefficients: Object.fromEntries(yearKeys.map(y => [y, field.coefficients?.[y] ?? 0])),
      options:      field.options ?? {},
      unitCost: field.unitCost ?? null,
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

  const OptionEntryRow = ({ onAdd }: { onAdd: (key: string, value: number) => void }) => {
    const [optKey, setOptKey]         = useState("");
    const [multiplier, setMultiplier] = useState(0);
    return (
      <div style={{ marginTop: 4 }}>
        <input placeholder="option key (e.g. B5)" value={optKey} onChange={e => setOptKey(e.target.value)} />
        <input type="number" step="0.01" placeholder="multiplier" value={multiplier} onChange={e => setMultiplier(Number(e.target.value))} style={{ width: 80 }} />
        <button onClick={() => { if (optKey) { onAdd(optKey, multiplier); setOptKey(""); setMultiplier(0); } }}>Add Option</button>
      </div>
    );
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
                <th>key</th><th>label</th><th>type</th><th>order</th><th>required</th><th>Min</th><th>Max</th><th>Unit Cost</th><th>order</th><th>direction</th><th>tightening</th><th>coefficient</th>
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
                  <td>{f.minValue}</td>
                  <td>{f.maxValue}</td>
                  <td>{f.unitCost}</td>
                  <td>{f.order}</td>
                  <td>{f.direction}</td>
                  <td>{f.tightening}</td>
                  <td>
                    {f.coefficients && Object.keys(f.coefficients).length > 0
                      ? Object.entries(f.coefficients).map(([year, val]) => `${year}: ${val}`).join(", ")
                      : "—"}
                  </td>
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
              placeholder="type"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            />
            {["percentage", "cost", "money", "number"].includes(form.type) && (
              <input
                type="number"
                placeholder="No minimum"
                value={form.minValue ?? ""}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  setForm((f) => ({
                    ...f,
                    minValue: e.target.value === "" || isNaN(parsed) ? null : parsed,
                  }));
                }}
              />
            )}
            {["percentage", "cost", "money", "number"].includes(form.type) && (
              <input
                type="number"
                placeholder="No maximum"
                value={form.maxValue ?? ""}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  setForm((f) => ({
                    ...f,
                    maxValue: e.target.value === "" || isNaN(parsed) ? null : parsed,
                  }));
                }}
              />
            )}
            {form.type === "money" && (
              <input
                type="number"
                placeholder="unit cost (optional)"
                value={form.unitCost ?? ""}
                onChange={e => {
                  const parsed = parseFloat(e.target.value);
                  setForm(f => ({
                    ...f,
                    unitCost: e.target.value === "" || isNaN(parsed) ? null : parsed,
                  }));
                }}
              />
            )}
            <input
              type="number"
              placeholder="order"
              value={form.order}
              onChange={e => setForm({ ...form, order: Number(e.target.value) })}
            />
            <input
              type="number"
              placeholder="direction (0–1)"
              min={0}
              max={1}
              step={0.05}
              value={form.direction}
              onChange={e => setForm(f => ({ ...f, direction: Number(e.target.value) }))}
            />
            <input
              type="number"
              placeholder="Tightening (default: 3)"
              value={form.tightening}
              onChange={(e) =>
                setForm((f) => ({ ...f, tightening: parseFloat(e.target.value) || 3 }))
              }
            />

            {/* Coefficients — dynamic per simulation year */}
            {yearKeys.length === 0 ? (
              <p style={{ color: "orange", fontSize: 11 }}>
                Selected simulation type has no yearRange set — coefficients can't be entered yet.
              </p>
            ) : (
              <div>
                {yearKeys.map(y => (
                  <span key={y} style={{ marginRight: 4 }}>
                    {y}:{" "}
                    <input
                      type="number"
                      style={{ width: 60 }}
                      value={form.coefficients?.[y] ?? 0}
                      onChange={e => setForm(f => ({ ...f, coefficients: { ...f.coefficients, [y]: Number(e.target.value) } }))}
                    />
                  </span>
                ))}
              </div>
            )}

            {/* Options — only for enum type fields */}
            {form.type === "enum" && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ fontSize: 11 }}>Options</strong>
                {Object.keys(form.options ?? {}).length === 0 && (
                  <p style={{ color: "#888", fontSize: 11 }}>No options added yet.</p>
                )}
                <table border={1} cellPadding={2} style={{ fontSize: 11, marginBottom: 4 }}>
                  <thead>
                    <tr><th>key</th><th>multiplier</th><th></th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(form.options ?? {}).map(([optKey, multiplier]) => (
                      <tr key={optKey}>
                        <td>{optKey}</td>
                        <td>{multiplier}</td>
                        <td>
                          <button onClick={() => setForm(f => {
                            const next = { ...f.options };
                            delete next[optKey];
                            return { ...f, options: next };
                          })}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <OptionEntryRow
                  onAdd={(optKey, multiplier) =>
                    setForm(f => ({ ...f, options: { ...f.options, [optKey]: multiplier } }))
                  }
                />
              </div>
            )}

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