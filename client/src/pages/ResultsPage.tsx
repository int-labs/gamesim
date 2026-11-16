import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, Text, TextField, type DataTableColumn } from "@stratagem/design-system";
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
    <>
      <PageHeader title="Results" description="Read only." />
      {error && <Alert tone="danger">{error}</Alert>}
      {note && <Alert tone="success">{note}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Filter Sim ID" value={filterSim} onChange={e => setFilterSim(e.target.value)} />
        <TextField label="Filter Round#" type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} />
        <TextField label="Filter Product ID" value={filterProduct} onChange={e => setFilterProduct(e.target.value)} />
        <TextField label="Filter Segment ID" value={filterSegment} onChange={e => setFilterSegment(e.target.value)} />
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {/* Exports use the Sim ID and Round# filters above so the PDF covers what the table shows */}
      <Card variant="panel">
        <Heading level={3} variant="heading-sm">Export round reports</Heading>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportReport("competitor")} disabled={!canExport || downloading !== null}>
            {downloading === "competitor" ? "Building…" : "↓ Competitor report (PDF)"}
          </Button>
          <Button variant="outline" onClick={() => exportReport("decisions")} disabled={!canExport || downloading !== null}>
            {downloading === "decisions" ? "Building…" : "↓ Analysis report (PDF)"}
          </Button>
        </div>
        <Text variant="caption" tone="muted">
          {canExport
            ? <>Uses <strong>Sim ID</strong> and <strong>Round#</strong> above. The competitor report&apos;s
              leaderboard is scored from <strong>Leaderboard Config</strong> for this simulation&apos;s type.</>
            : <>Set <strong>Filter Sim ID</strong> and <strong>Filter Round#</strong> to enable.</>}
        </Text>
      </Card>

      <Card>
        <Heading level={3}>All Results</Heading>
        <DataTable label="All Results" columns={COLUMNS} rows={rows} rowKey={r => r._id} />
      </Card>
    </>
  );
}

const jsonCell = (value: unknown) => (
  <pre className="m-0 max-w-52 overflow-auto type-caption">{JSON.stringify(value, null, 2)}</pre>
);

const COLUMNS: DataTableColumn<Result>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "simulationId", header: "SimId", cell: r => r.simulationId },
  { id: "teamId", header: "TeamId", cell: r => r.teamId },
  { id: "roundNumber", header: "Round", cell: r => r.roundNumber },
  { id: "productId", header: "ProductId", cell: r => r.productId },
  { id: "segmentId", header: "SegmentId", cell: r => r.segmentId },
  { id: "weightedScores", header: "Weighted Scores", cell: r => jsonCell(r.weightedScores) },
  { id: "marketFit", header: "Market Fit", cell: r => jsonCell(r.marketFit) },
];
