import { useState, useEffect } from "react";
import { Alert, Button, Card, Checkbox, DataTable, Heading, Input, PageHeader, Select, TextField, type DataTableColumn } from "@stratagem/design-system";
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
      <div className="flex flex-wrap items-end gap-2">
        <Input size="sm" aria-label="option key" placeholder="option key (e.g. B5)" value={optKey} onChange={e => setOptKey(e.target.value)} />
        <Input size="sm" className="w-24" aria-label="multiplier" type="number" step="0.01" placeholder="multiplier" value={multiplier} onChange={e => setMultiplier(Number(e.target.value))} />
        <Button variant="outline" size="sm" onClick={() => { if (optKey) { onAdd(optKey, multiplier); setOptKey(""); setMultiplier(0); } }}>Add Option</Button>
      </div>
    );
  };

  const nullableNumber = (raw: string) => {
    const parsed = parseFloat(raw);
    return raw === "" || isNaN(parsed) ? null : parsed;
  };

  return (
    <>
      <PageHeader title="Product Fields" />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Simulation Type"
          placeholder="-- select --"
          value={selectedSimType || null}
          onValueChange={v => setSelectedSimType(v ?? "")}
          options={simulationTypes.map((st: any) => ({ value: st._id, label: st.name ?? st._id }))}
        />
        <Select
          label="Product"
          placeholder="-- select --"
          value={selectedProductId || null}
          onValueChange={v => { setSelectedProductId(v ?? ""); resetForm(); }}
          disabled={!selectedSimType}
          options={products.map((p: any) => ({ value: p._id, label: p.productName }))}
        />
      </div>

      {selectedProductId && (
        <>
          <Card>
            <Heading level={3}>Fields</Heading>
            <DataTable
              label="Fields"
              density="compact"
              columns={FIELD_COLUMNS}
              rows={fields}
              rowKey={(f: any) => f._id}
              rowActions={(f: any) => (
                <>
                  <Button variant="text" onClick={() => handleEdit(f)}>Edit</Button>
                  <Button variant="text" tone="danger" onClick={() => handleDelete(f._id)}>Delete</Button>
                </>
              )}
            />
          </Card>

          <Card>
            <Heading level={4}>{editingFieldId ? "Edit Field" : "Add Field"}</Heading>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="key"
                placeholder="key"
                value={form.key}
                onChange={e => setForm({ ...form, key: e.target.value })}
                disabled={!!editingFieldId}
              />
              <TextField
                label="label"
                placeholder="label"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
              />
              <TextField
                label="type"
                placeholder="type"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              />
              {["percentage", "cost", "money", "number"].includes(form.type) && (
                <TextField
                  label="Min"
                  type="number"
                  placeholder="No minimum"
                  value={form.minValue ?? ""}
                  onChange={(e) => {
                    const minValue = nullableNumber(e.target.value);
                    setForm((f) => ({ ...f, minValue }));
                  }}
                />
              )}
              {["percentage", "cost", "money", "number"].includes(form.type) && (
                <TextField
                  label="Max"
                  type="number"
                  placeholder="No maximum"
                  value={form.maxValue ?? ""}
                  onChange={(e) => {
                    const maxValue = nullableNumber(e.target.value);
                    setForm((f) => ({ ...f, maxValue }));
                  }}
                />
              )}
              {form.type === "money" && (
                <TextField
                  label="Unit Cost"
                  type="number"
                  placeholder="unit cost (optional)"
                  value={form.unitCost ?? ""}
                  onChange={e => {
                    const unitCost = nullableNumber(e.target.value);
                    setForm(f => ({ ...f, unitCost }));
                  }}
                />
              )}
              <TextField
                label="order"
                type="number"
                placeholder="order"
                value={form.order}
                onChange={e => setForm({ ...form, order: Number(e.target.value) })}
              />
              <TextField
                label="direction (0–1)"
                type="number"
                placeholder="direction (0–1)"
                min={0}
                max={1}
                step={0.05}
                value={form.direction}
                onChange={e => {
                  const direction = Number(e.target.value);
                  setForm(f => ({ ...f, direction }));
                }}
              />
              <TextField
                label="Tightening"
                type="number"
                placeholder="Tightening (default: 3)"
                value={form.tightening}
                onChange={(e) => {
                  const tightening = parseFloat(e.target.value) || 3;
                  setForm((f) => ({ ...f, tightening }));
                }}
              />
            </div>

            {/* Coefficients — dynamic per simulation year */}
            {yearKeys.length === 0 ? (
              <Alert tone="warning">
                Selected simulation type has no yearRange set — coefficients can't be entered yet.
              </Alert>
            ) : (
              <div className="flex flex-wrap gap-2">
                {yearKeys.map(y => (
                  <TextField
                    key={y}
                    label={y}
                    type="number"
                    className="w-24"
                    value={form.coefficients?.[y] ?? 0}
                    onChange={e => {
                      const value = Number(e.target.value);
                      setForm(f => ({ ...f, coefficients: { ...f.coefficients, [y]: value } }));
                    }}
                  />
                ))}
              </div>
            )}

            {/* Options — only for enum type fields */}
            {form.type === "enum" && (
              <Card variant="panel">
                <Heading level={5}>Options</Heading>
                <DataTable
                  label="Options"
                  density="compact"
                  columns={OPTION_COLUMNS}
                  rows={Object.entries(form.options ?? {})}
                  rowKey={([optKey]) => optKey}
                  empty="No options added yet."
                  rowActions={([optKey]) => (
                    <Button variant="text" tone="danger" onClick={() => setForm(f => {
                      const next = { ...f.options };
                      delete next[optKey];
                      return { ...f, options: next };
                    })}>Remove</Button>
                  )}
                />
                <OptionEntryRow
                  onAdd={(optKey, multiplier) =>
                    setForm(f => ({ ...f, options: { ...f.options, [optKey]: multiplier } }))
                  }
                />
              </Card>
            )}

            <label className="flex items-center gap-2 type-label">
              <Checkbox
                checked={form.required}
                onCheckedChange={checked => setForm({ ...form, required: checked })}
              />
              required
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>{editingFieldId ? "Update" : "Add"} Field</Button>
              {editingFieldId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

const FIELD_COLUMNS: DataTableColumn<any>[] = [
  { id: "key", header: "key", cell: f => f.key, primary: true },
  { id: "label", header: "label", cell: f => f.label },
  { id: "type", header: "type", cell: f => f.type },
  { id: "order", header: "order", cell: f => f.order },
  { id: "required", header: "required", cell: f => (f.required ? "yes" : "no") },
  { id: "minValue", header: "Min", cell: f => f.minValue },
  { id: "maxValue", header: "Max", cell: f => f.maxValue },
  { id: "unitCost", header: "Unit Cost", cell: f => f.unitCost },
  { id: "order-2", header: "order", cell: f => f.order },
  { id: "direction", header: "direction", cell: f => f.direction },
  { id: "tightening", header: "tightening", cell: f => f.tightening },
  {
    id: "coefficients",
    header: "coefficient",
    cell: f =>
      f.coefficients && Object.keys(f.coefficients).length > 0
        ? Object.entries(f.coefficients).map(([year, val]) => `${year}: ${val}`).join(", ")
        : "—",
  },
];

const OPTION_COLUMNS: DataTableColumn<[string, number]>[] = [
  { id: "key", header: "key", cell: ([optKey]) => optKey, primary: true },
  { id: "multiplier", header: "multiplier", cell: ([, multiplier]) => multiplier },
];