import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, PageHeader, Text, TextArea, TextField, type DataTableColumn } from "@stratagem/design-system";
import {
  createDebriefChartStyle, deleteDebriefChartStyle,
  getDebriefChartStyles, updateDebriefChartStyle,
} from "../api";
import type { DebriefChartStyle } from "../types";
import { sanitizeChartShape } from "./sanitizeChartShape";

/** The chart gallery as data. !important a developer surface: authoring a shape means writing Vega-Lite. */

const COLUMNS: DataTableColumn<DebriefChartStyle>[] = [
  { id: "category", header: "FAMILY", cell: (s) => s.category || <Text as="span" tone="faint">—</Text> },
  { id: "name", header: "VARIANT", cell: (s) => s.name, primary: true },
  { id: "shape", header: "SHAPE", cell: (s) => <Text as="span" variant="caption" tone="muted">{s.shape ? `${s.shape.length} chars` : "empty"}</Text> },
];

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
    // !important sanitised on save, never at render; the console is the boundary.
    const payload = { ...form, shape: sanitizeChartShape(form.shape) };
    if (editing) run(() => updateDebriefChartStyle(editing, payload), "Shape saved.").then(reset);
    else run(() => createDebriefChartStyle(payload), "Shape added.").then(reset);
  };

  return (
    <>
      <PageHeader
        title="Chart Gallery"
        description="Every chart shape the app can draw. Global — every simulation type picks from this one list, on the Debrief Charts page. Adding a shape here is what makes a new kind of chart available without a deploy."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card>
        <Text variant="caption" tone="muted">
          <code>category</code> is the family (bar chart, line chart), <code>name</code> the
          variant (Stacked Bar, Cluster). A shape cannot be deleted while a configured
          chart still uses it.
        </Text>

        <DataTable
          label="Chart shapes"
          columns={COLUMNS}
          rows={styles}
          rowKey={(s) => s._id}
          empty="No shapes yet."
          rowActions={(s) => (
            <>
              <Button
                variant="text"
                onClick={() => {
                  setEditing(s._id);
                  setForm({ name: s.name, category: s.category, shape: s.shape });
                }}
              >
                Edit
              </Button>
              <Button variant="text" tone="danger" onClick={() => run(() => deleteDebriefChartStyle(s._id), "Shape deleted.")}>
                Delete
              </Button>
            </>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Family"
            placeholder="family, e.g. bar chart"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <TextField
            label="Variant"
            placeholder="variant, e.g. Stacked Bar"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <TextArea
          label="Shape"
          placeholder="shape — sanitised on save"
          value={form.shape}
          onChange={(e) => setForm({ ...form, shape: e.target.value })}
          minRows={4}
          className="font-mono"
        />
        <div className="flex gap-2">
          <Button onClick={submit} disabled={!form.name.trim()}>
            {editing ? "Save" : "Add"}
          </Button>
          {editing && <Button variant="outline" onClick={reset}>Cancel</Button>}
        </div>
      </Card>
    </>
  );
}
