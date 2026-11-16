import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, TextField, type DataTableColumn } from "@stratagem/design-system";
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

  return (
    <>
      <PageHeader title="Projections" description="Read / Delete only. Projections are written by recalcProjections (not yet implemented)." />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Filter Sim ID" value={filterSim} onChange={e => setFilterSim(e.target.value)} />
        <TextField label="Filter Team ID" value={filterTeam} onChange={e => setFilterTeam(e.target.value)} />
        <TextField label="Filter Round#" type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} />
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      <Card>
        <Heading level={3}>All Projections</Heading>
        <DataTable
          label="All Projections"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const hasData = (val: unknown) => val !== null && val !== undefined;

const COLUMNS: DataTableColumn<Projection>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "simulationId", header: "SimId", cell: r => r.simulationId },
  { id: "teamId", header: "TeamId", cell: r => r.teamId },
  { id: "roundNumber", header: "Round", cell: r => r.roundNumber },
  { id: "bizperf", header: "bizperf", cell: r => (hasData(r.bizperf) ? "✓" : "null") },
  { id: "pnl", header: "pnl", cell: r => (hasData(r.pnl) ? "✓" : "null") },
  { id: "balanceSheet", header: "balanceSheet", cell: r => (hasData(r.balanceSheet) ? "✓" : "null") },
  { id: "cashflow", header: "cashflow", cell: r => (hasData(r.cashflow) ? "✓" : "null") },
  { id: "projections", header: "projections", cell: r => (hasData(r.projections) ? "✓" : "null") },
];
