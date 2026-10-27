import { useEffect, useState } from "react";
import {
  createDebriefChart, deleteDebriefChart,
  getDebriefCharts, getDebriefChartStyles, getDebriefDimensions, getSimulationTypes,
  previewDebriefChart, updateDebriefChart,
} from "../api";
import type {
  DebriefChartConfig, DebriefChartStyle, DebriefDimension, DebriefDimensions,
} from "../types";

/**
 * Which charts a simulation type's debrief shows, and where.
 *
 * ⚠ AN OPERATOR SURFACE. Nothing here is authored by writing a shape — a shape
 * is PICKED from the gallery, which is the developer's page. If the dropdown is
 * empty, the gallery is empty; that is the thing to fix, not this page.
 *
 * ⚠ `category` and `name` HERE are the SLIDE's — where this renders and what it
 * is called in this sim. The gallery's two fields of the same names are the
 * chart FAMILY and VARIANT. Different axes entirely.
 *
 * A type with no charts has an EMPTY debrief — the starting state of a type
 * nobody has configured, not a failure. An incomplete chart is not one either:
 * the axes may be blank and it still saves and renders. The only thing that
 * hides a chart from a team is a missing description, written on the Round
 * Debrief page because copy is per round.
 */

const box = { border: "1px solid #ddd", padding: 12, marginBottom: 24 };
const th  = { textAlign: "left" as const, fontSize: 11, color: "#888", padding: "4px 6px" };
const td  = { padding: "3px 6px", verticalAlign: "top" as const };

const EMPTY = {
  name: "", category: "", order: 0, scope: "overall" as "overall" | "each",
  chartStyle: "", xAxis: "", yAxis: "", grouping: "",
};

/**
 * Render the draft binding against a real round.
 *
 * ⚠ THE SVG COMES FROM THE SERVER, already rendered. Injecting it is safe for
 * the reason the whole architecture exists: the console never receives a spec,
 * only output that `assertSafeSpec` and Vega have both been through. If this
 * ever starts receiving a spec instead, this `dangerouslySetInnerHTML` becomes
 * the hole.
 *
 * NOT automatic. It needs a simulation and round the operator picks, and firing
 * on every keystroke would render a chart per character against real decision
 * data.
 */
function Preview({ draft }: { draft: typeof EMPTY }) {
  const [simulationId, setSimulationId] = useState("");
  const [roundNumber, setRoundNumber] = useState("");
  const [svg, setSvg] = useState("");
  const [rows, setRows] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const canRender = draft.chartStyle !== "" && simulationId !== "" && roundNumber !== "";

  const render = async () => {
    setBusy(true); setErr(""); setSvg(""); setRows(null);
    try {
      const res = await previewDebriefChart({
        chartStyle: draft.chartStyle,
        simulationId,
        roundNumber: Number(roundNumber),
        xAxis: draft.xAxis || null,
        yAxis: draft.yAxis || null,
        grouping: draft.grouping || null,
      });
      setSvg(res.svg);
      setRows(res.rows);
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
        {/* ROW COUNT IS THE DIAGNOSTIC. An empty chart with 0 rows is a binding
            that resolved to nothing; an empty chart with rows is a shape
            problem. Without this they look identical. */}
        {rows !== null && (
          <span style={{ fontSize: 11, color: rows === 0 ? "#b00" : "#888" }}>
            {rows} row(s){rows === 0 ? " — the bindings matched no data" : ""}
          </span>
        )}
      </div>

      {err && <div style={{ color: "#b00", fontSize: 12, marginTop: 6 }}>{err}</div>}
      {svg && (
        <div style={{ marginTop: 8, overflowX: "auto" }}
             dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  );
}

/** A binding's human label, or the raw field marked when the registry no longer
 *  offers it — the same rule the select follows, so the table and the form
 *  cannot disagree about whether a chart is bound to something real. */
function dimLabel(dims: DebriefDimensions, field: string | null) {
  if (!field) return <span style={{ color: "#bbb" }}>—</span>;
  const hit = [...dims.categorical, ...dims.measures].find((d) => d.field === field);
  if (hit) return hit.label;
  return <span style={{ color: "#b00" }}>{field} (missing)</span>;
}

/**
 * One binding slot.
 *
 * ⚠ A SAVED VALUE THE REGISTRY NO LONGER OFFERS IS KEPT AND MARKED, not dropped
 * silently. A lever renamed on the GlobalInputs page takes its dimension with
 * it, and a select that simply showed blank would look like the operator had
 * never set one — then overwrite it on the next save.
 */
function DimensionSelect({
  label, options, value, onChange,
}: {
  label: string;
  options: DebriefDimension[];
  value: string;
  onChange: (v: string) => void;
}) {
  const known = options.some((o) => o.field === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ maxWidth: 190, ...(value && !known ? { color: "#b00" } : {}) }}
      title={value && !known ? `"${value}" is not offered by this type any more` : undefined}
    >
      <option value="">-- {label} --</option>
      {value && !known && <option value={value}>{value} (missing)</option>}
      {options.map((o) => (
        <option key={o.field} value={o.field}>{o.label}</option>
      ))}
    </select>
  );
}

export default function DebriefChartsPage() {
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [styles, setStyles] = useState<DebriefChartStyle[]>([]);
  const [charts, setCharts] = useState<DebriefChartConfig[]>([]);
  const [dims, setDims] = useState<DebriefDimensions>({ categorical: [], measures: [] });
  const [form, setForm] = useState({ ...EMPTY });
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

  // PER TYPE, so it reloads with the gate. The notebooks, lever keys and cost
  // bands differ by type, and offering another type's would be worse than
  // offering none.
  useEffect(() => {
    if (!selectedSimType) { setDims({ categorical: [], measures: [] }); return; }
    getDebriefDimensions(selectedSimType)
      .then(setDims)
      .catch((e: any) => setError(e.message));
  }, [selectedSimType]);

  const reset = () => { setForm({ ...EMPTY }); setEditing(null); };

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setError(""); setNotice("");
    try {
      const res = await fn();
      if (ok) setNotice(ok);
      // The delete reports how many descriptions went with the chart — worth
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
    // Empty string → null, not "": the axes are nullable and "" would read as a
    // configured dimension named nothing.
    const payload = {
      name: form.name,
      category: form.category,
      order: Number(form.order) || 0,
      scope: form.scope,
      chartStyle: form.chartStyle || null,
      xAxis: form.xAxis || null,
      yAxis: form.yAxis || null,
      grouping: form.grouping || null,
    };
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
                        ? <span title="one chart per notebook, plus an all-notebooks summary">each + summary</span>
                        : "overall"}
                    </td>
                    <td style={td}>
                      {c.chartStyle
                        ? c.chartStyle.name
                        : <span style={{ color: "#b00" }}>none</span>}
                    </td>
                    <td style={td}>{dimLabel(dims, c.xAxis)}</td>
                    <td style={td}>{dimLabel(dims, c.yAxis)}</td>
                    <td style={td}>{dimLabel(dims, c.grouping)}</td>
                    <td style={td}>
                      <button
                        onClick={() => {
                          setEditing(c._id);
                          setForm({
                            name: c.name, category: c.category, order: c.order,
                            scope: c.scope ?? "overall",
                            chartStyle: c.chartStyle?._id ?? "",
                            xAxis: c.xAxis ?? "", yAxis: c.yAxis ?? "", grouping: c.grouping ?? "",
                          });
                        }}
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
              <input
                type="number" placeholder="order" value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                style={{ width: 70 }}
              />
              <input
                placeholder="slide group" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: 130 }}
              />
              <input
                placeholder="chart name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{ width: 180 }}
              />
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value as "overall" | "each" })}
                title="each = one chart per notebook plus an all-notebooks summary, each needing its own description"
              >
                <option value="overall">overall</option>
                <option value="each">each notebook</option>
              </select>
              <select
                value={form.chartStyle}
                onChange={(e) => setForm({ ...form, chartStyle: e.target.value })}
              >
                <option value="">-- shape --</option>
                {styles.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.category ? `${s.category} / ${s.name}` : s.name}
                  </option>
                ))}
              </select>
              {/* X and GROUPING divide, Y is plotted — so they are drawn from
                  different halves of the registry. These were free text until the
                  registry existed, and a typo then saved fine and silently never
                  resolved. */}
              <DimensionSelect label="x" options={dims.categorical}
                               value={form.xAxis}
                               onChange={(v) => setForm({ ...form, xAxis: v })} />
              <DimensionSelect label="y" options={dims.measures}
                               value={form.yAxis}
                               onChange={(v) => setForm({ ...form, yAxis: v })} />
              <DimensionSelect label="grouping" options={dims.categorical}
                               value={form.grouping}
                               onChange={(v) => setForm({ ...form, grouping: v })} />
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
