import { useEffect, useState } from "react";
import { getResults } from "../api";
import type { Result } from "../types";

export default function ResultsPage() {
  const [rows, setRows] = useState<Result[]>([]);
  const [filterSim, setFilterSim] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [error, setError] = useState("");

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

      <label>Filter Sim ID: <input value={filterSim} onChange={e => setFilterSim(e.target.value)} /></label>
      {" "}
      <label>Filter Round#: <input type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} style={{ width: 60 }} /></label>
      {" "}
      <label>Filter Product ID: <input value={filterProduct} onChange={e => setFilterProduct(e.target.value)} /></label>
      {" "}
      <label>Filter Segment ID: <input value={filterSegment} onChange={e => setFilterSegment(e.target.value)} /></label>
      {" "}
      <button onClick={load}>Refresh</button>

      <h3>All Results</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>_id</th><th>SimId</th><th>TeamId</th><th>Round</th>
            <th>ProductId</th><th>SegmentId</th><th>Weighted Scores</th><th>Market Shares</th>
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
              <td><pre style={{ margin: 0, maxWidth: 200, overflow: "auto", fontSize: 11 }}>{JSON.stringify(r.marketShares, null, 2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
