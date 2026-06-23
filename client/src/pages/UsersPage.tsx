import { useEffect, useState } from "react";
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
    <div>
      <h2>Users</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Email (optional)</td><td><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></td></tr>
          <tr><td>Password</td><td><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></td></tr>
          <tr>
            <td>Role</td>
            <td>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="admin">admin</option>
                <option value="operator">operator</option>
                <option value="client">client</option>
                <option value="team">team</option>
              </select>
            </td>
          </tr>
          <tr><td>Team ID</td><td><input value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} /></td></tr>
          <tr><td>Simulation ID</td><td><input value={form.simulationId} onChange={e => setForm(f => ({ ...f, simulationId: e.target.value }))} /></td></tr>
          <tr><td>Passkey</td><td><input value={form.passkey} onChange={e => setForm(f => ({ ...f, passkey: e.target.value }))} placeholder="leave blank to auto-generate" /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Users</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>Email</th><th>Role</th><th>TeamId</th><th>SimId</th><th>Passkey</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.email ?? "—"}</td>
              <td>{r.role}</td>
              <td>{r.teamId ?? "—"}</td>
              <td>{r.simulationId ?? "—"}</td>
              <td>{r.passkey ?? "—"}</td>
              <td>
                <button onClick={() => handleRegenPasskey(r._id)}>Regen Passkey</button>
                {" "}
                <button onClick={() => handleDelete(r._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
