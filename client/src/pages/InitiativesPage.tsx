import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, TextArea, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getInitiatives, createInitiative, deleteInitiative } from "../api";
import type { Initiative } from "../types";

const BLANK = { name: "", details: "", costConsumption: 0, energyConsumption: 0 };

export default function InitiativesPage() {
  const [rows, setRows] = useState<Initiative[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getInitiatives();
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createInitiative({
        ...form,
        costConsumption: Number(form.costConsumption),
        energyConsumption: Number(form.energyConsumption),
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
    if (!confirm("Delete this initiative?")) return;
    try {
      await deleteInitiative(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <>
      <PageHeader title="Initiatives" />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="Cost Consumption" type="number" value={form.costConsumption} onChange={e => setForm(f => ({ ...f, costConsumption: Number(e.target.value) }))} />
          <TextField label="Energy Consumption" type="number" value={form.energyConsumption} onChange={e => setForm(f => ({ ...f, energyConsumption: Number(e.target.value) }))} />
        </div>
        <TextArea label="Details" value={form.details} minRows={2} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} />
        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Initiatives</Heading>
        <DataTable
          label="All Initiatives"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const COLUMNS: DataTableColumn<Initiative>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "name", header: "Name", cell: r => r.name, primary: true },
  { id: "details", header: "Details", cell: r => r.details },
  { id: "costConsumption", header: "Cost", cell: r => r.costConsumption },
  { id: "energyConsumption", header: "Energy", cell: r => r.energyConsumption },
];
