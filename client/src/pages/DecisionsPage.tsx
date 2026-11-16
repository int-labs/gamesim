import { useState, useEffect } from "react";
import { Alert, Button, Card, DataTable, PageHeader, TextField, type DataTableColumn } from "@stratagem/design-system";
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
    <>
      <PageHeader title="Decisions" />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Filter Sim ID (required)" value={filterSim} onChange={e => setFilterSim(e.target.value)} />
        <TextField label="Filter Team ID" value={filterTeam} onChange={e => setFilterTeam(e.target.value)} />
        <TextField label="Filter Round#" type="number" value={filterRound} onChange={e => setFilterRound(e.target.value)} />
      </div>

      <Card>
        <DataTable
          label="Decisions"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>}
        />
      </Card>
    </>
  );
}

const COLUMNS: DataTableColumn<any>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "simulationId", header: "SimId", cell: r => r.simulationId },
  { id: "teamId", header: "TeamId", cell: r => r.teamId },
  { id: "roundNumber", header: "Round", cell: r => r.roundNumber },
  {
    id: "segment",
    header: "Segment",
    // segmentId from first input entry — all entries share the same segment
    cell: r => r.inputs?.[0]?.segmentId ?? "—",
  },
  {
    id: "products",
    header: "Products",
    cell: r =>
      (r.inputs ?? []).map((inp: any) => (
        <div key={inp.productId} className="mb-1 type-caption">
          <strong>{inp.productName}</strong>
          <div className="ps-2">
            {(inp.fields ?? []).map((f: any) => (
              <div key={f[0]?.fieldId}>
                {f[0]?.fieldId}: {f[0]?.value}
              </div>
            ))}
          </div>
        </div>
      )),
  },
  {
    id: "globalInputs",
    header: "Global Inputs",
    cell: r =>
      (r.globalInputs ?? []).length === 0
        ? "—"
        : (r.globalInputs ?? []).map((gi: any) => (
            <div key={gi.globalInputItemId} className="type-caption">
              [{gi.category}] {gi.label}
              {gi.selectedStepKey ? ` → ${gi.selectedStepKey}` : ""}
            </div>
          )),
  },
];