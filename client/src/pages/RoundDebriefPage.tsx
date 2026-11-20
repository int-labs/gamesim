import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Heading, PageHeader, Select, Text, TextArea, TextField } from "@stratagem/design-system";
import {
  createRoundNote, deleteRoundNote, getDebriefChartStyles, getDebriefDimensions,
  getRoundDebrief, getRoundNotes, getSimulations, getSimulationTypes,
  updateDebriefChart, updateRoundNote,
} from "../api";
import type {
  DebriefChart, DebriefChartStyle, DebriefDimensions, RoundDebrief, RoundNote,
} from "../types";
import {
  ChartConfigFields, chartPayload, draftFromChart, type ChartDraft,
} from "./ChartConfigForm";

/** The operator's view of a round's debrief: every chart the teams see, with the copy that decides which of them they get. */

export default function RoundDebriefPage() {
  // Simulation type first: it scopes the catalogue, the products and the player config.
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [simulations, setSimulations] = useState<any[]>([]);

  const [filterSim, setFilterSim] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [data, setData] = useState<RoundDebrief | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A chart's configuration is edited against the gallery and this type's dimensions.
  const [styles, setStyles] = useState<DebriefChartStyle[]>([]);
  const [dims, setDims] = useState<DebriefDimensions>({ categorical: [], measures: [], clientCharts: [], itemCategories: [], moneyLocales: [] });

  useEffect(() => {
    getSimulationTypes()
      .then((res) => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
    // GLOBAL, so it is fetched once rather than per type, the gallery is the
    // same list wherever a shape is picked.
    getDebriefChartStyles().then(setStyles).catch((e: any) => setError(e.message));
  }, []);

  // PER TYPE. The notebooks, lever keys and cost bands differ by type, and
  // offering another type's dimensions would be worse than offering none.
  useEffect(() => {
    if (!selectedSimType) { setDims({ categorical: [], measures: [], clientCharts: [], itemCategories: [], moneyLocales: [] }); return; }
    getDebriefDimensions(selectedSimType)
      .then(setDims)
      .catch((e: any) => setError(e.message));
  }, [selectedSimType]);

  // Narrowed in the browser: `GET /simulations` takes no simulationTypeId filter.
  useEffect(() => {
    if (!selectedSimType) {
      setSimulations([]);
      return;
    }
    getSimulations()
      .then((res) => {
        const all = res.data?.data ?? res.data ?? [];
        setSimulations(
          (all as any[]).filter((s) => String(s.simulationTypeId) === selectedSimType),
        );
      })
      .catch((e: any) => setError(e.message));
  }, [selectedSimType]);

  // `filterRound` is a STRING and rounds are 0-BASED, so this tests emptiness -
  // `!filterRound` would refuse round 0, which every simulation has.
  const canLoad = selectedSimType !== "" && filterSim !== "" && filterRound !== "";

  const load = async () => {
    setError(""); setLoading(true); setData(null);
    try {
      setData(await getRoundDebrief(filterSim, Number(filterRound)));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load the debrief.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Round Debrief"
        description="What the teams see on their limbo screen after a round is closed. The figures below are read-only. The descriptions above them are not — a chart with no description is hidden from the players entirely — and each chart's own configuration can be corrected here without leaving the round."
      />

      <div className="flex flex-wrap items-end gap-4">
        <Select
          label="Simulation Type"
          placeholder="-- select --"
          value={selectedSimType || null}
          // Clearing the chosen simulation is load-bearing: one from the previous type stays selectable otherwise.
          onValueChange={(v) => {
            setSelectedSimType(v ?? "");
            setFilterSim("");
            setData(null);
          }}
          options={simulationTypes.map((st: any) => ({ value: st._id, label: st.name ?? st._id }))}
        />

        <Select
          label="Simulation"
          placeholder="-- select --"
          value={filterSim || null}
          onValueChange={(v) => { setFilterSim(v ?? ""); setData(null); }}
          disabled={!selectedSimType}
          options={simulations.map((s: any) => ({ value: s._id, label: s.name ?? s._id }))}
        />

        <TextField
          label="Round"
          placeholder="roundNumber (0-based)"
          value={filterRound}
          onChange={(e) => setFilterRound(e.target.value)}
          disabled={!filterSim}
        />
        <Button onClick={load} disabled={!canLoad || loading}>
          {loading ? "Loading…" : "Load debrief"}
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {data && (
        <ChartDescriptions
          simulationId={filterSim}
          roundNumber={Number(filterRound)}
          charts={data.charts ?? []}
          styles={styles}
          dims={dims}
          onSaved={load}
        />
      )}
      {data && data.charts.length === 0 && (
        <Alert tone="danger">
          This simulation type has no charts configured, so its debrief is empty for
          every round. Add them on the Debrief Charts page, or import the original
          slide with <code>npm run import-debrief-charts -- &lt;simulationTypeId&gt;</code>.
        </Alert>
      )}
    </>
  );
}

/** The descriptions that decide which charts a team sees. Reads `/round-notes` because editing needs the note's `_id`, which the debrief drops. */
function ChartDescriptions({
  simulationId, roundNumber, charts, styles, dims, onSaved,
}: {
  simulationId: string;
  roundNumber:  number;
  charts:       DebriefChart[];
  styles:       DebriefChartStyle[];
  dims:         DebriefDimensions;
  onSaved:      () => void;
}) {
  const [notes, setNotes]   = useState<RoundNote[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy]     = useState<string | null>(null);
  const [error, setError]   = useState("");

  // Keyed by `_id`, not instance: a `scope: each` chart's rows are one stored document.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft]     = useState<ChartDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRoundNotes(simulationId, roundNumber)
      .then((n) => { if (!cancelled) setNotes(n.filter((x) => x.chartId)); })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [simulationId, roundNumber, charts]);

  /** !important keyed by chart plus instance, never `_id` alone; `charts` carries one entry per instance. */
  const instanceKey = (chartId: string, productId: string | null, inputId: string | null) =>
    `${chartId}:${productId ?? ""}:${inputId ?? ""}`;

  const byInstance = useMemo(() => {
    const m = new Map<string, RoundNote>();
    for (const n of notes) {
      if (n.chartId) m.set(instanceKey(String(n.chartId), n.productId ?? null, n.inputId ?? null), n);
    }
    return m;
  }, [notes]);

  // Sort a copy: `charts` is the payload's own array and `.sort()` is in place.
  const ordered = useMemo(() => [...charts].sort((a, b) => a.order - b.order), [charts]);

  const keyOf = (c: DebriefChart) => instanceKey(c._id, c.productId, c.inputId ?? null);

  const textFor = (c: DebriefChart) =>
    drafts[keyOf(c)] ?? byInstance.get(keyOf(c))?.body ?? c.description ?? "";

  const save = async (c: DebriefChart) => {
    const k = keyOf(c);
    const body = textFor(c).trim();
    const existing = byInstance.get(k);
    setBusy(k); setError("");
    try {
      if (!body) {
        // EMPTY MEANS REMOVE, not "save an empty description": a blank body
        // would leave the chart resolved and draw it with no reading at all.
        if (existing) await deleteRoundNote(existing._id);
      } else if (existing) {
        await updateRoundNote(existing._id, { body, title: c.name });
      } else {
        // `title` is required by the model and never rendered for a chart -
        // the chart's own name is the heading, so it is filled, not asked for.
        await createRoundNote({
          simulationId, roundNumber,
          chartId: c._id, productId: c.productId, inputId: c.inputId ?? null,
          title: c.name, body,
        });
      }
      setDrafts((d) => { const next = { ...d }; delete next[k]; return next; });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save the description.");
    } finally {
      setBusy(null);
    }
  };

  const openEditor = (c: DebriefChart) => {
    setEditing(c._id);
    setDraft(draftFromChart(c));
  };

  const closeEditor = () => { setEditing(null); setDraft(null); };

  /** Saves the chart's configuration, not its copy, then reloads: the server decides `resolved`. */
  const saveChart = async (chartId: string) => {
    if (!draft || !draft.name.trim()) return;
    setBusy(`chart:${chartId}`); setError("");
    try {
      await updateDebriefChart(chartId, chartPayload(draft));
      closeEditor();
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save the chart.");
    } finally {
      setBusy(null);
    }
  };

  let lastCategory = "";
  let lastChartId = "";

  return (
    <Card>
      <Heading level={3}>Chart descriptions</Heading>
      <Text variant="caption" tone="muted">
        A chart with no description is hidden from the players. Clearing a box and
        saving removes that chart from their debrief. <em>Edit chart</em> changes the
        chart for every round and every simulation of this type — only the
        description is per round.
      </Text>

      {error && <Alert tone="danger">{error}</Alert>}

      {ordered.map((c) => {
        // Grouped by `category`, which arrives with the chart, a heading per
        // run rather than a hardcoded list, so a new category needs no edit here.
        const heading = c.category !== lastCategory ? c.category : null;
        lastCategory = c.category;
        const k = keyOf(c);
        const dirty = drafts[k] !== undefined;
        // !important keyed on the chart, not `productId`: an `each` chart has no summary instance.
        const firstOfChart = c._id !== lastChartId;
        lastChartId = c._id;
        const isBreakdown = c.productId !== null || (c.inputId ?? null) !== null;

        return (
          <div key={k} className="flex flex-col gap-2">
            {heading && (
              <Text variant="overline" tone="subtle" className="border-b border-line pb-1">
                {heading}
              </Text>
            )}
            <div className={`flex items-start gap-2 ${firstOfChart ? "" : "ms-4 border-s-2 border-line ps-3"}`}>
              <div className="flex w-56 shrink-0 flex-col gap-1 pt-1">
                <Text variant="body">
                  {firstOfChart && c.name}
                  {isBreakdown && (
                    <Text as="span" tone="muted">
                      {firstOfChart ? " · " : ""}{c.productName ?? c.inputLabel ?? "instance"}
                    </Text>
                  )}
                </Text>
                <Text variant="caption" tone="subtle">
                  {c.clientChart
                    ? "drawn by the player"
                    : c.chartStyle ? c.chartStyle.name : "no shape chosen"}
                  {c.scope === "overall" ? " · every notebook at once" : ""}
                </Text>
                <Text variant="caption" tone={c.resolved ? "success" : "danger"}>
                  {c.resolved ? "described" : "no description — ships without one"}
                </Text>
                {/* Once per chart: every instance is the same stored document. */}
                {firstOfChart && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="self-start"
                    onClick={() => (editing === c._id ? closeEditor() : openEditor(c))}
                  >
                    {editing === c._id ? "Close" : "Edit chart"}
                  </Button>
                )}
              </div>
              <TextArea
                aria-label={`Description of ${c.name}`}
                className="min-w-0 flex-1"
                value={textFor(c)}
                onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                minRows={2}
                placeholder={
                  isBreakdown
                    ? `What a team should take from "${c.name}" for ${c.productName ?? "this notebook"}`
                    : `What a team should take from "${c.name}"`
                }
              />
              <Button onClick={() => save(c)} disabled={busy === k || !dirty}>
                {busy === k ? "Saving…" : "Save"}
              </Button>
            </div>

            {/* The server drew this; the console never receives a spec. */}
            <div className={`overflow-x-auto ${isBreakdown ? "ms-7" : ""}`}>
              {c.svg
                ? <div dangerouslySetInnerHTML={{ __html: c.svg }} />
                : (
                  <Text variant="caption" tone="danger">
                    {c.chartStyle
                      ? "This chart did not render — check its bindings with Edit chart."
                      : "No shape chosen, so there is nothing to draw."}
                  </Text>
                )}
            </div>

            {editing === c._id && draft && firstOfChart && (
              <Card variant="panel" className="ms-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ChartConfigFields
                    draft={draft} styles={styles} dims={dims} onChange={setDraft}
                  />
                  <Button
                    size="sm"
                    onClick={() => saveChart(c._id)}
                    disabled={busy === `chart:${c._id}` || !draft.name.trim()}
                  >
                    {busy === `chart:${c._id}` ? "Saving…" : "Save chart"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={closeEditor}>Cancel</Button>
                </div>

                {/* !important changing scope strands copy in either direction, and nothing cascades. */}
                {c.scope !== draft.scope && (
                  <Text variant="caption" tone="danger">
                    {draft.scope === "overall"
                      ? "Switching to “overall” drops the per-notebook rows."
                      : "Switching to “each notebook” drops the overall row."}
                    {" "}Their descriptions are kept but become unreachable — switch
                    back to edit or clear them first.
                  </Text>
                )}
                {styles.length === 0 && (
                  <Text variant="caption" tone="danger">
                    The chart gallery is empty, so no shape can be picked.
                  </Text>
                )}
              </Card>
            )}
          </div>
        );
      })}
    </Card>
  );
}

