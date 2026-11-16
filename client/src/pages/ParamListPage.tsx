import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, TextArea, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getParamLists, createParamList, deleteParamList } from "../api";
import type { ParamList } from "../types";

const BLANK = { segmentId: "", productId: "", parameters: "[]" };

export default function ParamListPage() {
  const [rows, setRows] = useState<ParamList[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSegment, setFilterSegment] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getParamLists(filterSegment || undefined, filterProduct || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSegment, filterProduct]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      let parameters: unknown[] = [];
      try { parameters = JSON.parse(form.parameters); } catch { setError("parameters must be valid JSON array"); setLoading(false); return; }
      await createParamList({ segmentId: form.segmentId, productId: form.productId, parameters });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this param list?")) return;
    try {
      await deleteParamList(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <>
      <PageHeader title="Param List" />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Filter Segment ID" value={filterSegment} onChange={e => setFilterSegment(e.target.value)} />
        <TextField label="Filter Product ID" value={filterProduct} onChange={e => setFilterProduct(e.target.value)} />
      </div>

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Segment ID" value={form.segmentId} onChange={e => setForm(f => ({ ...f, segmentId: e.target.value }))} />
          <TextField label="Product ID" value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} />
        </div>
        <TextArea label="Parameters (JSON array)" value={form.parameters} minRows={4} onChange={e => setForm(f => ({ ...f, parameters: e.target.value }))} />
        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Param Lists</Heading>
        <DataTable
          label="All Param Lists"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const COLUMNS: DataTableColumn<ParamList>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "segmentId", header: "SegmentId", cell: r => r.segmentId },
  { id: "productId", header: "ProductId", cell: r => r.productId },
  {
    id: "parameters",
    header: "Parameters",
    cell: r => <pre className="m-0 max-w-72 overflow-auto type-caption">{JSON.stringify(r.parameters, null, 2)}</pre>,
  },
];
