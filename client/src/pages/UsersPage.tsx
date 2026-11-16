import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, PasswordField, Select, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getUsers, createUser, deleteUser, regeneratePasskey } from "../api";
import type { User } from "../types";

const BLANK = { email: "", password: "", role: "team", teamId: "", simulationId: "", passkey: "" };

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getUsers();
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
      const payload: any = { role: form.role, password: form.password };
      if (form.email) payload.email = form.email;
      if (form.teamId) payload.teamId = form.teamId;
      if (form.simulationId) payload.simulationId = form.simulationId;
      if (form.passkey) payload.passkey = form.passkey;
      await createUser(payload);
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      await deleteUser(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handleRegenPasskey = async (id: string) => {
    try {
      const res = await regeneratePasskey(id);
      alert(`New passkey: ${res.data?.passkey ?? JSON.stringify(res.data)}`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <>
      <PageHeader title="Users" />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Email (optional)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <PasswordField label="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <Select label="Role" options={ROLE_OPTIONS} value={form.role} onValueChange={v => v && setForm(f => ({ ...f, role: v }))} />
          <TextField label="Team ID" value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} />
          <TextField label="Simulation ID" value={form.simulationId} onChange={e => setForm(f => ({ ...f, simulationId: e.target.value }))} />
          <TextField label="Passkey" value={form.passkey} onChange={e => setForm(f => ({ ...f, passkey: e.target.value }))} placeholder="leave blank to auto-generate" />
        </div>
        <Button className="self-start" onClick={handleCreate} disabled={loading}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Users</Heading>
        <DataTable
          label="All Users"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => (
            <>
              <Button variant="text" onClick={() => handleRegenPasskey(r._id)}>Regen Passkey</Button>
              <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>
            </>
          )}
        />
      </Card>
    </>
  );
}

const ROLE_OPTIONS = ["admin", "operator", "client", "team"].map(role => ({ value: role, label: role }));

const COLUMNS: DataTableColumn<User>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "email", header: "Email", cell: r => r.email ?? "—", primary: true },
  { id: "role", header: "Role", cell: r => r.role },
  { id: "teamId", header: "TeamId", cell: r => r.teamId ?? "—" },
  { id: "simulationId", header: "SimId", cell: r => r.simulationId ?? "—" },
  { id: "passkey", header: "Passkey", cell: r => r.passkey ?? "—" },
];
