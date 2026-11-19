import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Input, PageHeader, Select, Text, type DataTableColumn } from "@stratagem/design-system";
import {
  createDebriefChart, deleteDebriefChart,
  getDebriefCharts, getDebriefChartStyles, getDebriefDimensions, getSimulationTypes,
  previewDebriefChart, updateDebriefChart, type PreviewInstance,
} from "../api";
import type { DebriefChartConfig, DebriefChartStyle, DebriefDimensions } from "../types";
import {
  ChartConfigFields, EMPTY_CHART, chartPayload, dimLabel, draftFromChart,
  type ChartDraft,
} from "./ChartConfigForm";

/** Which charts a simulation type's debrief shows, and where. An operator surface: shapes are picked from the gallery, never authored here. */

/** Render the draft binding against a real round. The SVG arrives already drawn by the server; the console never receives a spec. */
function Preview({ draft }: { draft: ChartDraft }) {
  const [simulationId, setSimulationId] = useState("");
  const [roundNumber, setRoundNumber] = useState("");
  const [instances, setInstances] = useState<PreviewInstance[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const canRender = draft.chartStyle !== "" && simulationId !== "" && roundNumber !== "";

  const render = async () => {
    setBusy(true); setErr(""); setInstances([]);
    try {
      const res = await previewDebriefChart({
        chartStyle: draft.chartStyle,
        // The preview is a bare SVG with no panel around it, so the chart has
        // to say its own name here.
        name: draft.name,
        simulationId,
        roundNumber: Number(roundNumber),
        xAxis: draft.xAxis || null,
        yAxis: draft.yAxis,
        grouping: draft.grouping || null,
        // !important WITHOUT THIS the preview shows the summary alone while the slide
        // ships N + 1. The point of previewing is that they match.
        scope: draft.scope,
        categories: draft.scope === "eachItem" ? draft.categories : [],
      });
      setInstances(res.instances);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Preview failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="panel">
      <div className="flex flex-wrap items-center gap-2">
        <Text as="strong" variant="label">Preview</Text>
        <Input size="sm" className="w-60" aria-label="simulationId" placeholder="simulationId" value={simulationId}
               onChange={(e) => setSimulationId(e.target.value)} />
        <Input size="sm" className="w-32" aria-label="round (0-based)" placeholder="round (0-based)" value={roundNumber}
               onChange={(e) => setRoundNumber(e.target.value)} />
        <Button variant="outline" size="sm" onClick={render} disabled={!canRender || busy}>
          {busy ? "Rendering…" : "Render"}
        </Button>
        {!draft.chartStyle && (
          <Text as="span" variant="caption" tone="muted">pick a shape first</Text>
        )}
        {instances.length > 1 && (
          <Text as="span" variant="caption" tone="muted">
            {instances.length} charts — one per notebook
          </Text>
        )}
      </div>

      {err && <Alert tone="danger">{err}</Alert>}

      {instances.map((inst) => (
        <div key={inst.productId ?? inst.inputId ?? "summary"} className="flex flex-col gap-1">
          <Text variant="caption" tone="muted">
            {/* Named even when there is only one: "every notebook at once" is
                a claim about what the numbers mean, not a heading. */}
            {inst.productName ?? inst.inputLabel ?? "Overall — every notebook at once"}
            {" · "}
            {/* The row count is the diagnostic, and it is per instance. */}
            <Text as="span" tone={inst.rows === 0 ? "danger" : "muted"}>
              {inst.rows} row(s){inst.rows === 0 ? " — the bindings matched no data" : ""}
            </Text>
          </Text>
          <div className="overflow-x-auto"
               dangerouslySetInnerHTML={{ __html: inst.svg }} />
        </div>
      ))}
    </Card>
  );
}

export default function DebriefChartsPage() {
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [styles, setStyles] = useState<DebriefChartStyle[]>([]);
  const [charts, setCharts] = useState<DebriefChartConfig[]>([]);
  const [dims, setDims] = useState<DebriefDimensions>({ categorical: [], measures: [], clientCharts: [], itemCategories: [] });
  const [form, setForm] = useState<ChartDraft>({ ...EMPTY_CHART });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getSimulationTypes()
      .then((res) => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
    // READ-ONLY here. The gallery is managed on its own page; this page only
    // needs the list to fill the shape dropdown.
    getDebriefChartStyles().then(setStyles).catch((e: any) => setError(e.message));
  }, []);

  const load = () => {
    if (!selectedSimType) { setCharts([]); return Promise.resolve(); }
    return getDebriefCharts(selectedSimType)
      .then(setCharts)
      .catch((e: any) => setError(e.message));
  };

  useEffect(() => { load(); }, [selectedSimType]);

  // Per type, so it reloads with the gate: notebooks and lever keys differ by type.
  useEffect(() => {
    if (!selectedSimType) { setDims({ categorical: [], measures: [], clientCharts: [], itemCategories: [] }); return; }
    getDebriefDimensions(selectedSimType)
      .then(setDims)
      .catch((e: any) => setError(e.message));
  }, [selectedSimType]);

  const reset = () => { setForm({ ...EMPTY_CHART }); setEditing(null); };

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setError(""); setNotice("");
    try {
      const res = await fn();
      if (ok) setNotice(ok);
      // The delete reports how many descriptions went with the chart, worth
      // surfacing, since that is data the operator cannot get back.
      const gone = res?.data?.descriptionsDeleted;
      if (typeof gone === "number" && gone > 0) {
        setNotice(`Chart deleted, along with ${gone} description(s).`);
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Request failed.");
    }
  };

  const submit = () => {
    if (!form.name.trim()) return;
    const payload = chartPayload(form);
    if (editing) run(() => updateDebriefChart(editing, payload), "Chart saved.").then(reset);
    else run(() => createDebriefChart({ simulationTypeId: selectedSimType, ...payload }), "Chart added.").then(reset);
  };

  const columns: DataTableColumn<DebriefChartConfig>[] = [
    { id: "order", header: "ORDER", cell: (c) => c.order },
    { id: "category", header: "SLIDE GROUP", cell: (c) => c.category || <Text as="span" tone="faint">—</Text> },
    { id: "name", header: "NAME", cell: (c) => c.name, primary: true },
    {
      id: "scope",
      header: "SCOPE",
      cell: (c) => c.scope === "each"
        ? <span title="one chart per notebook; a summary is a separate chart">per notebook</span>
        : c.scope === "eachItem"
          ? <span title="one chart per global input item in these categories">per item · {(c.categories ?? []).join(", ") || "no category"}</span>
          : "overall",
    },
    {
      id: "shape",
      header: "SHAPE",
      cell: (c) => c.clientChart
        ? <span title="the player draws this one; it takes no shape">player-drawn</span>
        : c.chartStyle
          ? c.chartStyle.name
          : <Text as="span" tone="danger">none</Text>,
    },
    { id: "x", header: "X", cell: (c) => dimLabel(dims, c.xAxis) },
    {
      id: "y",
      header: "Y",
      // Every measure, comma-separated; showing only the first would hide half of what the chart plots
      cell: (c) => c.yAxis.length === 0
        ? dimLabel(dims, null)
        : c.yAxis.map((m, i) => (
            <span key={m}>
              {i > 0 && ", "}
              {dimLabel(dims, m)}
            </span>
          )),
    },
    { id: "grouping", header: "GROUPING", cell: (c) => dimLabel(dims, c.grouping) },
  ];

  return (
    <>
      <PageHeader
        title="Debrief Charts"
        description="Which charts this simulation type's debrief shows, and in what order. One type has one set, shared by every simulation under it. Shapes come from the Chart Gallery; descriptions are written per round on the Round Debrief page."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card>
        <Select
          label="Simulation Type"
          placeholder="-- select --"
          value={selectedSimType || null}
          onValueChange={(v) => { setSelectedSimType(v ?? ""); reset(); }}
          options={simulationTypes.map((st: any) => ({ value: st._id, label: st.name ?? st._id }))}
        />

        {styles.length === 0 && (
          <Alert tone="danger">
            The chart gallery is empty, so no chart can be given a shape yet. Add one on
            the Chart Gallery page.
          </Alert>
        )}

        {selectedSimType && (
          <>
            <DataTable
              label="Debrief charts"
              columns={columns}
              rows={charts}
              rowKey={(c) => c._id}
              empty="No charts — this type's debrief is empty."
              rowActions={(c) => (
                <>
                  <Button variant="text" onClick={() => { setEditing(c._id); setForm(draftFromChart(c)); }}>
                    Edit
                  </Button>
                  <Button variant="text" tone="danger" onClick={() => run(() => deleteDebriefChart(c._id))}>Delete</Button>
                </>
              )}
            />

            <div className="flex flex-wrap items-center gap-2">
              <ChartConfigFields draft={form} styles={styles} dims={dims} onChange={setForm} />
              <Button size="sm" onClick={submit} disabled={!form.name.trim()}>
                {editing ? "Save" : "Add chart"}
              </Button>
              {editing && <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>}
            </div>

            <Preview draft={form} />
          </>
        )}
      </Card>
    </>
  );
}
