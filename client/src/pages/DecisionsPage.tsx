import { useState, useEffect } from "react";
import { getDecisions, deleteDecision } from "../api";

export default function DecisionsPage() {
  const [filterSim, setFilterSim]     = useState("");
  const [filterTeam, setFilterTeam]   = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [rows, setRows]               = useState<any[]>([]);
  const [error, setError]             = useState("");

  const load = async () => {
    if (!filterSim) {
      setRows([]);
      return;
    }
    try {
      const res = await getDecisions(
        filterSim,
        filterTeam || undefined,
        filterRound !== "" ? Number(filterRound) : undefined
      );
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSim, filterTeam, filterRound]);

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

      <label>Filter Sim ID (required): <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>{" "}
      <label>Filter Team ID: <input value={filterTeam} onChange={e => setFilterTeam(e.target.value)} /></label>{" "}
      <label>Filter Round#: <input type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} style={{ width: 60 }} /></label>

      <table border={1} cellPadding={4} style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>_id</th>
            <th>SimId</th>
            <th>TeamId</th>
            <th>Round</th>
            <th>Segment</th>
            <th>Products</th>
            <th>Global Inputs</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r._id}>
              <td>{r._id}</td>
              <td>{r.simulationId}</td>
              <td>{r.teamId}</td>
              <td>{r.roundNumber}</td>
              <td>
                {/* segmentId from first input entry — all entries share the same segment */}
                {r.inputs?.[0]?.segmentId ?? "—"}
              </td>
              <td>
                {(r.inputs ?? []).map((inp: any) => (
                  <div key={inp.productId} style={{ fontSize: 11, marginBottom: 4 }}>
                    <strong>{inp.productName}</strong>
                    <div style={{ paddingLeft: 8 }}>
                      {(inp.fields ?? []).map((f: any) => (
                        <div key={f[0]?.fieldId}>
                          {f[0]?.fieldId}: {f[0]?.value}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </td>
              <td>
                {(r.globalInputs ?? []).length === 0
                  ? "—"
                  : (r.globalInputs ?? []).map((gi: any) => (
                      <div key={gi.globalInputItemId} style={{ fontSize: 11 }}>
                        [{gi.category}] {gi.label}
                        {gi.selectedStepKey ? ` → ${gi.selectedStepKey}` : ""}
                      </div>
                    ))
                }
              </td>
              <td>
                <button onClick={() => handleDelete(r._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}