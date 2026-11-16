import { useState, useEffect } from "react";
import {
  Alert, Badge, Button, Card, Checkbox, DataTable, Heading, IconButton, Input, PageHeader, Select, Text, TextField,
  type DataTableColumn,
} from "@stratagem/design-system";
import { X } from "@stratagem/design-system/icons";
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
  // Which side of the Gross Profit line this item's cost falls on. "opex" is
  // the schema default and restates what the money path did before the field
  // existed — a period cost.
  costTreatment: "opex" as "cogs" | "opex",
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
      costTreatment: item.costTreatment === "cogs" ? "cogs" : "opex",
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
        costTreatment: itemForm.costTreatment,
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
      <div className="flex flex-wrap items-end gap-2">
        <Input size="sm" aria-label="option key" placeholder="option key (e.g. B5)" value={optKey} onChange={e => setOptKey(e.target.value)} />
        <Input size="sm" className="w-24" aria-label="multiplier" type="number" step="0.01" placeholder="multiplier" value={multiplier}
          onChange={e => setMultiplier(Number(e.target.value))} />
        <Button variant="outline" size="sm" onClick={() => { if (optKey) { onAdd(optKey, multiplier); setOptKey(""); setMultiplier(0); } }}>
          Add Option
        </Button>
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const containerColumns: DataTableColumn<any>[] = [
    {
      id: "_id",
      header: "_id",
      cell: (c: any) => (
        <span className="flex items-center gap-2">
          {c._id}
          {selectedContainerId === c._id && <Badge tone="info">managing</Badge>}
        </span>
      ),
    },
    { id: "category", header: "category", cell: (c: any) => c.category },
    { id: "key", header: "key", cell: (c: any) => c.key, primary: true },
    { id: "type", header: "type", cell: (c: any) => c.type },
    { id: "label", header: "label", cell: (c: any) => c.label },
    { id: "maxSelections", header: "maxSelections", cell: (c: any) => c.maxSelections ?? "" },
    { id: "items", header: "# items", cell: (c: any) => c.inputs?.length ?? 0 },
  ];

  return (
    <>
      <PageHeader title="Global Inputs" />
      {error && <Alert tone="danger">{error}</Alert>}

      <Select
        label="Simulation Type"
        placeholder="-- select --"
        value={selectedSimTypeId || null}
        onValueChange={v => setSelectedSimTypeId(v ?? "")}
        options={simulationTypes.map((st: any) => ({ value: st._id, label: st.name ?? st._id }))}
      />

      {selectedSimTypeId && (
        <>
          <Card>
            <Heading level={3}>{editingContainerId ? "Edit" : "Create"} Global Input</Heading>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Category" value={containerForm.category} onChange={e => setContainerForm(f => ({ ...f, category: e.target.value }))} />
              <TextField label="Key" value={containerForm.key} onChange={e => setContainerForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingContainerId} />
              <Select
                label="Type"
                placeholder="-- select type --"
                value={containerForm.type ?? "checkbox"}
                onValueChange={v => setContainerForm(f => ({ ...f, type: v ?? "" }))}
                options={[
                  { value: "", label: "-- select type --" },
                  { value: "radio", label: "radio" },
                  { value: "checkbox", label: "checkbox" },
                  { value: "slider", label: "slider" },
                ]}
              />
              <TextField label="Label" value={containerForm.label} onChange={e => setContainerForm(f => ({ ...f, label: e.target.value }))} />
              <TextField label="Description" value={containerForm.description} onChange={e => setContainerForm(f => ({ ...f, description: e.target.value }))} />
              {containerForm.type !== "slider" && (
                <TextField label="Max Selections" type="number" value={containerForm.maxSelections} onChange={e => setContainerForm(f => ({ ...f, maxSelections: e.target.value }))} />
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleContainerSubmit} disabled={loading}>{editingContainerId ? "Update" : "Create"}</Button>
              {editingContainerId && <Button variant="outline" onClick={resetContainerForm}>Cancel</Button>}
            </div>
          </Card>

          <Card>
            <Heading level={3}>All Global Inputs</Heading>
            <DataTable
              label="All Global Inputs"
              columns={containerColumns}
              rows={containers}
              rowKey={(c: any) => c._id}
              rowActions={(c: any) => (
                <>
                  <Button variant="text" onClick={() => setSelectedContainerId(c._id)}>Manage Items</Button>
                  <Button variant="text" onClick={() => handleContainerEdit(c)}>Edit</Button>
                  <Button variant="text" tone="danger" onClick={() => handleContainerDelete(c._id)}>Delete</Button>
                </>
              )}
            />
          </Card>
        </>
      )}

      {selectedContainer && (
        <Card>
          <Heading level={3}>Items for: {selectedContainer.label}</Heading>

          <DataTable
            label={`Items for ${selectedContainer.label}`}
            density="compact"
            columns={ITEM_COLUMNS}
            rows={selectedContainer.inputs || []}
            rowKey={(item: any) => item._id}
            rowActions={(item: any) => (
              <>
                <Button variant="text" onClick={() => handleItemEdit(item)}>Edit</Button>
                <Button variant="text" tone="danger" onClick={() => handleItemDelete(item._id)}>Delete</Button>
              </>
            )}
          />

          <Heading level={4}>{editingItemId ? "Edit Item" : "Add Item"}</Heading>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Key" value={itemForm.key} onChange={e => setItemForm(f => ({ ...f, key: e.target.value }))} disabled={!!editingItemId} />
            <TextField label="Label" value={itemForm.label} onChange={e => setItemForm(f => ({ ...f, label: e.target.value }))} />
            <TextField label="Description" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
            <TextField label="Min Possible Value" type="number" value={itemForm.minPossibleValue} onChange={e => setItemForm(f => ({ ...f, minPossibleValue: Number(e.target.value) }))} />
            <TextField label="Max Possible Value" type="number" value={itemForm.maxPossibleValue} onChange={e => setItemForm(f => ({ ...f, maxPossibleValue: Number(e.target.value) }))} />
            <TextField label="Min Delta" type="number" value={itemForm.minDelta} onChange={e => setItemForm(f => ({ ...f, minDelta: Number(e.target.value) }))} />
            <TextField label="Max Delta" type="number" value={itemForm.maxDelta} onChange={e => setItemForm(f => ({ ...f, maxDelta: Number(e.target.value) }))} />
            <TextField label="Cost" type="number" value={itemForm.cost} onChange={e => setItemForm(f => ({ ...f, cost: Number(e.target.value) }))} />
            <Select<"cogs" | "opex">
              label="Cost treatment"
              value={itemForm.costTreatment}
              onValueChange={v => v && setItemForm(f => ({ ...f, costTreatment: v }))}
              description="Which side of the Gross Profit line this item's Cost lands on. Scaled by the selected step at scoring time."
              options={[
                { value: "opex", label: "opex — a period cost, below Gross Profit" },
                { value: "cogs", label: "cogs — a cost of goods, above Gross Profit" },
              ]}
            />
            <TextField label="Energy" type="number" value={itemForm.energy} onChange={e => setItemForm(f => ({ ...f, energy: Number(e.target.value) }))} />
            <TextField label="Impact Level" placeholder="(optional)" value={itemForm.impactLevel} onChange={e => setItemForm(f => ({ ...f, impactLevel: e.target.value }))} />
          </div>

          {/* ── Options ── */}
          <Card variant="panel">
            <Heading level={5}>Options</Heading>
            <DataTable
              label="Options"
              density="compact"
              columns={OPTION_COLUMNS}
              rows={Object.entries(itemForm.options ?? {})}
              rowKey={([optKey]) => optKey}
              empty="No options added yet."
              rowActions={([optKey]) => (
                <Button variant="text" tone="danger" onClick={() => setItemForm(f => {
                  const next = { ...f.options }; delete next[optKey]; return { ...f, options: next };
                })}>Remove</Button>
              )}
            />
            <OptionEntryRow onAdd={(optKey, multiplier) =>
              setItemForm(f => ({ ...f, options: { ...f.options, [optKey]: multiplier } }))
            } />
          </Card>

          {/* ── Products Impacted ── */}
          <Card variant="panel">
            <Heading level={5}>Products Impacted</Heading>
            {products.map((p: any) => (
              <label key={p._id} className="flex items-center gap-2 type-body">
                <Checkbox checked={itemForm.productsImpacted.includes(p._id)}
                  onCheckedChange={() => toggleProductImpacted(p._id)} />
                {p.productName}
              </label>
            ))}
          </Card>

          {/* ── Impacts ── */}
          <Card variant="panel">
            <Heading level={5}>Impacts</Heading>
            {Object.entries(itemForm.impacts).map(([impactKey, impact]) => (
              <Card key={impactKey} variant="nested">
                {/* Impact header row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Text as="strong" weight="semibold" className="min-w-20">{impactKey}</Text>
                  <Text as="span">{impact.type}</Text>
                  <Text as="span">default: {impact.value}</Text>
                  <Button variant="text" tone="danger" onClick={() => handleRemoveImpact(impactKey)}>Remove</Button>
                </div>

                {/* Per-product selections */}
                <div className="ms-3 flex flex-col gap-1">
                  <Text variant="caption" tone="muted">Per-product overrides</Text>

                  {impact.selections.length === 0 && (
                    <Text variant="caption" tone="faint">None — all products use default value.</Text>
                  )}

                  {impact.selections.map(sel => {
                    const prod = products.find(p => p._id === sel.productId);
                    return (
                      <div key={sel.productId} className="flex items-center gap-2 type-caption">
                        <span className="min-w-36">{prod?.productName ?? sel.productId}</span>
                        <span>→ {sel.value}</span>
                        <IconButton icon={X} label="Remove override" size="sm" onClick={() => handleRemoveSelection(impactKey, sel.productId)} />
                      </div>
                    );
                  })}

                  {/* Add selection row — only show products in productsImpacted */}
                  <div className="flex flex-wrap items-center gap-1">
                    <Select
                      size="sm"
                      width="fit"
                      aria-label="product"
                      placeholder="pick product…"
                      value={selectionProductInput[impactKey] || null}
                      onValueChange={v => setSelectionProductInput(p => ({ ...p, [impactKey]: v ?? "" }))}
                      options={products
                        .filter(p => itemForm.productsImpacted.includes(p._id))
                        .filter(p => !impact.selections.some(s => s.productId === p._id))
                        .map(p => ({ value: p._id, label: p.productName }))}
                    />
                    <Input
                      size="sm"
                      className="w-20"
                      aria-label="override value"
                      type="number" step="0.01"
                      value={selectionValueInput[impactKey] ?? 0}
                      onChange={e => setSelectionValueInput(v => ({ ...v, [impactKey]: Number(e.target.value) }))}
                    />
                    <Button variant="outline" size="xs" onClick={() => handleAddSelection(impactKey)}>Add</Button>
                  </div>
                </div>
              </Card>
            ))}

            {/* Add new impact key */}
            <div className="flex flex-wrap items-center gap-1">
              <Input size="sm" aria-label="metric key" placeholder="metric key (e.g. sales_channel)" value={impactKeyInput}
                onChange={e => setImpactKeyInput(e.target.value)} />
              <Select
                size="sm"
                width="fit"
                aria-label="impact type"
                value={impactTypeInput}
                onValueChange={v => v && setImpactTypeInput(v)}
                options={[
                  { value: "relative", label: "relative" },
                  { value: "absolute", label: "absolute" },
                ]}
              />
              <Input size="sm" className="w-24" aria-label="impact value" type="number" step="0.0001" value={impactValueInput}
                onChange={e => setImpactValueInput(Number(e.target.value))} />
              <Button variant="outline" size="sm" onClick={handleAddImpact}>Add Impact</Button>
            </div>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleItemSubmit} disabled={loading}>{editingItemId ? "Update" : "Add"} Item</Button>
            {editingItemId && <Button variant="outline" onClick={resetItemForm}>Cancel</Button>}
          </div>
        </Card>
      )}
    </>
  );
}

const ITEM_COLUMNS: DataTableColumn<any>[] = [
  { id: "key", header: "key", cell: (item: any) => item.key, primary: true },
  { id: "label", header: "label", cell: (item: any) => item.label },
  { id: "cost", header: "cost", cell: (item: any) => item.cost },
  {
    id: "treatment",
    header: "treatment",
    // Absent on containers written before the field existed; the money path books those as a period cost
    cell: (item: any) => item.costTreatment ?? <Text as="span" tone="faint">opex*</Text>,
  },
  { id: "energy", header: "energy", cell: (item: any) => item.energy },
  { id: "impactLevel", header: "impactLevel", cell: (item: any) => item.impactLevel },
  {
    id: "impacts",
    header: "impacts",
    cell: (item: any) =>
      Object.entries(item.impacts || {}).map(([k, v]: [string, any]) => (
        <div key={k}>
          <strong>{k}</strong>: {v.type} {v.value}
          {v.selections?.length > 0 && (
            <Text as="span" tone="subtle" className="ms-1">
              (+{v.selections.length} override{v.selections.length > 1 ? "s" : ""})
            </Text>
          )}
        </div>
      )),
  },
  { id: "productsImpacted", header: "productsImpacted", cell: (item: any) => (item.productsImpacted || []).length },
];

const OPTION_COLUMNS: DataTableColumn<[string, unknown]>[] = [
  { id: "key", header: "key", cell: ([optKey]) => optKey, primary: true },
  { id: "multiplier", header: "multiplier", cell: ([, multiplier]) => String(multiplier) },
];
