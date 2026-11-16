import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, Text, TextArea, TextField, type DataTableColumn } from "@stratagem/design-system";
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

  return (
    <>
      <PageHeader title="Drivers" />
      {error && <Alert tone="danger">{error}</Alert>}
      <TextField label="Filter Product ID" value={filterProduct} onChange={e => setFilterProduct(e.target.value)} />

      <Card>
        <Heading level={3}>Create</Heading>
        <TextField label="Product ID" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} />
        <TextArea label="Years (JSON)" value={form.years} minRows={3} onChange={e => setForm(f => ({ ...f, years: e.target.value }))} />
        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Drivers</Heading>
        <DataTable
          label="All Drivers"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

function YearsTable({ years }: { years?: Record<string, any> | null }) {
  if (!years) return <Text as="span" tone="faint">—</Text>;

  const yearKeys = Object.keys(years);

  return (
    <div className="flex max-h-72 max-w-96 flex-col gap-2 overflow-auto">
      {yearKeys.map(yearKey => {
        const metrics = years[yearKey] || {};
        const metricKeys = Object.keys(metrics);

        // union of property keys across this year's metrics, in case they differ
        const propertyKeys = Array.from(
          new Set(metricKeys.flatMap(m => Object.keys(metrics[m] || {})))
        );

        const columns: DataTableColumn<string>[] = [
          { id: "metric", header: "metric", cell: m => m, primary: true },
          ...propertyKeys.map(p => ({
            id: p,
            header: p,
            align: "end" as const,
            cell: (m: string) => (metrics[m]?.[p] !== undefined ? String(metrics[m][p]) : ""),
          })),
        ];

        return (
          <div key={yearKey} className="flex flex-col gap-1">
            <Text as="strong" variant="caption" weight="semibold">{yearKey}</Text>
            <DataTable label={yearKey} columns={columns} rows={metricKeys} rowKey={m => m} density="compact" />
          </div>
        );
      })}
    </div>
  );
}

const COLUMNS: DataTableColumn<Driver>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "productId", header: "ProductId", cell: r => r.productId },
  { id: "years", header: "Years (preview)", cell: r => <YearsTable years={r.years} /> },
];
