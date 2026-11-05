import { useEffect, useMemo, useState } from "react";
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
  const [dims, setDims] = useState<DebriefDimensions>({ categorical: [], measures: [], clientCharts: [] });

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
    if (!selectedSimType) { setDims({ categorical: [], measures: [], clientCharts: [] }); return; }
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
    <div style={{ padding: 16 }}>
      <h2>Round Debrief</h2>
      <p style={{ maxWidth: 680, color: "#555" }}>
        What the teams see on their limbo screen after a round is closed. The figures
        below are read-only. The descriptions above them are not — a chart with no
        description is hidden from the players entirely — and each chart's own
        configuration can be corrected here without leaving the round.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <label>
          Simulation Type:{" "}
          <select
            value={selectedSimType}
            // Clearing the chosen simulation is load-bearing: one from the previous type stays selectable otherwise.
            onChange={(e) => {
              setSelectedSimType(e.target.value);
              setFilterSim("");
              setData(null);
            }}
          >
            <option value="">-- select --</option>
            {simulationTypes.map((st: any) => (
              <option key={st._id} value={st._id}>{st.name ?? st._id}</option>
            ))}
          </select>
        </label>

        <label>
          Simulation:{" "}
          <select
            value={filterSim}
            onChange={(e) => { setFilterSim(e.target.value); setData(null); }}
            disabled={!selectedSimType}
          >
            <option value="">-- select --</option>
            {simulations.map((s: any) => (
              <option key={s._id} value={s._id}>{s.name ?? s._id}</option>
            ))}
          </select>
        </label>

        <input
          placeholder="roundNumber (0-based)"
          value={filterRound}
          onChange={(e) => setFilterRound(e.target.value)}
          disabled={!filterSim}
          style={{ width: 170 }}
        />
        <button onClick={load} disabled={!canLoad || loading}>
          {loading ? "Loading…" : "Load debrief"}
        </button>
      </div>

      {error && <div style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}
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
        <div style={{ color: "#b00" }}>
          This simulation type has no charts configured, so its debrief is empty for
          every round. Add them on the Debrief Charts page, or import the original
          slide with <code>npm run import-debrief-charts -- &lt;simulationTypeId&gt;</code>.
        </div>
      )}
    </div>
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

  /** !important keyed by the pair, never `_id` alone; `charts` carries one entry per instance. */
  const instanceKey = (chartId: string, productId: string | null) =>
    `${chartId}:${productId ?? ""}`;

  const byInstance = useMemo(() => {
    const m = new Map<string, RoundNote>();
    for (const n of notes) {
      if (n.chartId) m.set(instanceKey(String(n.chartId), n.productId ?? null), n);
    }
    return m;
  }, [notes]);

  // Sort a copy: `charts` is the payload's own array and `.sort()` is in place.
  const ordered = useMemo(() => [...charts].sort((a, b) => a.order - b.order), [charts]);

  const keyOf = (c: DebriefChart) => instanceKey(c._id, c.productId);

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
          chartId: c._id, productId: c.productId,
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
    <div style={{ border: "1px solid #ddd", padding: 12, marginBottom: 28 }}>
      <strong>Chart descriptions</strong>
      <div style={{ color: "#666", fontSize: 12, margin: "4px 0 12px" }}>
        A chart with no description is hidden from the players. Clearing a box and
        saving removes that chart from their debrief. <em>Edit chart</em> changes the
        chart for every round and every simulation of this type — only the
        description is per round.
      </div>

      {error && <div style={{ color: "#b00", marginBottom: 8 }}>{error}</div>}

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
        const isBreakdown = c.productId !== null;

        return (
          <div key={k}>
            {heading && (
              <div style={{
                textTransform: "uppercase", fontSize: 11, color: "#888",
                borderBottom: "1px solid #eee", margin: "14px 0 6px", paddingBottom: 2,
              }}>
                {heading}
              </div>
            )}
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-start", margin: "6px 0",
              ...(firstOfChart ? {} : { marginLeft: 18, borderLeft: "2px solid #eee", paddingLeft: 10 }),
            }}>
              <div style={{ width: 230, paddingTop: 4 }}>
                <div style={{ fontSize: 13 }}>
                  {firstOfChart && c.name}
                  {isBreakdown && (
                    <span style={{ color: "#666" }}>
                      {firstOfChart ? " · " : ""}{c.productName ?? "notebook"}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {c.clientChart
                    ? "drawn by the player"
                    : c.chartStyle ? c.chartStyle.name : "no shape chosen"}
                  {c.scope === "overall" ? " · every notebook at once" : ""}
                </div>
                <div style={{ fontSize: 11, color: c.resolved ? "#2a7" : "#b00" }}>
                  {c.resolved ? "described" : "no description — ships without one"}
                </div>
                {/* Once per chart: every instance is the same stored document. */}
                {firstOfChart && (
                  <button
                    onClick={() => (editing === c._id ? closeEditor() : openEditor(c))}
                    style={{
                      fontSize: 11, marginTop: 3, padding: "1px 5px",
                      background: "none", border: "1px solid #ddd", cursor: "pointer",
                    }}
                  >
                    {editing === c._id ? "Close" : "Edit chart"}
                  </button>
                )}
              </div>
              <textarea
                value={textFor(c)}
                onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                rows={2}
                style={{ flex: 1, minWidth: 0 }}
                placeholder={
                  isBreakdown
                    ? `What a team should take from "${c.name}" for ${c.productName ?? "this notebook"}`
                    : `What a team should take from "${c.name}"`
                }
              />
              <button onClick={() => save(c)} disabled={busy === k || !dirty}>
                {busy === k ? "Saving…" : "Save"}
              </button>
            </div>

            {/* The server drew this; the console never receives a spec. */}
            <div style={{
              margin: "0 0 18px 0", overflowX: "auto",
              ...(isBreakdown ? { marginLeft: 28 } : {}),
            }}>
              {c.svg
                ? <div dangerouslySetInnerHTML={{ __html: c.svg }} />
                : (
                  <div style={{ fontSize: 11, color: "#b00" }}>
                    {c.chartStyle
                      ? "This chart did not render — check its bindings with Edit chart."
                      : "No shape chosen, so there is nothing to draw."}
                  </div>
                )}
            </div>

            {editing === c._id && draft && firstOfChart && (
              <div style={{
                display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
                background: "#fafafa", border: "1px solid #eee",
                padding: 8, margin: "0 0 10px 18px",
              }}>
                <ChartConfigFields
                  draft={draft} styles={styles} dims={dims} onChange={setDraft}
                />
                <button
                  onClick={() => saveChart(c._id)}
                  disabled={busy === `chart:${c._id}` || !draft.name.trim()}
                >
                  {busy === `chart:${c._id}` ? "Saving…" : "Save chart"}
                </button>
                <button onClick={closeEditor}>Cancel</button>

                {/* !important changing scope strands copy in either direction, and nothing cascades. */}
                {c.scope !== draft.scope && (
                  <div style={{ color: "#b00", fontSize: 11, flexBasis: "100%" }}>
                    {draft.scope === "overall"
                      ? "Switching to “overall” drops the per-notebook rows."
                      : "Switching to “each notebook” drops the overall row."}
                    {" "}Their descriptions are kept but become unreachable — switch
                    back to edit or clear them first.
                  </div>
                )}
                {styles.length === 0 && (
                  <div style={{ color: "#b00", fontSize: 11, flexBasis: "100%" }}>
                    The chart gallery is empty, so no shape can be picked.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

