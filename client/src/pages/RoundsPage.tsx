import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Heading, PageHeader, Select, TextField, type DataTableColumn } from "@stratagem/design-system";
import { getRounds, createRound, patchRound, deleteRound, calculateRound, endRound, deleteDecisionsByRound, deleteResultsByRound, deleteProjectionsByRound, getSimulations, getSimulationTypes } from "../api";
import type { Round } from "../types";

const BLANK = { roundNumber: 0, status: "Pending", durationMinutes: "" };

export default function RoundsPage() {
  const [rows, setRows] = useState<Round[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [simulations, setSimulations] = useState<any[]>([]);
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

  useEffect(() => {
    getSimulationTypes()
      .then((res) => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, []);

  // Narrowed in the browser: `GET /simulations` takes no simulationTypeId filter.
  useEffect(() => {
    if (!selectedSimType) { setSimulations([]); return; }
    getSimulations()
      .then((res) => {
        const all = res.data?.data ?? res.data ?? [];
        setSimulations((all as any[]).filter((s) => String(s.simulationTypeId) === selectedSimType));
      })
      .catch((e: any) => setError(e.message));
  }, [selectedSimType]);

  // No simulation chosen lists nothing, so rounds of another type never show under this one.
  useEffect(() => { if (filterSim) load(); else setRows([]); }, [filterSim]);

  const handleCreate = async () => {
    if (!filterSim) return;
    setLoading(true);
    setError("");
    try {
      const payload: any = {
        simulationId: filterSim,
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
    setError("");
    try {
      // THREE collections. Deleting fewer leaves a round that reports itself
      // reset while still serving old figures.
      //
      // ORDERED, not Promise.all. `deleteDecisionsByRound` refuses with 409
      // while the round still has results ("deleting its decisions would orphan
      // those results"), so results must be gone BEFORE decisions are asked for.
      // Run concurrently, the decisions call raced the results call and lost.
      // Sequencing satisfies the guard on its own terms — it is not bypassed
      // with ?force=true, so it still protects every other caller.
      await deleteResultsByRound(round.simulationId, round.roundNumber);
      await deleteDecisionsByRound(round.simulationId, round.roundNumber);
      await deleteProjectionsByRound(round.simulationId, round.roundNumber);
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
    <>
      <PageHeader title="Rounds" />
      {error && <Alert tone="danger">{error}</Alert>}
      {calcResult && <Alert tone="success">{calcResult}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <Select
          label="Simulation Type"
          placeholder="-- select --"
          value={selectedSimType || null}
          // Clearing the chosen simulation is load-bearing: one from the previous type stays selectable otherwise.
          onValueChange={(v) => { setSelectedSimType(v ?? ""); setFilterSim(""); }}
          options={simulationTypes.map((st: any) => ({ value: st._id, label: st.name || "(unnamed type)" }))}
        />
        <Select
          label="Simulation"
          placeholder="-- select --"
          value={filterSim || null}
          onValueChange={(v) => setFilterSim(v ?? "")}
          disabled={!selectedSimType}
          options={simulations.map((s: any) => ({ value: s._id, label: s.simulationName || "(unnamed simulation)" }))}
        />
      </div>

      <Card>
        <Heading level={3}>Create</Heading>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Round Number" type="number" value={form.roundNumber} onChange={e => setForm(f => ({ ...f, roundNumber: Number(e.target.value) }))} />
          <Select label="Status" options={STATUS_OPTIONS} value={form.status} onValueChange={v => v && setForm(f => ({ ...f, status: v }))} />
          <TextField label="Duration (minutes)" type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} />
        </div>
        <Button className="self-start" onClick={handleCreate} disabled={loading || !filterSim}>Create</Button>
      </Card>

      <Card>
        <Heading level={3}>All Rounds</Heading>
        <DataTable
          label="All Rounds"
          columns={COLUMNS}
          rows={rows}
          rowKey={r => r._id}
          rowActions={r => (
            <div className="flex flex-wrap justify-end gap-1">
              {r.status === "Active" && (
                <Button variant="text" onClick={() => handleCalculate(r._id)} title="Recalculate — leaves the round Active, so it can be run again">⚡ Calculate</Button>
              )}
              {r.status === "Active" && (
                <Button variant="text" onClick={() => handleCloseRound(r._id)} title="Calculate, mark Completed and advance the simulation">🔒 Close round</Button>
              )}
              {r.status === "Pending" && (
                <Button variant="text" onClick={() => handlePatch(r._id, "Active")}>→ Active</Button>
              )}
              {r.status === "Active" && (
                <Button variant="text" onClick={() => handlePatch(r._id, "Completed")}>→ Completed</Button>
              )}
              {r.status === "Completed" && (
                <Button variant="text" onClick={() => handlePatch(r._id, "Active")}>← Active</Button>
              )}
              {(r.status === "Active" || r.status === "Completed") && (
                <Button variant="text" tone="danger" onClick={() => handleReset(r)}>↺ Reset</Button>
              )}
              <Button variant="text" tone="danger" onClick={() => handleDelete(r._id)}>Delete</Button>
            </div>
          )}
        />
      </Card>
    </>
  );
}

const STATUS_OPTIONS = ["Pending", "Active", "Completed"].map(s => ({ value: s, label: s }));

const COLUMNS: DataTableColumn<Round>[] = [
  { id: "_id", header: "_id", cell: r => r._id },
  { id: "simulationId", header: "SimId", cell: r => r.simulationId },
  { id: "roundNumber", header: "Round#", cell: r => r.roundNumber, primary: true },
  { id: "status", header: "Status", cell: r => r.status },
  { id: "start", header: "Start", cell: r => (r.timer?.startDate ? new Date(r.timer.startDate).toLocaleString() : "") },
  { id: "duration", header: "Duration", cell: r => r.timer?.durationMinutes ?? "" },
  { id: "end", header: "End", cell: r => (r.timer?.endDate ? new Date(r.timer.endDate).toLocaleString() : "") },
];
