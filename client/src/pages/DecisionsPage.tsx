import { useEffect, useState } from "react";
import { getDecisions, createDecision, deleteDecision } from "../api";
import type { Decision } from "../types";

const BLANK = {
  simulationId: "", teamId: "", roundNumber: 0,
  productId: "", segmentId: "", subProductKey: "", inputs: "{}",
};

export default function DecisionsPage() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSim, setFilterSim] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getDecisions(
        filterSim || undefined,
        filterTeam || undefined,
        filterRound !== "" ? Number(filterRound) : undefined,
      );
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSim, filterTeam, filterRound]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      let inputs = {};
      try { inputs = JSON.parse(form.inputs); } catch { setError("inputs must be valid JSON"); setLoading(false); return; }
      await createDecision({ ...form, roundNumber: Number(form.roundNumber), inputs });
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this decision?")) return;
    try {
      await deleteDecision(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Decisions</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter Sim ID: <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>
      {" "}
      <label>Filter Team ID: <input value={filterTeam} onChange={e => setFilterTeam(e.target.value)} /></label>
      {" "}
      <label>Filter Round#: <input type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} style={{ width: 60 }} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr><td>Simulation ID</td><td><input value={form.simulationId} onChange={e => setForm(f => ({ ...f, simulationId: e.target.value }))} /></td></tr>
          <tr><td>Team ID</td><td><input value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} /></td></tr>
          <tr><td>Round Number</td><td><input type="number" value={form.roundNumber} onChange={e => setForm(f => ({ ...f, roundNumber: Number(e.target.value) }))} /></td></tr>
          <tr><td>Product ID</td><td><input value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} /></td></tr>
          <tr><td>Segment ID</td><td><input value={form.segmentId} onChange={e => setForm(f => ({ ...f, segmentId: e.target.value }))} /></td></tr>
          <tr><td>Sub Product Key</td><td><input value={form.subProductKey} onChange={e => setForm(f => ({ ...f, subProductKey: e.target.value }))} /></td></tr>
          <tr><td>Inputs (JSON)</td><td><textarea value={form.inputs} rows={4} cols={50} onChange={e => setForm(f => ({ ...f, inputs: e.target.value }))} /></td></tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Decisions</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>SimId</th><th>TeamId</th><th>Round</th><th>ProductId</th><th>SegmentId</th><th>SubProductKey</th><th>Inputs</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationId}</td>
              <td>{r.teamId}</td>
              <td>{r.roundNumber}</td>
              <td>{r.productId}</td>
              <td>{r.segmentId}</td>
              <td>{r.subProductKey}</td>
              <td><pre style={{ margin: 0, maxWidth: 200, overflow: "auto", fontSize: 11 }}>{JSON.stringify(r.inputs, null, 2)}</pre></td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
