import { useEffect, useState } from "react";
import { getRounds, createRound, patchRound, deleteRound, calculateRound, endRound, deleteDecisionsByRound, deleteResultsByRound, deleteProjectionsByRound } from "../api";
import type { Round } from "../types";

const BLANK = { simulationId: "", roundNumber: 0, status: "Pending", durationMinutes: "" };

export default function RoundsPage() {
  const [rows, setRows] = useState<Round[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [filterSim, setFilterSim] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Diagnostic readout from ⚡ Calculate, so the counts are visible without
  // reading the server log.
  const [calcResult, setCalcResult] = useState("");

  const load = async () => {
    try {
      const res = await getRounds(filterSim || undefined);
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSim]);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const payload: any = {
        simulationId: form.simulationId,
        roundNumber: Number(form.roundNumber),
        status: form.status,
      };
      if (form.durationMinutes) {
        payload.timer = { durationMinutes: Number(form.durationMinutes) };
      }
      await createRound(payload);
      setForm({ ...BLANK });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (round: any) => {
    if (!confirm(`Reset round ${round.roundNumber}? This will delete all decisions, results and calculated projections for this round.`)) return;
    try {
      // THREE collections. Deleting fewer leaves a round that reports itself
      // reset while still serving old figures.
      await Promise.all([
        deleteDecisionsByRound(round.simulationId, round.roundNumber),
        deleteResultsByRound(round.simulationId, round.roundNumber),
        deleteProjectionsByRound(round.simulationId, round.roundNumber),
      ]);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handlePatch = async (id: string, status: string, durationMinutes?: string) => {
    setError("");
    try {
      const payload: any = { status };
      if (durationMinutes) payload.timer = { durationMinutes: Number(durationMinutes) };
      await patchRound(id, payload);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  // DIAGNOSTIC: `/calculate` runs runRoundCalculation and leaves the round
  // ACTIVE, so it can be clicked repeatedly without flipping the status back.
  // No confirm dialog, for the same reason. It does NOT freeze the round and
  // does NOT advance the simulation — use Close round for the operator flow.
  // See ../../../server/README.md#what-freezes-a-round
  const handleCalculate = async (roundId: string) => {
    setError("");
    setCalcResult("");
    try {
      const res = await calculateRound(roundId);
      setCalcResult(
        `Round ${res.data?.roundNumber ?? "?"} calculated · ` +
        `${res.data?.resultsWritten ?? 0} results · ${res.data?.teamsUpdated ?? 0} teams scored`
      );
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  // The real operator flow: calculate + Complete + advance, atomically.
  const handleCloseRound = async (roundId: string) => {
    if (!confirm(
      "Calculate and close this round?\n\n" +
      "This computes market shares and financials for all teams, marks the round " +
      "Completed so its projections and results can no longer be overwritten, and " +
      "advances the simulation to the next round."
    )) return;
    setError("");
    try {
      await endRound(roundId);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this round?")) return;
    try {
      await deleteRound(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  return (
    <div>
      <h2>Rounds</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {calcResult && <p style={{ color: "green" }}>{calcResult}</p>}

      <label>Filter by Simulation ID: <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>

      <h3>Create</h3>
      <table>
        <tbody>
          <tr>
            <td>Simulation ID</td>
            <td><input value={form.simulationId} onChange={e => setForm(f => ({ ...f, simulationId: e.target.value }))} /></td>
          </tr>
          <tr>
            <td>Round Number</td>
            <td><input type="number" value={form.roundNumber} onChange={e => setForm(f => ({ ...f, roundNumber: Number(e.target.value) }))} /></td>
          </tr>
          <tr>
            <td>Status</td>
            <td>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option>Pending</option>
                <option>Active</option>
                <option>Completed</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>Duration (minutes)</td>
            <td><input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} /></td>
          </tr>
        </tbody>
      </table>
      <button onClick={handleCreate} disabled={loading}>Create</button>

      <h3>All Rounds</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>SimId</th><th>Round#</th><th>Status</th><th>Start</th><th>Duration</th><th>End</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationId}</td>
              <td>{r.roundNumber}</td>
              <td>{r.status}</td>
              <td>{r.timer?.startDate ? new Date(r.timer.startDate).toLocaleString() : ""}</td>
              <td>{r.timer?.durationMinutes ?? ""}</td>
              <td>{r.timer?.endDate ? new Date(r.timer.endDate).toLocaleString() : ""}</td>
              <td>
                {r.status === "Active" && (
                  <button onClick={() => handleCalculate(r._id)} title="Recalculate — leaves the round Active, so it can be run again">⚡ Calculate</button>
                )}
                {r.status === "Active" && (
                  <button onClick={() => handleCloseRound(r._id)} title="Calculate, mark Completed and advance the simulation">🔒 Close round</button>
                )}
                {r.status === "Pending" && (
                  <button onClick={() => handlePatch(r._id, "Active")}>→ Active</button>
                )}
                {r.status === "Active" && (
                  <button onClick={() => handlePatch(r._id, "Completed")}>→ Completed</button>
                )}
                {r.status === "Completed" && (
                  <button onClick={() => handlePatch(r._id, "Active")}>← Active</button>
                )}
                {(r.status === "Active" || r.status === "Completed") && (
                  <button onClick={() => handleReset(r)} style={{ marginLeft: 4, color: "red" }}>↺ Reset</button>
                )}
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
