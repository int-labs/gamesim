import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, Select, Text, TextArea, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getSimulationTypes, createSimulationType, deleteSimulationType } from "../api";
import type { SimulationType } from "../types";

const BLANK = {
  name: "",
  description: "",
  brandName: "",
  yearRange: { start: 0, end: 0 },
  pastData: {} as Record<string, { marketSize: number; marketGrowth: number }>,
  reportPlacement: { cashflow: "product", pnl: "product", balancesheet: "product", bizperf: "product" },
};

export default function SimulationTypesPage() {
  const [rows, setRows] = useState<SimulationType[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [outputsJson, setOutputsJson] = useState("[]");

  const load = async () => {
    try {
      const res = await getSimulationTypes();
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    const { start, end } = form.yearRange;
    if (start === undefined || end === undefined || end < start) return;

    setForm(f => {
      const nextPastData: Record<string, { marketSize: number; marketGrowth: number }> = {};
      for (let y = start; y <= end; y++) {
        const key = String(y);
        nextPastData[key] = f.pastData?.[key] ?? { marketSize: 0, marketGrowth: 0 };
      }
      return { ...f, pastData: nextPastData };
    });
  }, [form.yearRange.start, form.yearRange.end]);useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      let outputs;
      try {
        outputs = outputsJson.trim() ? JSON.parse(outputsJson) : [];
      } catch {
        setError("Outputs is not valid JSON.");
        setLoading(false);
        return;
      }

      await createSimulationType({ ...form, outputs });
      setForm({ ...BLANK });
      setOutputsJson("[]");
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this simulation type?")) return;
    try {
      await deleteSimulationType(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <>
      <PageHeader title="Simulation Types" />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label="Brand Name" value={form.brandName} onChange={e => setForm(f => ({ ...f, brandName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Year Range Start"
              type="number"
              value={form.yearRange.start}
              onChange={e => setForm(f => ({ ...f, yearRange: { ...f.yearRange, start: Number(e.target.value) } }))}
            />
            <TextField
              label="Year Range End"
              type="number"
              value={form.yearRange.end}
              onChange={e => setForm(f => ({ ...f, yearRange: { ...f.yearRange, end: Number(e.target.value) } }))}
            />
          </div>
        </div>

        <Card variant="panel">
          <Heading level={4}>Past Data</Heading>
          {Object.keys(form.pastData).length === 0 && <Text tone="faint">Set a year range first</Text>}
          {Object.entries(form.pastData).map(([year, data]: [string, any]) => (
            <div key={year} className="flex flex-wrap items-end gap-4">
              <Text as="strong" weight="semibold" className="w-16">{year}</Text>
              <TextField
                label="Market Size"
                type="number"
                value={data.marketSize}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    pastData: { ...f.pastData, [year]: { ...f.pastData[year], marketSize: Number(e.target.value) } },
                  }))
                }
              />
              <TextField
                label="Market Growth"
                type="number"
                step="0.01"
                value={data.marketGrowth}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    pastData: { ...f.pastData, [year]: { ...f.pastData[year], marketGrowth: Number(e.target.value) } },
                  }))
                }
              />
            </div>
          ))}
        </Card>

        <TextArea label="Outputs (JSON)" value={outputsJson} minRows={6} onChange={e => setOutputsJson(e.target.value)} className="font-mono" />

        <Card variant="panel">
          <Heading level={4}>Report Placement</Heading>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["cashflow", "pnl", "balancesheet", "bizperf"] as const).map(key => (
              <Select
                key={key}
                label={key}
                options={PLACEMENT_OPTIONS}
                value={form.reportPlacement[key]}
                onValueChange={v => v && setForm(f => ({ ...f, reportPlacement: { ...f.reportPlacement, [key]: v } }))}
              />
            ))}
          </div>
        </Card>

        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Simulation Types</Heading>
        <DataTable
          label="All Simulation Types"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const PLACEMENT_OPTIONS = [
  { value: "product", label: "product" },
  { value: "global", label: "global" },
];

const COLUMNS: DataTableColumn<SimulationType>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "name", header: "Name", cell: r => r.name, primary: true },
  { id: "description", header: "Description", cell: r => r.description },
  { id: "brandName", header: "Brand", cell: r => r.brandName },
];
