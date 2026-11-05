import { useEffect, useState } from "react";
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

const box = { border: "1px solid #ddd", padding: 12, marginBottom: 24 };
const th  = { textAlign: "left" as const, fontSize: 11, color: "#888", padding: "4px 6px" };
const td  = { padding: "3px 6px", verticalAlign: "top" as const };

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
      });
      setInstances(res.instances);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Preview failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: "1px solid #eee", marginTop: 14, paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 12 }}>Preview</strong>
        <input placeholder="simulationId" value={simulationId}
               onChange={(e) => setSimulationId(e.target.value)} style={{ width: 240 }} />
        <input placeholder="round (0-based)" value={roundNumber}
               onChange={(e) => setRoundNumber(e.target.value)} style={{ width: 120 }} />
        <button onClick={render} disabled={!canRender || busy}>
          {busy ? "Rendering…" : "Render"}
        </button>
        {!draft.chartStyle && (
          <span style={{ fontSize: 11, color: "#888" }}>pick a shape first</span>
        )}
        {instances.length > 1 && (
          <span style={{ fontSize: 11, color: "#888" }}>
            {instances.length} charts — one per notebook
          </span>
        )}
      </div>

      {err && <div style={{ color: "#b00", fontSize: 12, marginTop: 6 }}>{err}</div>}

      {instances.map((inst) => (
        <div key={inst.productId ?? "summary"} style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "#888" }}>
            {/* Named even when there is only one: "every notebook at once" is
                a claim about what the numbers mean, not a heading. */}
            {inst.productName ?? "Overall — every notebook at once"}
            {" · "}
            {/* The row count is the diagnostic, and it is per instance. */}
            <span style={{ color: inst.rows === 0 ? "#b00" : "#888" }}>
              {inst.rows} row(s){inst.rows === 0 ? " — the bindings matched no data" : ""}
            </span>
          </div>
          <div style={{ overflowX: "auto" }}
               dangerouslySetInnerHTML={{ __html: inst.svg }} />
        </div>
      ))}
    </div>
  );
}

export default function DebriefChartsPage() {
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [styles, setStyles] = useState<DebriefChartStyle[]>([]);
  const [charts, setCharts] = useState<DebriefChartConfig[]>([]);
  const [dims, setDims] = useState<DebriefDimensions>({ categorical: [], measures: [], clientCharts: [] });
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
    if (!selectedSimType) { setDims({ categorical: [], measures: [], clientCharts: [] }); return; }
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

  return (
    <div style={{ padding: 16 }}>
      <h2>Debrief Charts</h2>
      <p style={{ maxWidth: 720, color: "#555" }}>
        Which charts this simulation type's debrief shows, and in what order. One type
        has one set, shared by every simulation under it. Shapes come from the Chart
        Gallery; descriptions are written per round on the Round Debrief page.
      </p>

      {error && <div style={{ color: "#b00", marginBottom: 8 }}>{error}</div>}
      {notice && <div style={{ color: "#2a7", marginBottom: 8 }}>{notice}</div>}

      <div style={box}>
        <label>
          Simulation Type:{" "}
          <select
            value={selectedSimType}
            onChange={(e) => { setSelectedSimType(e.target.value); reset(); }}
          >
            <option value="">-- select --</option>
            {simulationTypes.map((st: any) => (
              <option key={st._id} value={st._id}>{st.name ?? st._id}</option>
            ))}
          </select>
        </label>

        {styles.length === 0 && (
          <div style={{ color: "#b00", fontSize: 12, marginTop: 8 }}>
            The chart gallery is empty, so no chart can be given a shape yet. Add one on
            the Chart Gallery page.
          </div>
        )}

        {selectedSimType && (
          <div style={{ marginTop: 12 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 10 }}>
              <thead>
                <tr>
                  <th style={th}>ORDER</th><th style={th}>SLIDE GROUP</th><th style={th}>NAME</th>
                  <th style={th}>SCOPE</th>
                  <th style={th}>SHAPE</th><th style={th}>X</th><th style={th}>Y</th>
                  <th style={th}>GROUPING</th><th style={th} />
                </tr>
              </thead>
              <tbody>
                {charts.map((c) => (
                  <tr key={c._id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={td}>{c.order}</td>
                    <td style={td}>{c.category || <span style={{ color: "#bbb" }}>—</span>}</td>
                    <td style={td}>{c.name}</td>
                    <td style={td}>
                      {c.scope === "each"
                        ? <span title="one chart per notebook; a summary is a separate chart">per notebook</span>
                        : "overall"}
                    </td>
                    <td style={td}>
                      {c.clientChart
                        ? <span title="the player draws this one; it takes no shape">player-drawn</span>
                        : c.chartStyle
                          ? c.chartStyle.name
                          : <span style={{ color: "#b00" }}>none</span>}
                    </td>
                    <td style={td}>{dimLabel(dims, c.xAxis)}</td>
                    {/* Every measure, comma-separated, a column showing only
                        the first would hide half of what the chart plots. */}
                    <td style={td}>
                      {c.yAxis.length === 0
                        ? dimLabel(dims, null)
                        : c.yAxis.map((m, i) => (
                            <span key={m}>
                              {i > 0 && ", "}
                              {dimLabel(dims, m)}
                            </span>
                          ))}
                    </td>
                    <td style={td}>{dimLabel(dims, c.grouping)}</td>
                    <td style={td}>
                      <button
                        onClick={() => { setEditing(c._id); setForm(draftFromChart(c)); }}
                      >
                        Edit
                      </button>{" "}
                      <button onClick={() => run(() => deleteDebriefChart(c._id))}>Delete</button>
                    </td>
                  </tr>
                ))}
                {charts.length === 0 && (
                  <tr>
                    <td style={{ ...td, color: "#999" }} colSpan={9}>
                      No charts — this type's debrief is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <ChartConfigFields draft={form} styles={styles} dims={dims} onChange={setForm} />
              <button onClick={submit} disabled={!form.name.trim()}>
                {editing ? "Save" : "Add chart"}
              </button>
              {editing && <button onClick={reset}>Cancel</button>}
            </div>

            <Preview draft={form} />
          </div>
        )}
      </div>
    </div>
  );
}
