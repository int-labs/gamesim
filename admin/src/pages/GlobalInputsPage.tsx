import { useState, useEffect } from "react";
import {
  getSimulationTypes,
  getProducts,
  getGlobalInputs,
  createGlobalInput,
  updateGlobalInput,
  deleteGlobalInput,
  createGlobalInputItem,
  updateGlobalInputItem,
  deleteGlobalInputItem,
} from "../api"; // adjust path to match the rest of the pages

const BLANK_CONTAINER = { category: "", key: "", label: "", description: "", type: "checkbox", maxSelections: "" };
const BLANK_ITEM = {
  key: "", label: "", description: "",
  minPossibleValue: 0, maxPossibleValue: 0, minDelta: 0, maxDelta: 0,
  cost: 0, energy: 0,
  productsImpacted: [] as string[],
  impacts: {} as Record<string, { type: string; value: number }>,
  impactLevel: "",
  options: {} as Record<string, number>,
};

export default function GlobalInputsPage() {
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimTypeId, setSelectedSimTypeId] = useState("");

  const [products, setProducts] = useState<any[]>([]);

  const [containers, setContainers] = useState<any[]>([]);
  const [containerForm, setContainerForm] = useState({ ...BLANK_CONTAINER });
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null);

  const [selectedContainerId, setSelectedContainerId] = useState("");

  const [itemForm, setItemForm] = useState({ ...BLANK_ITEM });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [impactKeyInput, setImpactKeyInput] = useState("");
  const [impactTypeInput, setImpactTypeInput] = useState("relative");
  const [impactValueInput, setImpactValueInput] = useState(0);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSimulationTypes()
      .then(res => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, []);

  const loadContainers = async () => {
    if (!selectedSimTypeId) {
      setContainers([]);
      return;
    }
    try {
      const res = await getGlobalInputs(selectedSimTypeId);
      setContainers(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadContainers();
    setSelectedContainerId("");
    if (!selectedSimTypeId) {
      setProducts([]);
      return;
    }
    getProducts(selectedSimTypeId)
      .then(res => setProducts(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, [selectedSimTypeId]);

  const selectedContainer = containers.find((c: any) => c._id === selectedContainerId);

  // ---- container handlers ----
  const resetContainerForm = () => {
    setContainerForm({ ...BLANK_CONTAINER });
    setEditingContainerId(null);
  };

  const handleContainerSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const payload: any = {
        category: containerForm.category,
        label: containerForm.label,
        description: containerForm.description || null,
        type: containerForm.type || "checkbox",
        maxSelections: containerForm.maxSelections === "" ? null : Number(containerForm.maxSelections),
      };
      if (editingContainerId) {
        await updateGlobalInput(editingContainerId, payload);
      } else {
        await createGlobalInput({ ...payload, simulationTypeId: selectedSimTypeId, key: containerForm.key });
      }
      resetContainerForm();
      await loadContainers();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContainerEdit = (c: any) => {
    setEditingContainerId(c._id);
    setContainerForm({
      category:      c.category,
      key:           c.key,
      label:         c.label,
      description:   c.description ?? "",
      type:          c.type ?? "checkbox",
      maxSelections: c.maxSelections ?? "",
    });
  };

  const handleContainerDelete = async (id: string) => {
    if (!confirm("Delete this global input (and all its items)?")) return;
    try {
      await deleteGlobalInput(id);
      if (selectedContainerId === id) setSelectedContainerId("");
      await loadContainers();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  // ---- item handlers ----
  const resetItemForm = () => {
    setItemForm({ ...BLANK_ITEM });
    setEditingItemId(null);
    setImpactKeyInput("");
    setImpactTypeInput("relative");
    setImpactValueInput(0);
  };

  const handleItemSubmit = async () => {
    if (!selectedContainerId) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        key: itemForm.key,
        label: itemForm.label,
        description: itemForm.description || null,
        minPossibleValue: itemForm.minPossibleValue,
        maxPossibleValue: itemForm.maxPossibleValue,
        minDelta: itemForm.minDelta,
        maxDelta: itemForm.maxDelta,
        cost: Number(itemForm.cost),
        energy: Number(itemForm.energy),
        productsImpacted: itemForm.productsImpacted,
        impacts: itemForm.impacts,
        impactLevel: itemForm.impactLevel || null,
        options: itemForm.options || null,
      };
      if (editingItemId) {
        await updateGlobalInputItem(selectedContainerId, editingItemId, payload);
      } else {
        await createGlobalInputItem(selectedContainerId, payload);
      }
      resetItemForm();
      await loadContainers();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
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

  const handleItemEdit = (item: any) => {
    setEditingItemId(item._id);
    setItemForm({
      key: item.key,
      label: item.label,
      description: item.description ?? "",
      minPossibleValue: item.minPossibleValue ?? 0,
      maxPossibleValue: item.maxPossibleValue ?? 0,
      minDelta: item.minDelta ?? 0,
      maxDelta: item.maxDelta ?? 0,
      cost: item.cost ?? 0,
      energy: item.energy ?? 0,
      productsImpacted: (item.productsImpacted || []).map((p: any) => p?._id ?? p),
      impacts: item.impacts ?? {},
      impactLevel: item.impactLevel ?? "",
      options: item.options ?? {},
    });
  };

  const handleItemDelete = async (itemId: string) => {
    if (!selectedContainerId) return;
    if (!confirm("Delete this item?")) return;
    try {
      await deleteGlobalInputItem(selectedContainerId, itemId);
      if (editingItemId === itemId) resetItemForm();
      await loadContainers();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const toggleProductImpacted = (productId: string) => {
    setItemForm(f => ({
      ...f,
      productsImpacted: f.productsImpacted.includes(productId)
        ? f.productsImpacted.filter(id => id !== productId)
        : [...f.productsImpacted, productId],
    }));
  };

  const handleAddImpact = () => {
    if (!impactKeyInput) return;
    setItemForm(f => ({ ...f, impacts: { ...f.impacts, [impactKeyInput]: { type: impactTypeInput, value: impactValueInput } } }));
    setImpactKeyInput("");
    setImpactTypeInput("relative");
    setImpactValueInput(0);
  };

  const handleRemoveImpact = (metricKey: string) => {
    setItemForm(f => {
      const next = { ...f.impacts };
      delete next[metricKey];
      return { ...f, impacts: next };
    });
  };

  return (
    <div>
      <h2>Global Inputs</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>
        Simulation Type:{" "}
        <select value={selectedSimTypeId} onChange={e => setSelectedSimTypeId(e.target.value)}>
          <option value="">-- select --</option>
          {simulationTypes.map((st: any) => (
            <option key={st._id} value={st._id}>{st.name ?? st._id}</option>
          ))}
        </select>
      </label>

      {selectedSimTypeId && (
        <>
          <h3>{editingContainerId ? "Edit" : "Create"} Global Input</h3>
          <table>
            <tbody>
              <tr><td>Category</td><td><input value={containerForm.category} onChange={e => setContainerForm(f => ({ ...f, category: e.target.value }))} /></td></tr>
              <tr><td>Key</td><td><input value={containerForm.key} onChange={e => setContainerForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingContainerId} /></td></tr>
              <tr>
                <td>Type</td>
                <td>
                  <select
                    value={containerForm.type ?? "checkbox"}
                    onChange={e => setContainerForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <option value="">-- select type --</option>
                    <option value="radio">radio</option>
                    <option value="checkbox">checkbox</option>
                    <option value="slider">slider</option>
                  </select>
                </td>
              </tr>
              <tr><td>Label</td><td><input value={containerForm.label} onChange={e => setContainerForm(f => ({ ...f, label: e.target.value }))} /></td></tr>
              <tr><td>Description</td><td><input value={containerForm.description} onChange={e => setContainerForm(f => ({ ...f, description: e.target.value }))} /></td></tr>
              {containerForm.type !== "slider" && (
                <tr>
                  <td>Max Selections</td>
                  <td><input type="number" value={containerForm.maxSelections} onChange={e => setContainerForm(f => ({ ...f, maxSelections: e.target.value }))} /></td>
                </tr>
              )}
            </tbody>
          </table>
          <button onClick={handleContainerSubmit} disabled={loading}>{editingContainerId ? "Update" : "Create"}</button>
          {editingContainerId && <button onClick={resetContainerForm}>Cancel</button>}

          <h3>All Global Inputs</h3>
          <table border={1} cellPadding={4}>
            <thead>
              <tr><th>_id</th><th>category</th><th>key</th><th>type</th><th>label</th><th>maxSelections</th><th># items</th><th>actions</th></tr>
            </thead>
            <tbody>
              {containers.map((c: any) => (
                <tr key={c._id} style={{ background: selectedContainerId === c._id ? "#eef" : "transparent" }}>
                  <td>{c._id}</td>
                  <td>{c.category}</td>
                  <td>{c.key}</td>
                  <td>{c.type}</td>
                  <td>{c.label}</td>
                  <td>{c.maxSelections ?? ""}</td>
                  <td>{c.inputs?.length ?? 0}</td>
                  <td>
                    <button onClick={() => setSelectedContainerId(c._id)}>Manage Items</button>{" "}
                    <button onClick={() => handleContainerEdit(c)}>Edit</button>{" "}
                    <button onClick={() => handleContainerDelete(c._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {selectedContainer && (
        <div style={{ border: "1px solid #ccc", padding: 8, marginTop: 12 }}>
          <h3>Items for: {selectedContainer.label}</h3>

          <table border={1} cellPadding={4} style={{ fontSize: 11 }}>
            <thead>
              <tr><th>key</th><th>label</th><th>type</th><th>cost</th><th>energy</th><th>impactLevel</th><th>impacts</th><th>productsImpacted</th><th></th></tr>
            </thead>
            <tbody>
              {(selectedContainer.inputs || []).map((item: any) => (
                <tr key={item._id}>
                  <td>{item.key}</td>
                  <td>{item.label}</td>
                  <td>{item.type}</td>
                  <td>{item.cost}</td>
                  <td>{item.energy}</td>
                  <td>{item.impactLevel}</td>
                  <td>{Object.entries(item.impacts || {}).map(([k, v]: [string, any]) => `${k}: ${v.type} ${v.value}`).join(", ")}</td>
                  <td>{(item.productsImpacted || []).length}</td>
                  <td>
                    <button onClick={() => handleItemEdit(item)}>Edit</button>{" "}
                    <button onClick={() => handleItemDelete(item._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>{editingItemId ? "Edit Item" : "Add Item"}</h4>
          <table>
            <tbody>
              <tr><td>Key</td><td><input value={itemForm.key} onChange={e => setItemForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingItemId} /></td></tr>
              <tr><td>Label</td><td><input value={itemForm.label} onChange={e => setItemForm(f => ({ ...f, label: e.target.value }))} /></td></tr>
              <tr><td>Description</td><td><input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} /></td></tr>
              <tr><td>Min Possible Value</td><td><input type="number" value={itemForm.minPossibleValue} onChange={e => setItemForm(f => ({ ...f, minPossibleValue: Number(e.target.value) }))} /></td></tr>
              <tr><td>Max Possible Value</td><td><input type="number" value={itemForm.maxPossibleValue} onChange={e => setItemForm(f => ({ ...f, maxPossibleValue: Number(e.target.value) }))} /></td></tr>
              <tr><td>Min Delta</td><td><input type="number" value={itemForm.minDelta} onChange={e => setItemForm(f => ({ ...f, minDelta: Number(e.target.value) }))} /></td></tr>
              <tr><td>Max Delta</td><td><input type="number" value={itemForm.maxDelta} onChange={e => setItemForm(f => ({ ...f, maxDelta: Number(e.target.value) }))} /></td></tr>
              <tr><td>Cost</td><td><input type="number" value={itemForm.cost} onChange={e => setItemForm(f => ({ ...f, cost: Number(e.target.value) }))} /></td></tr>
              <tr><td>Energy</td><td><input type="number" value={itemForm.energy} onChange={e => setItemForm(f => ({ ...f, energy: Number(e.target.value) }))} /></td></tr>
              <tr><td>Impact Level</td><td><input placeholder="(optional)" value={itemForm.impactLevel} onChange={e => setItemForm(f => ({ ...f, impactLevel: e.target.value }))} /></td></tr>
              <tr>
                <td>Options</td>
                <td>
                  {Object.keys(itemForm.options ?? {}).length === 0 && (
                    <p style={{ color: "#888", fontSize: 11 }}>No options added yet.</p>
                  )}
                  <table border={1} cellPadding={2} style={{ fontSize: 11, marginBottom: 4 }}>
                    <thead><tr><th>key</th><th>multiplier</th><th></th></tr></thead>
                    <tbody>
                      {Object.entries(itemForm.options ?? {}).map(([optKey, multiplier]) => (
                        <tr key={optKey}>
                          <td>{optKey}</td>
                          <td>{String(multiplier)}</td>
                          <td>
                            <button onClick={() => setItemForm(f => {
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
                      setItemForm(f => ({ ...f, options: { ...f.options, [optKey]: multiplier } }))
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>Products Impacted</td>
                <td>
                  {products.map((p: any) => (
                    <label key={p._id} style={{ display: "block" }}>
                      <input
                        type="checkbox"
                        checked={itemForm.productsImpacted.includes(p._id)}
                        onChange={() => toggleProductImpacted(p._id)}
                      />
                      {" "}{p.productName}
                    </label>
                  ))}
                </td>
              </tr>
              <tr>
                <td>Impacts</td>
                <td>
                  <table border={1} cellPadding={2} style={{ fontSize: 11 }}>
                    <thead><tr><th>metric</th><th>type</th><th>value</th><th></th></tr></thead>
                    <tbody>
                      {Object.entries(itemForm.impacts).map(([metricKey, v]: [string, any]) => (
                        <tr key={metricKey}>
                          <td>{metricKey}</td>
                          <td>{v.type}</td>
                          <td>{v.value}</td>
                          <td><button onClick={() => handleRemoveImpact(metricKey)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <input placeholder="metric key (e.g. revenue)" value={impactKeyInput} onChange={e => setImpactKeyInput(e.target.value)} />
                  <select value={impactTypeInput} onChange={e => setImpactTypeInput(e.target.value)}>
                    <option value="relative">relative</option>
                    <option value="absolute">absolute</option>
                  </select>
                  <input type="number" step="0.0001" value={impactValueInput} onChange={e => setImpactValueInput(Number(e.target.value))} />
                  <button onClick={handleAddImpact}>Add Impact</button>
                </td>
              </tr>
            </tbody>
          </table>
          <button onClick={handleItemSubmit} disabled={loading}>{editingItemId ? "Update" : "Add"} Item</button>
          {editingItemId && <button onClick={resetItemForm}>Cancel</button>}
        </div>
      )}
    </div>
  );
}