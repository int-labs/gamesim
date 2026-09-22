import { useEffect, useState } from "react";
import {
  getLeaderboardConfig,
  putLeaderboardConfig,
  patchLeaderboardConfig,
  getLeaderboardSources,
} from "../api";

/**
 * How the competitor report's leaderboard is scored, per simulationType.
 *
 * The weighting used to be a hand-edited block at the top of
 * `server/scripts/exportRoundData.mjs`, so changing it needed a developer.
 *
 * The SCORE, stated on the page because a weight means nothing without it:
 *
 *     rank   — teams ordered by the metric's direction; ties share the better rank
 *     points = weight x (N - rank + 1)      N = teams that HAVE a figure
 */

interface Metric {
  key: string;
  label: string;
  /** Who computes the value. See the note in models/leaderboardConfig.ts. */
  origin: "server" | "client";
  source: string;
  weight: number;
  format: "money" | "number" | "percent";
  direction: "desc" | "asc";
}

const BLANK: Metric = {
  key: "", label: "", origin: "server", source: "revenue",
  weight: 0, format: "number", direction: "desc",
};

export default function LeaderboardConfigPage() {
  const [simTypeId, setSimTypeId] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [serverSources, setServerSources] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // From the SERVER, never a second copy: a dropdown listing a source the
  // scorer rejects is a save that fails for a reason the page caused.
  useEffect(() => {
    getLeaderboardSources()
      .then((r) => setServerSources(r.data?.serverSources ?? r.data?.sources ?? []))
      .catch((e) => setError(e.response?.data?.message ?? e.message));
  }, []);

  /**
   * What the SERVER currently holds, kept beside the editable copy.
   *
   * Two states, not one: without it the page cannot show whether a change has
   * been saved, whether anything is stored at all, or what a PATCH would be
   * merging into. `null` means nothing has been loaded yet; `[]` means loaded
   * and genuinely empty.
   */
  const [stored, setStored] = useState<Metric[] | null>(null);

  const load = async () => {
    if (!simTypeId) return;
    setError(""); setNote("");
    try {
      const r = await getLeaderboardConfig(simTypeId);
      const saved: Metric[] = r.data?.metrics ?? [];
      setStored(saved);
      // A COPY, so editing the table cannot mutate what we are showing as
      // stored — the two would then always look identical and the comparison
      // would be worthless.
      setMetrics(saved.map((m) => ({ ...m })));
      setNote(saved.length === 0 ? "No weighting configured yet for this type." : "");
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    }
  };

  /** Metrics whose fields differ from what is stored, plus any that are new. */
  const changedMetrics = (): Metric[] => {
    const before = new Map((stored ?? []).map((m) => [m.key, m]));
    return metrics.filter((m) => {
      const was = before.get(m.key);
      return !was || JSON.stringify(was) !== JSON.stringify(m);
    });
  };

  /** Keys that were stored and are no longer in the table. */
  const removedKeys = (): string[] => {
    const now = new Set(metrics.map((m) => m.key));
    return (stored ?? []).map((m) => m.key).filter((k) => !now.has(k));
  };

  const total = metrics.reduce((a, m) => a + (Number(m.weight) || 0), 0);
  // Shown live rather than only on save — the operator is doing arithmetic in
  // their head otherwise, and the server will reject anything but 100.
  const totalOk = metrics.length === 0 || Math.abs(total - 100) < 1e-9;

  const patch = (i: number, field: keyof Metric, value: string) => {
    setMetrics((prev) =>
      prev.map((m, j) => {
        if (j !== i) return m;
        const next = { ...m, [field]: field === "weight" ? Number(value) : value } as Metric;
        // Switching origin RESETS source: the two halves have disjoint valid
        // values, so carrying "revenue" into a client metric — or a declared
        // key into a server one — saves a row the server will reject.
        if (field === "origin" && value !== m.origin) {
          next.source = value === "server" ? (serverSources[0] ?? "revenue") : "";
        }
        return next;
      }),
    );
  };

  /** REPLACE the whole set. What you want on a first save, or after reordering
   *  or rewriting the table wholesale. */
  const save = async () => {
    setError(""); setNote(""); setLoading(true);
    try {
      const r = await putLeaderboardConfig(simTypeId, metrics);
      setStored(r.data?.metrics ?? metrics);
      setNote("Saved (replaced).");
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * MERGE only what changed. Sends the edited and new metrics plus the keys
   * that were removed — so a metric nobody touched is left exactly as stored,
   * rather than being rewritten with whatever this page happens to hold.
   */
  const patchChanges = async () => {
    setError(""); setNote(""); setLoading(true);
    try {
      const changed = changedMetrics();
      const removeKeys = removedKeys();
      if (changed.length === 0 && removeKeys.length === 0) {
        setNote("Nothing changed.");
        return;
      }
      const r = await patchLeaderboardConfig(simTypeId, { metrics: changed, removeKeys });
      const saved: Metric[] = r.data?.metrics ?? [];
      setStored(saved);
      setMetrics(saved.map((m) => ({ ...m })));
      setNote(`Patched ${changed.length} metric(s)${removeKeys.length ? `, removed ${removeKeys.length}` : ""}.`);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Leaderboard Config</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {note && <p style={{ color: "#333" }}>{note}</p>}

      <label>
        Simulation Type ID:{" "}
        <input value={simTypeId} onChange={(e) => setSimTypeId(e.target.value)} style={{ width: 260 }} />
      </label>{" "}
      <button onClick={load} disabled={!simTypeId}>Load</button>

      {/* WHAT THE SERVER HOLDS, beside the editor rather than instead of it.
          Without this the page cannot show whether an edit has been saved, and
          a PATCH would be merging into something invisible. */}
      {stored !== null && (
        <div style={{ marginTop: 12, padding: 8, border: "1px solid #ddd", background: "#fafafa" }}>
          <strong>Stored config</strong>{" "}
          <span style={{ fontSize: 12, color: "#555" }}>
            ({stored.length} metric{stored.length === 1 ? "" : "s"}, weights total{" "}
            {stored.reduce((a, m) => a + (Number(m.weight) || 0), 0)})
          </span>
          {stored.length === 0 ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#555" }}>
              Nothing saved for this simulation type yet — use <strong>Replace</strong> for the first save.
            </p>
          ) : (
            <table border={1} cellPadding={3} style={{ marginTop: 6, fontSize: 12 }}>
              <thead>
                <tr><th>Key</th><th>Label</th><th>Computed by</th><th>Source</th><th>Weight</th><th>Format</th><th>Rank by</th></tr>
              </thead>
              <tbody>
                {stored.map((m) => {
                  const now = metrics.find((x) => x.key === m.key);
                  const edited = !now || JSON.stringify(now) !== JSON.stringify(m);
                  return (
                    // Marked rather than merely listed: the point of showing
                    // this is to see what a save would actually change.
                    <tr key={m.key} style={edited ? { background: "#fff6d6" } : undefined}>
                      <td>{m.key}{!now && " (removed)"}</td>
                      <td>{m.label}</td>
                      <td>{m.origin}</td>
                      <td>{m.source}</td>
                      <td>{m.weight}</td>
                      <td>{m.format}</td>
                      <td>{m.direction === "asc" ? "lowest wins" : "highest wins"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {simTypeId && (
        <>
          <h3 style={{ marginTop: 16 }}>
            Metrics{" "}
            <span style={{ color: totalOk ? "green" : "red", fontWeight: "normal" }}>
              (weights total {total}{totalOk ? "" : " — must be 100"})
            </span>
          </h3>

          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>Key</th><th>Label</th><th>Computed by</th><th>Source</th>
                <th>Weight</th><th>Format</th><th>Rank by</th><th></th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={i}>
                  <td><input value={m.key} onChange={(e) => patch(i, "key", e.target.value)} style={{ width: 110 }} /></td>
                  <td><input value={m.label} onChange={(e) => patch(i, "label", e.target.value)} style={{ width: 140 }} /></td>
                  <td>
                    <select value={m.origin} onChange={(e) => patch(i, "origin", e.target.value)}>
                      <option value="server">server (calcFinancials)</option>
                      <option value="client">client (run report)</option>
                    </select>
                  </td>
                  <td>
                    {/* A DROPDOWN for server metrics — the value has to be a
                        field calcFinancials produces. A free text box for
                        client ones — the key is declared here and the player
                        reads it back, so this is where it is invented. */}
                    {m.origin === "server" ? (
                      <select value={m.source} onChange={(e) => patch(i, "source", e.target.value)}>
                        {serverSources.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input
                        value={m.source}
                        onChange={(e) => patch(i, "source", e.target.value)}
                        placeholder="e.g. insightCorrect"
                        style={{ width: 150 }}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="number" value={m.weight}
                      onChange={(e) => patch(i, "weight", e.target.value)}
                      style={{ width: 70 }}
                    />
                  </td>
                  <td>
                    <select value={m.format} onChange={(e) => patch(i, "format", e.target.value)}>
                      <option value="money">money</option>
                      <option value="number">number</option>
                      <option value="percent">percent</option>
                    </select>
                  </td>
                  <td>
                    <select value={m.direction} onChange={(e) => patch(i, "direction", e.target.value)}>
                      <option value="desc">highest wins</option>
                      <option value="asc">lowest wins</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => setMetrics((p) => p.filter((_, j) => j !== i))}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 8 }}>
            <button onClick={() => setMetrics((p) => [...p, { ...BLANK }])}>+ Add metric</button>{" "}
            {/* PATCH merges only what changed; REPLACE sends the whole set.
                Patch is disabled with nothing stored — the server 404s there,
                because PUT creates and PATCH edits. */}
            <button onClick={patchChanges} disabled={loading || !totalOk || !stored?.length}>
              {loading ? "Saving…" : "Patch changes"}
            </button>{" "}
            <button onClick={save} disabled={loading || !totalOk}>
              {loading ? "Saving…" : "Replace all"}
            </button>
            {stored !== null && (
              <span style={{ marginLeft: 8, fontSize: 12, color: "#555" }}>
                {changedMetrics().length} changed, {removedKeys().length} removed
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
