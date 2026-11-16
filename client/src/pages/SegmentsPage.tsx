import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, Input, PageHeader, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getSegments, createSegment, updateSegment, deleteSegment, activateSegment, deactivateSegment } from "../api";
import type { Segment } from "../types";

const BLANK = { simulationTypeId: "", name: "", description: "", key: "", icon: "", order: 0 };

export default function SegmentsPage() {
  const [rows, setRows]               = useState<Segment[]>([]);
  const [form, setForm]               = useState({ ...BLANK });
  const [filterSimType, setFilterSimType] = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editForm, setEditForm]       = useState({ name: "", description: "", key: "", icon: "", order: 0 });

  const load = async () => {
    try {
      const res = await getSegments(filterSimType || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSimType]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createSegment({ ...form, order: Number(form.order), active: true });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (r: any) => {
    setEditingId(r._id);
    setEditForm({
      name:        r.name        ?? "",
      description: r.description ?? "",
      key:         r.key         ?? "",
      icon:        r.icon        ?? "",
      order:       r.order       ?? 0,
    });
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateSegment(id, { ...editForm, order: Number(editForm.order) });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this segment? Products will also be deactivated.")) return;
    try {
      await deleteSegment(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handleActivate = async (id: string) => {
    try { await activateSegment(id); await load(); }
    catch (e: any) { setError(e.response?.data?.message ?? e.message); }
  };

  const handleDeactivate = async (id: string) => {
    try { await deactivateSegment(id); await load(); }
    catch (e: any) { setError(e.response?.data?.message ?? e.message); }
  };

  const editing = (r: Segment) => editingId === r._id;

  const columns: DataTableColumn<Segment>[] = [
    { id: "_id", header: "_id", cell: r => r._id },
    { id: "simulationTypeId", header: "SimTypeId", cell: r => r.simulationTypeId },
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: r => editing(r)
        ? <Input size="sm" aria-label="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
        : r.name,
    },
    {
      id: "key",
      header: "Key",
      cell: r => editing(r)
        ? <Input size="sm" aria-label="Key" value={editForm.key} onChange={e => setEditForm(f => ({ ...f, key: e.target.value }))} />
        : r.key,
    },
    {
      id: "icon",
      header: "Icon",
      cell: r => editing(r)
        ? <Input size="sm" aria-label="Icon" value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))} />
        : r.icon,
    },
    {
      id: "description",
      header: "Description",
      cell: r => editing(r)
        ? <Input size="sm" aria-label="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
        : r.description,
    },
    { id: "active", header: "Active", cell: r => (r.active ? "✓" : "✗") },
    {
      id: "order",
      header: "Order",
      cell: r => editing(r)
        ? <Input size="sm" type="number" aria-label="Order" value={editForm.order} onChange={e => setEditForm(f => ({ ...f, order: Number(e.target.value) }))} />
        : r.order,
    },
  ];

  return (
    <>
      <PageHeader title="Segments" />
      {error && <Alert tone="danger">{error}</Alert>}

      <TextField label="Filter by Simulation Type ID" value={filterSimType} onChange={e => setFilterSimType(e.target.value)} />

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Simulation Type ID" value={form.simulationTypeId} onChange={e => setForm(f => ({ ...f, simulationTypeId: e.target.value }))} />
          <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <TextField label="Key" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} />
          <TextField label="Icon" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
          <TextField label="Order" type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
        </div>
        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Segments</Heading>
        <DataTable
          label="All Segments"
          columns={columns}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => editing(r) ? (
            <>
              <Button variant="text" onClick={() => handleUpdate(r._id)}>Save</Button>
              <Button variant="text" onClick={() => setEditingId(null)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="text" onClick={() => handleEditStart(r)}>Edit</Button>
              {r.active
                ? <Button variant="text" onClick={() => handleDeactivate(r._id)}>Deactivate</Button>
                : <Button variant="text" onClick={() => handleActivate(r._id)}>Activate</Button>}
              <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>
            </>
          )}
        />
      </Card>
    </>
  );
}