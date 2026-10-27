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

/**
 * The operator's view of a round's debrief — every chart the teams see, with
 * the copy that decides which of them they see at all.
 *
 * ── IT DRAWS NOTHING ────────────────────────────────────────────────────────
 * Every chart here is a finished SVG from `GET /round-debrief`, the same
 * payload and the same picture the player's limbo screen gets.
 *
 * It used to render its own recharts set beside the editor — eight hardcoded
 * panels, roughly the same figures, drawn a second way. Removed 2026-10-27:
 * they could not be edited, reordered or removed, they did not change when a
 * chart's bindings did, and an operator writing copy was describing one chart
 * while the team read another. `scripts/importLegacyDebriefCharts.ts` carried
 * what they showed into the database as ordinary configured charts.
 *
 * ── THE ONE THING HERE THAT IS NOT READ-ONLY ────────────────────────────────
 * `ChartDescriptions` writes the copy the PLAYER's slide renders. A chart with
 * no description is `resolved: false` and the player does not see it at all —
 * so this editor decides which charts exist on their screen, not merely what
 * they read. A round with nothing written here is a blank debrief.
 *
 * ── WHAT IS STILL MISSING FROM EVERY SURFACE ────────────────────────────────
 * The VoC dot plot, and the two charts that need more than one measure. None
 * of the three is expressible as a single `{x, y, series}` binding; see the
 * import script's header for the specifics.
 */

export default function RoundDebriefPage() {
  // SIMULATION TYPE FIRST. It is what scopes the catalogue, the products and
  // the player config, so a debrief read without it is read against whatever
  // the simulation happens to point at rather than against a chosen sim.
  const [simulationTypes, setSimulationTypes] = useState<any[]>([]);
  const [selectedSimType, setSelectedSimType] = useState("");
  const [simulations, setSimulations] = useState<any[]>([]);

  const [filterSim, setFilterSim] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [data, setData] = useState<RoundDebrief | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The two things a chart's configuration is edited AGAINST: the gallery it
  // picks a shape from, and this type's own dimension registry. Both belong to
  // the simulation TYPE, which is why the editor below is only reachable once
  // one is chosen.
  const [styles, setStyles] = useState<DebriefChartStyle[]>([]);
  const [dims, setDims] = useState<DebriefDimensions>({ categorical: [], measures: [], clientCharts: [] });

  useEffect(() => {
    getSimulationTypes()
      .then((res) => setSimulationTypes(res.data?.data ?? res.data))
      .catch((e: any) => setError(e.message));
    // GLOBAL, so it is fetched once rather than per type — the gallery is the
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

  // Narrowed in the browser, not by the endpoint: `GET /simulations` takes no
  // simulationTypeId filter and does not populate the field, so it arrives as
  // a plain id string and compares directly.
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

  // `filterRound` is a STRING and rounds are 0-BASED, so this tests emptiness —
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
            // Clearing the chosen simulation is load-bearing: a simulation from
            // the previous type stays selectable in state otherwise, and the
            // page would read a debrief for a type it is no longer showing.
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

/**
 * The descriptions that decide which charts a team sees.
 *
 * ── WHY IT READS `/round-notes` WHEN THE DEBRIEF ALREADY CARRIES THE COPY ───
 * `charts[].description` is the resolved text, and that is all a reader needs.
 * Editing needs the note's `_id` to PATCH or DELETE, and the debrief does not
 * emit one — it joins the body and drops the row. So the debrief stays the read
 * path and this fetch is the write path's own.
 *
 * Both paths target the same rows, so after a save the DEBRIEF is reloaded
 * rather than this component patching its own copy: the server decides what
 * `resolved` means, and a local guess at it is how the editor and the player
 * come to disagree about which charts a round has.
 *
 * Notes written here are GENERAL (`teamId: null`). The model supports a
 * per-team description and `/round-debrief` prefers it over the general one,
 * but nothing authors one yet.
 *
 * ── IT ALSO EDITS THE CHART ITSELF ──────────────────────────────────────────
 * Writing the copy is when a chart's bindings are actually read, and that is
 * when a wrong axis shows up. Sending the operator to another page to fix it —
 * and back again to find their place in the round — is the kind of trip that
 * ends in the copy being written around the mistake instead.
 *
 * ⚠ THE CHART IS NOT PER ROUND. It belongs to the simulation TYPE, so a change
 * here lands on every round and every simulation under that type. The copy is
 * the per-round half; the configuration is not.
 */
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

  // The chart whose configuration is open, by `_id` — NOT by instance key. A
  // `scope: "each"` chart's N + 1 rows are one stored document, so only its
  // summary row opens this and the edit applies to the whole fan-out.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft]     = useState<ChartDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRoundNotes(simulationId, roundNumber)
      .then((n) => { if (!cancelled) setNotes(n.filter((x) => x.chartId)); })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [simulationId, roundNumber, charts]);

  /**
   * ⚠ KEYED BY THE PAIR, never `_id` alone.
   *
   * `charts` carries one entry per INSTANCE: a `scope: "each"` chart appears
   * N + 1 times with the same `_id`, told apart by `productId`. Keying on `_id`
   * would collapse a whole notebook breakdown into one row and let its
   * descriptions overwrite each other.
   */
  const instanceKey = (chartId: string, productId: string | null) =>
    `${chartId}:${productId ?? ""}`;

  const byInstance = useMemo(() => {
    const m = new Map<string, RoundNote>();
    for (const n of notes) {
      if (n.chartId) m.set(instanceKey(String(n.chartId), n.productId ?? null), n);
    }
    return m;
  }, [notes]);

  // SORT A COPY. `charts` is the array off the payload and `.sort()` is
  // in-place, so sorting it directly would reorder what the charts below read.
  // Stable, so a chart's own instances keep the order the server emitted —
  // summary first, then its notebooks.
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
        // `title` is required by the model and never rendered for a chart —
        // the chart's own name is the heading — so it is filled, not asked for.
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

  /**
   * Save the chart's CONFIGURATION, not its copy.
   *
   * Reloads the whole debrief afterwards rather than patching the local copy:
   * a `scope` change alters how many instances exist, and `resolved` is the
   * server's decision. Guessing either here is how this editor and the player
   * come to disagree about which charts a round has.
   */
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
        // Grouped by `category`, which arrives with the chart — a heading per
        // run rather than a hardcoded list, so a new category needs no edit here.
        const heading = c.category !== lastCategory ? c.category : null;
        lastCategory = c.category;
        const k = keyOf(c);
        const dirty = drafts[k] !== undefined;
        // A per-notebook instance is indented under its summary, so N + 1 rows
        // read as one chart broken down rather than N + 1 unrelated charts.
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
              ...(isBreakdown ? { marginLeft: 18, borderLeft: "2px solid #eee", paddingLeft: 10 } : {}),
            }}>
              <div style={{ width: 230, paddingTop: 4 }}>
                <div style={{ fontSize: 13 }}>
                  {c.name}
                  {isBreakdown && (
                    <span style={{ color: "#666" }}> · {c.productName ?? "notebook"}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {c.chartStyle ? c.chartStyle.name : "no shape chosen"}
                  {c.scope === "each" && !isBreakdown ? " · all notebooks" : ""}
                </div>
                <div style={{ fontSize: 11, color: c.resolved ? "#2a7" : "#b00" }}>
                  {c.resolved ? "shown to players" : "hidden"}
                </div>
                {/* ONLY ON THE SUMMARY ROW. A breakdown row is the same stored
                    document, so N + 1 edit buttons would all mutate one chart
                    while looking like they edited a notebook's own. */}
                {!isBreakdown && (
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

            {/* THE CHART ITSELF, under its own copy.
                ⚠ THE SERVER DREW IT. This is the same SVG the team's slide
                shows, taken off the same payload — so what an operator writes
                about is what the team reads, which was the whole reason the
                hardcoded console charts had to go.
                Unresolved charts carry a picture too, for staff only: the
                moment you are deciding what to write is the moment the chart
                has no description yet. */}
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

            {editing === c._id && draft && !isBreakdown && (
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

                {/* ⚠ THE ONE CHANGE THAT STRANDS COPY. Dropping `each` stops the
                    server emitting the per-notebook instances, and their
                    descriptions stay in the database with no row that can reach
                    or delete them. Nothing cascades — only deleting the chart
                    does that. */}
                {c.scope === "each" && draft.scope === "overall" && (
                  <div style={{ color: "#b00", fontSize: 11, flexBasis: "100%" }}>
                    Switching to “overall” hides the per-notebook rows. Their
                    descriptions are kept but become unreachable — switch back to
                    edit or clear them.
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

