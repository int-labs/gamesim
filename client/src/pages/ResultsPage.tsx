import { useEffect, useState } from "react";
import { getResults, downloadRoundReport } from "../api";
import type { Result } from "../types";

export default function ResultsPage() {
  const [rows, setRows] = useState<Result[]>([]);
  const [filterSim, setFilterSim] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [downloading, setDownloading] = useState<"decisions" | "competitor" | null>(null);

  /**
   * Both reports are built for ONE simulation and ONE round, so they reuse the
   * filters above rather than adding a second pair of inputs that could
   * disagree with the table on screen.
   *
   * `filterRound` is a STRING and round numbers are 0-BASED, so the guard tests
   * for emptiness — `!filterRound` would refuse to export round 0, which is
   * every simulation's first round.
   */
  const canExport = filterSim !== "" && filterRound !== "";

  const exportReport = async (kind: "decisions" | "competitor") => {
    setError(""); setNote(""); setDownloading(kind);
    try {
      const name = await downloadRoundReport(kind, filterSim, Number(filterRound));
      setNote(`Downloaded ${name}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(null);
    }
  };

  const load = async () => {
    try {
      const res = await getResults(
        filterSim || undefined,
        filterRound !== "" ? Number(filterRound) : undefined,
        filterProduct || undefined,
        filterSegment || undefined,
      );
      setRows(res.data?.data ?? res.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, [filterSim, filterRound, filterProduct, filterSegment]);

  return (
    <div>
      <h2>Results</h2>
      <p>Read only.</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {note && <p style={{ color: "green" }}>{note}</p>}

      <label>Filter Sim ID: <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>
      {" "}
      <label>Filter Round#: <input type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} style={{ width: 60 }} /></label>
      {" "}
      <label>Filter Product ID: <input value={filterProduct} onChange={e => setFilterProduct(e.target.value)} /></label>
      {" "}
      <label>Filter Segment ID: <input value={filterSegment} onChange={e => setFilterSegment(e.target.value)} /></label>
      {" "}
      <button onClick={load}>Refresh</button>

      {/* Exports, driven by the Sim ID and Round# filters above so the PDF
          always covers what the table is showing. */}
      <div style={{ marginTop: 12, padding: 8, border: "1px solid #ddd", background: "#fafafa" }}>
        <strong>Export round reports</strong>
        <div style={{ marginTop: 6 }}>
          <button onClick={() => exportReport("competitor")} disabled={!canExport || downloading !== null}>
            {downloading === "competitor" ? "Building…" : "↓ Competitor report (PDF)"}
          </button>{" "}
          <button onClick={() => exportReport("decisions")} disabled={!canExport || downloading !== null}>
            {downloading === "decisions" ? "Building…" : "↓ Analysis report (PDF)"}
          </button>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#555" }}>
          {canExport
            ? <>Uses <strong>Sim ID</strong> and <strong>Round#</strong> above. The competitor report&apos;s
              leaderboard is scored from <strong>Leaderboard Config</strong> for this simulation&apos;s type.</>
            : <>Set <strong>Filter Sim ID</strong> and <strong>Filter Round#</strong> to enable.</>}
        </p>
      </div>

      <h3>All Results</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>SimId</th><th>TeamId</th><th>Round</th>
            <th>ProductId</th><th>SegmentId</th><th>Weighted Scores</th><th>Market Fit</th>
          </tr>
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
              <td><pre style={{ margin: 0, maxWidth: 200, overflow: "auto", fontSize: 11 }}>{JSON.stringify(r.weightedScores, null, 2)}</pre></td>
              <td><pre style={{ margin: 0, maxWidth: 200, overflow: "auto", fontSize: 11 }}>{JSON.stringify(r.marketFit, null, 2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
