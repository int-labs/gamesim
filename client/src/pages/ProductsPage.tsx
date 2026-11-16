import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, DataTable, Heading, Input, PageHeader, TextField, type DataTableColumn } from "@stratagem/design-system";
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
    <>
      <PageHeader title="Products" />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Filter Simulation Type ID" value={filterSimType} onChange={e => setFilterSimType(e.target.value)} />
        <TextField label="Filter Segment ID" value={filterSegment} onChange={e => setFilterSegment(e.target.value)} />
      </div>

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Simulation Type ID" value={form.simulationTypeId} onChange={e => setForm(f => ({ ...f, simulationTypeId: e.target.value }))} />
          <TextField label="Segment ID" value={form.segmentId} onChange={e => setForm(f => ({ ...f, segmentId: e.target.value }))} />
          <TextField label="Product Name" value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
          <TextField label="Product Type" value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))} />
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <Card variant="panel">
          <Heading level={4}>Base Variables</Heading>
          <DataTable
            label="Base Variables"
            density="compact"
            columns={BV_COLUMNS}
            rows={Object.entries(baseVariables)}
            rowKey={([key]) => key}
            rowActions={([key]) => (
              <>
                <Button variant="text" onClick={() => handleEdit(key)}>Edit</Button>
                <Button variant="text" tone="danger" onClick={() => handleRemove(key)}>Delete</Button>
              </>
            )}
          />
          <div className="flex flex-wrap items-end gap-2">
            <Input
              aria-label="key"
              placeholder="key"
              value={bvForm.key}
              onChange={e => setBvForm(f => ({ ...f, key: e.target.value }))}
              disabled={!!editingBvKey}
            />
            <Input
              aria-label="value"
              type="number"
              placeholder="value"
              value={bvForm.value}
              onChange={e => setBvForm(f => ({ ...f, value: Number(e.target.value) }))}
            />
            <Button variant="outline" onClick={handleAdd}>{editingBvKey ? "Update" : "Add"} Variable</Button>
            {editingBvKey && <Button variant="text" onClick={resetBvForm}>Cancel</Button>}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 type-label">
            <Checkbox checked={useChargeoffRate} onCheckedChange={checked => setUseChargeoffRate(checked)} />
            Use Chargeoff Rate
          </label>
          {useChargeoffRate && (
            <TextField label="Rate" type="number" value={chargeoffRate} onChange={e => setChargeoffRate(Number(e.target.value))} />
          )}
        </div>

        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Products</Heading>
        <DataTable
          label="All Products"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const BV_COLUMNS: DataTableColumn<[string, number]>[] = [
  { id: "key", header: "key", cell: ([key]) => key, primary: true },
  { id: "value", header: "value", cell: ([, value]) => value },
];

const COLUMNS: DataTableColumn<Product>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "simulationTypeId", header: "SimTypeId", cell: r => r.simulationTypeId },
  { id: "segmentId", header: "SegmentId", cell: r => r.segmentId },
  { id: "productName", header: "Name", cell: r => r.productName, primary: true },
  { id: "productType", header: "Type", cell: r => r.productType },
  { id: "active", header: "Active", cell: r => (r.active ? "✓" : "✗") },
  { id: "order", header: "Order", cell: r => r.order },
];
