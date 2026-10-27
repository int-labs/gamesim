import { useEffect, useState } from "react";
import {
  createDebriefChartStyle, deleteDebriefChartStyle,
  getDebriefChartStyles, updateDebriefChartStyle,
} from "../api";
import type { DebriefChartStyle } from "../types";
import { sanitizeChartShape } from "./sanitizeChartShape";

/**
 * The chart gallery — every shape the app can draw, as data.
 *
 * ⚠ A DEVELOPER SURFACE, not a facilitator one. Authoring a shape means writing
 * one, and writes are ADMIN-only on the route for that reason. The operator's
 * job is on the Debrief Charts page, where a shape is PICKED from a dropdown —
 * they never see what is stored here.
 *
 * GLOBAL: a shape is the same wherever it is used, so this list is not scoped
 * to a simulation type. `category` is the chart FAMILY ("bar chart") and `name`
 * the VARIANT ("Stacked Bar") — a different namespace from the configured
 * chart's two fields of the same names, which mean where on the slide it
 * renders and what it is called there.
 */

const box = { border: "1px solid #ddd", padding: 12, marginBottom: 24 };
const th  = { textAlign: "left" as const, fontSize: 11, color: "#888", padding: "4px 6px" };
const td  = { padding: "3px 6px", verticalAlign: "top" as const };

export default function ChartGalleryPage() {
  const [styles, setStyles] = useState<DebriefChartStyle[]>([]);
  const [form, setForm] = useState({ name: "", category: "", shape: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () =>
    getDebriefChartStyles().then(setStyles).catch((e: any) => setError(e.message));

  useEffect(() => { load(); }, []);

  const reset = () => { setForm({ name: "", category: "", shape: "" }); setEditing(null); };

  const run = async (fn: () => Promise<any>, ok: string) => {
    setError(""); setNotice("");
    try {
      await fn();
      setNotice(ok);
      await load();
    } catch (e: any) {
      // Carries the server's 409s: a duplicate variant, or a shape still in use.
      setError(e?.response?.data?.message ?? e?.message ?? "Request failed.");
    }
  };

  const submit = () => {
    if (!form.name.trim()) return;
    // SANITISED ON SAVE, never at render — the console is the boundary. Held as
    // raw text while typing and cleaned only here, because sanitising per
    // keystroke fights the author mid-tag.
    const payload = { ...form, shape: sanitizeChartShape(form.shape) };
    if (editing) run(() => updateDebriefChartStyle(editing, payload), "Shape saved.").then(reset);
    else run(() => createDebriefChartStyle(payload), "Shape added.").then(reset);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Chart Gallery</h2>
      <p style={{ maxWidth: 720, color: "#555" }}>
        Every chart shape the app can draw. Global — every simulation type picks from
        this one list, on the Debrief Charts page. Adding a shape here is what makes a
        new kind of chart available without a deploy.
      </p>

      {error && <div style={{ color: "#b00", marginBottom: 8 }}>{error}</div>}
      {notice && <div style={{ color: "#2a7", marginBottom: 8 }}>{notice}</div>}

      <div style={box}>
        <div style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
          <code>category</code> is the family (bar chart, line chart), <code>name</code> the
          variant (Stacked Bar, Cluster). A shape cannot be deleted while a configured
          chart still uses it.
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
                  <button
                    onClick={() => {
                      setEditing(s._id);
                      setForm({ name: s.name, category: s.category, shape: s.shape });
                    }}
                  >
                    Edit
                  </button>{" "}
                  <button onClick={() => run(() => deleteDebriefChartStyle(s._id), "Shape deleted.")}>
                    Delete
                  </button>
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
            rows={4}
            style={{ flex: 1, minWidth: 280, fontFamily: "monospace", fontSize: 12 }}
          />
          <button onClick={submit} disabled={!form.name.trim()}>
            {editing ? "Save" : "Add"}
          </button>
          {editing && <button onClick={reset}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}
