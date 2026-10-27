import { useEffect, useState } from "react";
import {
  createDebriefChart, createDebriefChartStyle,
  deleteDebriefChart, deleteDebriefChartStyle,
  getDebriefCharts, getDebriefChartStyles,
  getSimulationTypes,
  updateDebriefChart, updateDebriefChartStyle,
} from "../api";
import type { DebriefChartConfig, DebriefChartStyle } from "../types";
import { sanitizeChartShape } from "./sanitizeChartShape";

/**
 * The debrief's chart CONFIGURATION — two collections, deliberately on one page
 * because you pick a gallery shape while configuring a chart.
 *
 * ⚠ TWO NAMESPACES, SAME TWO WORDS. A gallery entry's `category`/`name` are the
 * chart FAMILY and VARIANT ("bar chart" / "Stacked Bar"). A configured chart's
 * are WHERE ON THE SLIDE it renders and what it is called there. They are not
 * the same axis and the headings below say so.
 *
 * A simulation type with no charts has an EMPTY debrief — the starting state of
 * a type nobody has configured, not a failure. An incomplete chart is not one
 * either: the axes may be blank and it still saves and renders. The only thing
 * that hides a chart from a team is a missing description, which is written on
 * the Round Debrief page because copy is per round.
 */

const box = { border: "1px solid #ddd", padding: 12, marginBottom: 24 };
const th  = { textAlign: "left" as const, fontSize: 11, color: "#888", padding: "4px 6px" };
const td  = { padding: "3px 6px", verticalAlign: "top" as const };

export default function DebriefChartsPage() {
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [styles, setStyles] = useState<DebriefChartStyle[]>([]);
  const [charts, setCharts] = useState<DebriefChartConfig[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getSimulationTypes()
      .then((res) => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
  }, []);

  const loadStyles = () =>
    getDebriefChartStyles().then(setStyles).catch((e: any) => setError(e.message));

  const loadCharts = () => {
    if (!selectedSimType) { setCharts([]); return Promise.resolve(); }
    return getDebriefCharts(selectedSimType)
      .then(setCharts)
      .catch((e: any) => setError(e.message));
  };

  useEffect(() => { loadStyles(); }, []);
  useEffect(() => { loadCharts(); }, [selectedSimType]);

  /** Every write funnels through here so one place reports failure — the
   *  server's own message, which carries the 409s that matter (a style still in
   *  use, a duplicate variant). */
  const run = async (fn: () => Promise<any>, after: () => void, ok?: string) => {
    setError(""); setNotice("");
    try {
      const res = await fn();
      if (ok) setNotice(ok);
      // The chart delete reports how many descriptions went with it — worth
      // surfacing, since that is data the operator cannot get back.
      const gone = res?.data?.descriptionsDeleted;
      if (typeof gone === "number" && gone > 0) {
        setNotice(`Chart deleted, along with ${gone} description(s).`);
      }
      after();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Request failed.");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Debrief Charts</h2>
      <p style={{ maxWidth: 720, color: "#555" }}>
        Which charts a simulation type's debrief shows, and the gallery of shapes
        they are drawn with. One type has one set of charts, shared by every
        simulation under it. A type with no charts shows an empty debrief.
      </p>

      {error && <div style={{ color: "#b00", marginBottom: 8 }}>{error}</div>}
      {notice && <div style={{ color: "#2a7", marginBottom: 8 }}>{notice}</div>}

      <ChartGallery
        styles={styles}
        onCreate={(d) => run(() => createDebriefChartStyle(d), loadStyles, "Shape added.")}
        onUpdate={(id, d) => run(() => updateDebriefChartStyle(id, d), loadStyles, "Shape saved.")}
        onDelete={(id) => run(() => deleteDebriefChartStyle(id), loadStyles, "Shape deleted.")}
      />

      <div style={box}>
        <strong>Charts on the slide</strong>
        <div style={{ color: "#666", fontSize: 12, margin: "4px 0 10px" }}>
          <code>category</code> is where on the slide it renders, <code>name</code> what
          it is called there — not the gallery's family and variant.
        </div>

        <label>
          Simulation Type:{" "}
          <select
            value={selectedSimType}
            onChange={(e) => setSelectedSimType(e.target.value)}
          >
            <option value="">-- select --</option>
            {simulationTypes.map((st: any) => (
              <option key={st._id} value={st._id}>{st.name ?? st._id}</option>
            ))}
          </select>
        </label>

        {selectedSimType && (
          <ChartList
            charts={charts}
            styles={styles}
            simulationTypeId={selectedSimType}
            onCreate={(d) => run(() => createDebriefChart(d), loadCharts, "Chart added.")}
            onUpdate={(id, d) => run(() => updateDebriefChart(id, d), loadCharts, "Chart saved.")}
            onDelete={(id) => run(() => deleteDebriefChart(id), loadCharts)}
          />
        )}
      </div>
    </div>
  );
}

/* ── The gallery — global ─────────────────────────────────────────────────── */

function ChartGallery({
  styles, onCreate, onUpdate, onDelete,
}: {
  styles: DebriefChartStyle[];
  onCreate: (d: { name: string; category: string; shape: string }) => void;
  onUpdate: (id: string, d: { name: string; category: string; shape: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState({ name: "", category: "", shape: "" });
  const [editing, setEditing] = useState<string | null>(null);

  const reset = () => { setForm({ name: "", category: "", shape: "" }); setEditing(null); };

  const submit = () => {
    if (!form.name.trim()) return;
    // SANITISED ON SAVE, never at render — the console is the boundary. Held as
    // raw text while typing and cleaned only here, because sanitising per
    // keystroke fights the author as they type a tag.
    const payload = { ...form, shape: sanitizeChartShape(form.shape) };
    if (editing) onUpdate(editing, payload);
    else onCreate(payload);
    reset();
  };

  return (
    <div style={box}>
      <strong>Chart gallery</strong>
      <div style={{ color: "#666", fontSize: 12, margin: "4px 0 10px" }}>
        Global — every simulation type picks from this one list. <code>category</code> is
        the family (bar chart, line chart), <code>name</code> the variant (Stacked Bar,
        Cluster). A shape cannot be deleted while a chart still uses it.
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={th}>FAMILY</th><th style={th}>VARIANT</th>
            <th style={th}>SHAPE</th><th style={th} />
          </tr>
        </thead>
        <tbody>
          {styles.map((s) => (
            <tr key={s._id} style={{ borderTop: "1px solid #eee" }}>
              <td style={td}>{s.category || <span style={{ color: "#bbb" }}>—</span>}</td>
              <td style={td}>{s.name}</td>
              <td style={{ ...td, fontSize: 11, color: "#888" }}>
                {s.shape ? `${s.shape.length} chars` : "empty"}
              </td>
              <td style={td}>
                <button onClick={() => { setEditing(s._id); setForm({ name: s.name, category: s.category, shape: s.shape }); }}>
                  Edit
                </button>{" "}
                <button onClick={() => onDelete(s._id)}>Delete</button>
              </td>
            </tr>
          ))}
          {styles.length === 0 && (
            <tr><td style={{ ...td, color: "#999" }} colSpan={4}>No shapes yet.</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <input
          placeholder="family, e.g. bar chart"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          style={{ width: 170 }}
        />
        <input
          placeholder="variant, e.g. Stacked Bar"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ width: 200 }}
        />
        <textarea
          placeholder="shape — sanitised on save"
          value={form.shape}
          onChange={(e) => setForm({ ...form, shape: e.target.value })}
          rows={3}
          style={{ flex: 1, minWidth: 260 }}
        />
        <button onClick={submit} disabled={!form.name.trim()}>
          {editing ? "Save" : "Add"}
        </button>
        {editing && <button onClick={reset}>Cancel</button>}
      </div>
    </div>
  );
}

/* ── The configured charts — per simulation type ──────────────────────────── */

const EMPTY = { name: "", category: "", order: 0, chartStyle: "", xAxis: "", yAxis: "", grouping: "" };

function ChartList({
  charts, styles, simulationTypeId, onCreate, onUpdate, onDelete,
}: {
  charts: DebriefChartConfig[];
  styles: DebriefChartStyle[];
  simulationTypeId: string;
  onCreate: (d: any) => void;
  onUpdate: (id: string, d: any) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);

  const reset = () => { setForm({ ...EMPTY }); setEditing(null); };

  const submit = () => {
    if (!form.name.trim()) return;
    // Empty string → null, not "": the axes are nullable and "" would read as a
    // configured dimension named nothing.
    const payload = {
      name: form.name,
      category: form.category,
      order: Number(form.order) || 0,
      chartStyle: form.chartStyle || null,
      xAxis: form.xAxis || null,
      yAxis: form.yAxis || null,
      grouping: form.grouping || null,
    };
    if (editing) onUpdate(editing, payload);
    else onCreate({ simulationTypeId, ...payload });
    reset();
  };

  return (
    <div style={{ marginTop: 12 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={th}>ORDER</th><th style={th}>SLIDE GROUP</th><th style={th}>NAME</th>
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
                {c.chartStyle
                  ? c.chartStyle.name
                  : <span style={{ color: "#b00" }}>none</span>}
              </td>
              <td style={td}>{c.xAxis ?? <span style={{ color: "#bbb" }}>—</span>}</td>
              <td style={td}>{c.yAxis ?? <span style={{ color: "#bbb" }}>—</span>}</td>
              <td style={td}>{c.grouping ?? <span style={{ color: "#bbb" }}>—</span>}</td>
              <td style={td}>
                <button
                  onClick={() => {
                    setEditing(c._id);
                    setForm({
                      name: c.name, category: c.category, order: c.order,
                      chartStyle: c.chartStyle?._id ?? "",
                      xAxis: c.xAxis ?? "", yAxis: c.yAxis ?? "", grouping: c.grouping ?? "",
                    });
                  }}
                >
                  Edit
                </button>{" "}
                <button onClick={() => onDelete(c._id)}>Delete</button>
              </td>
            </tr>
          ))}
          {charts.length === 0 && (
            <tr>
              <td style={{ ...td, color: "#999" }} colSpan={8}>
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
        {/* ⚠ FREE TEXT, not selects. The dimension registry these should read
            from does not exist yet — there is no list of what a chart may plot.
            Until it does, a typo here saves and simply never resolves. */}
        <input placeholder="x" value={form.xAxis}
               onChange={(e) => setForm({ ...form, xAxis: e.target.value })} style={{ width: 110 }} />
        <input placeholder="y" value={form.yAxis}
               onChange={(e) => setForm({ ...form, yAxis: e.target.value })} style={{ width: 110 }} />
        <input placeholder="grouping" value={form.grouping}
               onChange={(e) => setForm({ ...form, grouping: e.target.value })} style={{ width: 110 }} />
        <button onClick={submit} disabled={!form.name.trim()}>
          {editing ? "Save" : "Add chart"}
        </button>
        {editing && <button onClick={reset}>Cancel</button>}
      </div>
    </div>
  );
}
