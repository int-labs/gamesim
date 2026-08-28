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
} from "../api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImpactSelection {
  productId: string;
  value: number;
}

interface ImpactValue {
  type: string;
  value: number;
  selections: ImpactSelection[];
}

// ── Blank state ───────────────────────────────────────────────────────────────

const BLANK_CONTAINER = { category: "", key: "", label: "", description: "", type: "checkbox", maxSelections: "" };
const BLANK_ITEM = {
  key: "", label: "", description: "",
  minPossibleValue: 0, maxPossibleValue: 0, minDelta: 0, maxDelta: 0,
  cost: 0, energy: 0,
  productsImpacted: [] as string[],
  impacts: {} as Record<string, ImpactValue>,
  impactLevel: "",
  options: {} as Record<string, number>,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobalInputsPage() {
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimTypeId, setSelectedSimTypeId] = useState("");
  const [products, setProducts] = useState<any[]>([]);

  // Container state
  const [containers, setContainers] = useState<any[]>([]);
  const [containerForm, setContainerForm] = useState({ ...BLANK_CONTAINER });
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState("");

  // Item state
  const [itemForm, setItemForm] = useState({ ...BLANK_ITEM });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Impact entry inputs
  const [impactKeyInput, setImpactKeyInput] = useState("");
  const [impactTypeInput, setImpactTypeInput] = useState("relative");
  const [impactValueInput, setImpactValueInput] = useState(0);

  // Per-impact selections entry inputs — keyed by impactKey
  const [selectionProductInput, setSelectionProductInput] = useState<Record<string, string>>({});
  const [selectionValueInput, setSelectionValueInput] = useState<Record<string, number>>({});

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    getSimulationTypes()
      .then(res => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, []);

  const loadContainers = async () => {
    if (!selectedSimTypeId) { setContainers([]); return; }
    try {
      const res = await getGlobalInputs(selectedSimTypeId);
      setContainers(res.data?.data ?? res.data);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => {
    loadContainers();
    setSelectedContainerId("");
    if (!selectedSimTypeId) { setProducts([]); return; }
    getProducts(selectedSimTypeId)
      .then(res => setProducts(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, [selectedSimTypeId]);

  const selectedContainer = containers.find((c: any) => c._id === selectedContainerId);

  // ── Container handlers ──────────────────────────────────────────────────────

  const resetContainerForm = () => { setContainerForm({ ...BLANK_CONTAINER }); setEditingContainerId(null); };

  const handleContainerSubmit = async () => {
    setLoading(true); setError("");
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
    } finally { setLoading(false); }
  };

  const handleContainerEdit = (c: any) => {
    setEditingContainerId(c._id);
    setContainerForm({
      category: c.category, key: c.key, label: c.label,
      description: c.description ?? "", type: c.type ?? "checkbox",
      maxSelections: c.maxSelections ?? "",
    });
  };

  const handleContainerDelete = async (id: string) => {
    if (!confirm("Delete this global input (and all its items)?")) return;
    try {
      await deleteGlobalInput(id);
      if (selectedContainerId === id) setSelectedContainerId("");
      await loadContainers();
    } catch (e: any) { setError(e.response?.data?.message ?? e.message); }
  };

  // ── Item handlers ───────────────────────────────────────────────────────────

  const resetItemForm = () => {
    setItemForm({ ...BLANK_ITEM });
    setEditingItemId(null);
    setImpactKeyInput(""); setImpactTypeInput("relative"); setImpactValueInput(0);
    setSelectionProductInput({}); setSelectionValueInput({});
  };

  const normaliseImpacts = (raw: Record<string, any>): Record<string, ImpactValue> => {
    const out: Record<string, ImpactValue> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      out[k] = {
        type: v.type ?? "relative",
        value: v.value ?? 0,
        selections: (v.selections ?? []).map((s: any) => ({
          productId: s.productId?.$oid ?? s.productId ?? s,
          value: s.value ?? 0,
        })),
      };
    }
    return out;
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
      impacts: normaliseImpacts(item.impacts ?? {}),
      impactLevel: item.impactLevel ?? "",
      options: item.options ?? {},
    });
    setSelectionProductInput({});
    setSelectionValueInput({});
  };

  const handleItemSubmit = async () => {
    if (!selectedContainerId) return;
    setLoading(true); setError("");
    try {
      // Strip empty selections arrays before sending so the payload stays clean
      const impacts: Record<string, any> = {};
      for (const [k, v] of Object.entries(itemForm.impacts)) {
        impacts[k] = {
          type: v.type,
          value: v.value,
          ...(v.selections.length > 0 ? { selections: v.selections } : {}),
        };
      }
      const payload = {
        key: itemForm.key, label: itemForm.label,
        description: itemForm.description || null,
        minPossibleValue: itemForm.minPossibleValue,
        maxPossibleValue: itemForm.maxPossibleValue,
        minDelta: itemForm.minDelta, maxDelta: itemForm.maxDelta,
        cost: Number(itemForm.cost), energy: Number(itemForm.energy),
        productsImpacted: itemForm.productsImpacted,
        impacts,
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
    } finally { setLoading(false); }
  };

  const handleItemDelete = async (itemId: string) => {
    if (!selectedContainerId) return;
    if (!confirm("Delete this item?")) return;
    try {
      await deleteGlobalInputItem(selectedContainerId, itemId);
      if (editingItemId === itemId) resetItemForm();
      await loadContainers();
    } catch (e: any) { setError(e.response?.data?.message ?? e.message); }
  };

  // ── Impact handlers ─────────────────────────────────────────────────────────

  const handleAddImpact = () => {
    if (!impactKeyInput) return;
    setItemForm(f => ({
      ...f,
      impacts: {
        ...f.impacts,
        [impactKeyInput]: { type: impactTypeInput, value: impactValueInput, selections: [] },
      },
    }));
    setImpactKeyInput(""); setImpactTypeInput("relative"); setImpactValueInput(0);
  };

  const handleRemoveImpact = (key: string) => {
    setItemForm(f => { const next = { ...f.impacts }; delete next[key]; return { ...f, impacts: next }; });
  };

  // ── Selection handlers (per impact key) ────────────────────────────────────

  const handleAddSelection = (impactKey: string) => {
    const productId = selectionProductInput[impactKey] ?? "";
    const value = selectionValueInput[impactKey] ?? 0;
    if (!productId) return;
    setItemForm(f => {
      const impact = f.impacts[impactKey];
      if (!impact) return f;
      const already = impact.selections.some(s => s.productId === productId);
      if (already) return f;
      return {
        ...f,
        impacts: {
          ...f.impacts,
          [impactKey]: { ...impact, selections: [...impact.selections, { productId, value }] },
        },
      };
    });
    setSelectionProductInput(p => ({ ...p, [impactKey]: "" }));
    setSelectionValueInput(v => ({ ...v, [impactKey]: 0 }));
  };

  const handleRemoveSelection = (impactKey: string, productId: string) => {
    setItemForm(f => {
      const impact = f.impacts[impactKey];
      if (!impact) return f;
      return {
        ...f,
        impacts: {
          ...f.impacts,
          [impactKey]: { ...impact, selections: impact.selections.filter(s => s.productId !== productId) },
        },
      };
    });
  };

  // ── Misc ────────────────────────────────────────────────────────────────────

  const toggleProductImpacted = (productId: string) => {
    setItemForm(f => ({
      ...f,
      productsImpacted: f.productsImpacted.includes(productId)
        ? f.productsImpacted.filter(id => id !== productId)
        : [...f.productsImpacted, productId],
    }));
  };

  const OptionEntryRow = ({ onAdd }: { onAdd: (key: string, value: number) => void }) => {
    const [optKey, setOptKey] = useState("");
    const [multiplier, setMultiplier] = useState(0);
    return (
      <div style={{ marginTop: 4 }}>
        <input placeholder="option key (e.g. B5)" value={optKey} onChange={e => setOptKey(e.target.value)} />
        <input type="number" step="0.01" placeholder="multiplier" value={multiplier}
          onChange={e => setMultiplier(Number(e.target.value))} style={{ width: 80 }} />
        <button onClick={() => { if (optKey) { onAdd(optKey, multiplier); setOptKey(""); setMultiplier(0); } }}>
          Add Option
        </button>
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

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
          <table><tbody>
            <tr><td>Category</td><td><input value={containerForm.category} onChange={e => setContainerForm(f => ({ ...f, category: e.target.value }))} /></td></tr>
            <tr><td>Key</td><td><input value={containerForm.key} onChange={e => setContainerForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingContainerId} /></td></tr>
            <tr>
              <td>Type</td>
              <td>
                <select value={containerForm.type ?? "checkbox"} onChange={e => setContainerForm(f => ({ ...f, type: e.target.value }))}>
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
          </tbody></table>
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
                  <td>{c._id}</td><td>{c.category}</td><td>{c.key}</td><td>{c.type}</td>
                  <td>{c.label}</td><td>{c.maxSelections ?? ""}</td><td>{c.inputs?.length ?? 0}</td>
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
              <tr><th>key</th><th>label</th><th>cost</th><th>energy</th><th>impactLevel</th><th>impacts</th><th>productsImpacted</th><th></th></tr>
            </thead>
            <tbody>
              {(selectedContainer.inputs || []).map((item: any) => (
                <tr key={item._id}>
                  <td>{item.key}</td>
                  <td>{item.label}</td>
                  <td>{item.cost}</td>
                  <td>{item.energy}</td>
                  <td>{item.impactLevel}</td>
                  <td>
                    {Object.entries(item.impacts || {}).map(([k, v]: [string, any]) => (
                      <div key={k}>
                        <strong>{k}</strong>: {v.type} {v.value}
                        {v.selections?.length > 0 && (
                          <span style={{ color: "#888", marginLeft: 4 }}>
                            (+{v.selections.length} override{v.selections.length > 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                    ))}
                  </td>
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
          <table><tbody>
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

            {/* ── Options ── */}
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
                            const next = { ...f.options }; delete next[optKey]; return { ...f, options: next };
                          })}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <OptionEntryRow onAdd={(optKey, multiplier) =>
                  setItemForm(f => ({ ...f, options: { ...f.options, [optKey]: multiplier } }))
                } />
              </td>
            </tr>

            {/* ── Products Impacted ── */}
            <tr>
              <td>Products Impacted</td>
              <td>
                {products.map((p: any) => (
                  <label key={p._id} style={{ display: "block" }}>
                    <input type="checkbox" checked={itemForm.productsImpacted.includes(p._id)}
                      onChange={() => toggleProductImpacted(p._id)} />
                    {" "}{p.productName}
                  </label>
                ))}
              </td>
            </tr>

            {/* ── Impacts ── */}
            <tr>
              <td valign="top">Impacts</td>
              <td>
                {Object.entries(itemForm.impacts).map(([impactKey, impact]) => (
                  <div key={impactKey} style={{ border: "1px solid #ddd", padding: 6, marginBottom: 6 }}>
                    {/* Impact header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <strong style={{ minWidth: 80 }}>{impactKey}</strong>
                      <span>{impact.type}</span>
                      <span>default: {impact.value}</span>
                      <button onClick={() => handleRemoveImpact(impactKey)}>Remove</button>
                    </div>

                    {/* Per-product selections */}
                    <div style={{ marginLeft: 12 }}>
                      <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Per-product overrides</div>

                      {impact.selections.length === 0 && (
                        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>None — all products use default value.</div>
                      )}

                      {impact.selections.map(sel => {
                        const prod = products.find(p => p._id === sel.productId);
                        return (
                          <div key={sel.productId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 2 }}>
                            <span style={{ minWidth: 140 }}>{prod?.productName ?? sel.productId}</span>
                            <span>→ {sel.value}</span>
                            <button onClick={() => handleRemoveSelection(impactKey, sel.productId)}>×</button>
                          </div>
                        );
                      })}

                      {/* Add selection row — only show products in productsImpacted */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <select
                          value={selectionProductInput[impactKey] ?? ""}
                          onChange={e => setSelectionProductInput(p => ({ ...p, [impactKey]: e.target.value }))}
                          style={{ fontSize: 11 }}
                        >
                          <option value="">pick product…</option>
                          {products
                            .filter(p => itemForm.productsImpacted.includes(p._id))
                            .filter(p => !impact.selections.some(s => s.productId === p._id))
                            .map(p => (
                              <option key={p._id} value={p._id}>{p.productName}</option>
                            ))
                          }
                        </select>
                        <input
                          type="number" step="0.01"
                          value={selectionValueInput[impactKey] ?? 0}
                          onChange={e => setSelectionValueInput(v => ({ ...v, [impactKey]: Number(e.target.value) }))}
                          style={{ width: 70, fontSize: 11 }}
                        />
                        <button style={{ fontSize: 11 }} onClick={() => handleAddSelection(impactKey)}>Add</button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add new impact key */}
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <input placeholder="metric key (e.g. sales_channel)" value={impactKeyInput}
                    onChange={e => setImpactKeyInput(e.target.value)} />
                  <select value={impactTypeInput} onChange={e => setImpactTypeInput(e.target.value)}>
                    <option value="relative">relative</option>
                    <option value="absolute">absolute</option>
                  </select>
                  <input type="number" step="0.0001" value={impactValueInput}
                    onChange={e => setImpactValueInput(Number(e.target.value))} style={{ width: 80 }} />
                  <button onClick={handleAddImpact}>Add Impact</button>
                </div>
              </td>
            </tr>
          </tbody></table>

          <button onClick={handleItemSubmit} disabled={loading}>{editingItemId ? "Update" : "Add"} Item</button>
          {editingItemId && <button onClick={resetItemForm}>Cancel</button>}
        </div>
      )}
    </div>
  );
}
