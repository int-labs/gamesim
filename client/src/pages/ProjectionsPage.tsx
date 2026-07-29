import { useEffect, useState } from "react";
import { getProjections, deleteProjection } from "../api";
import type { Projection } from "../types";

export default function ProjectionsPage() {
  const [rows, setRows] = useState<Projection[]>([]);
  const [filterSim, setFilterSim] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await getProjections(
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this projection?")) return;
    try {
      await deleteProjection(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const hasData = (val: unknown) => val !== null && val !== undefined;

  return (
    <div>
      <h2>Projections</h2>
      <p>Read / Delete only. Projections are written by recalcProjections (not yet implemented).</p>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>Filter Sim ID: <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>
      {" "}
      <label>Filter Team ID: <input value={filterTeam} onChange={e => setFilterTeam(e.target.value)} /></label>
      {" "}
      <label>Filter Round#: <input type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} style={{ width: 60 }} /></label>
      {" "}
      <button onClick={load}>Refresh</button>

      <h3>All Projections</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr><th>_id</th><th>SimId</th><th>TeamId</th><th>Round</th><th>bizperf</th><th>pnl</th><th>balanceSheet</th><th>cashflow</th><th>projections</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationId}</td>
              <td>{r.teamId}</td>
              <td>{r.roundNumber}</td>
              <td>{hasData(r.bizperf) ? "✓" : "null"}</td>
              <td>{hasData(r.pnl) ? "✓" : "null"}</td>
              <td>{hasData(r.balanceSheet) ? "✓" : "null"}</td>
              <td>{hasData(r.cashflow) ? "✓" : "null"}</td>
              <td>{hasData(r.projections) ? "✓" : "null"}</td>
              <td><button onClick={() => handleDelete(r._id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
