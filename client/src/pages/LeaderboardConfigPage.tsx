import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, DataTable, Heading, Input, PageHeader, Select, Text, TextField, type DataTableColumn } from "@stratagem/design-system";
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

  const storedColumns: DataTableColumn<Metric>[] = [
    {
      id: "key",
      header: "Key",
      primary: true,
      cell: (m) => {
        const now = metrics.find((x) => x.key === m.key);
        const edited = !now || JSON.stringify(now) !== JSON.stringify(m);
        // Marked rather than merely listed: the point of showing this is to see what a save would change
        return (
          <span className="flex items-center gap-2">
            {m.key}{!now && " (removed)"}
            {edited && <Badge tone="warning">edited</Badge>}
          </span>
        );
      },
    },
    { id: "label", header: "Label", cell: (m) => m.label },
    { id: "origin", header: "Computed by", cell: (m) => m.origin },
    { id: "source", header: "Source", cell: (m) => m.source },
    { id: "weight", header: "Weight", cell: (m) => m.weight },
    { id: "format", header: "Format", cell: (m) => m.format },
    { id: "direction", header: "Rank by", cell: (m) => (m.direction === "asc" ? "lowest wins" : "highest wins") },
  ];

  // Rows keyed by array position, exactly as before; see the flag in the handover
  const editRows = metrics.map((m, i) => ({ m, i }));

  const editColumns: DataTableColumn<{ m: Metric; i: number }>[] = [
    { id: "key", header: "Key", cell: ({ m, i }) => <Input size="sm" className="w-28" aria-label="Key" value={m.key} onChange={(e) => patch(i, "key", e.target.value)} /> },
    { id: "label", header: "Label", cell: ({ m, i }) => <Input size="sm" className="w-36" aria-label="Label" value={m.label} onChange={(e) => patch(i, "label", e.target.value)} /> },
    {
      id: "origin",
      header: "Computed by",
      cell: ({ m, i }) => (
        <Select size="sm" width="fit" aria-label="Computed by" value={m.origin} onValueChange={(v) => v && patch(i, "origin", v)} options={ORIGIN_OPTIONS} />
      ),
    },
    {
      id: "source",
      header: "Source",
      // A dropdown for server metrics (a field calcFinancials produces); free text for client ones, declared here
      cell: ({ m, i }) => m.origin === "server" ? (
        <Select
          size="sm"
          width="fit"
          aria-label="Source"
          value={m.source || null}
          onValueChange={(v) => v && patch(i, "source", v)}
          options={serverSources.map((s) => ({ value: s, label: s }))}
        />
      ) : (
        <Input size="sm" className="w-40" aria-label="Source" value={m.source} onChange={(e) => patch(i, "source", e.target.value)} placeholder="e.g. insightCorrect" />
      ),
    },
    { id: "weight", header: "Weight", cell: ({ m, i }) => <Input size="sm" className="w-20" aria-label="Weight" type="number" value={m.weight} onChange={(e) => patch(i, "weight", e.target.value)} /> },
    {
      id: "format",
      header: "Format",
      cell: ({ m, i }) => (
        <Select size="sm" width="fit" aria-label="Format" value={m.format} onValueChange={(v) => v && patch(i, "format", v)} options={FORMAT_OPTIONS} />
      ),
    },
    {
      id: "direction",
      header: "Rank by",
      cell: ({ m, i }) => (
        <Select size="sm" width="fit" aria-label="Rank by" value={m.direction} onValueChange={(v) => v && patch(i, "direction", v)} options={DIRECTION_OPTIONS} />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Leaderboard Config" />
      {error && <Alert tone="danger">{error}</Alert>}
      {note && <Alert tone="info">{note}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Simulation Type ID" value={simTypeId} onChange={(e) => setSimTypeId(e.target.value)} />
        <Button variant="outline" onClick={load} disabled={!simTypeId}>Load</Button>
      </div>

      {/* What the server holds, beside the editor, so a save and a PATCH target are visible */}
      {stored !== null && (
        <Card variant="panel">
          <div className="flex flex-wrap items-baseline gap-2">
            <Heading level={3} variant="heading-sm">Stored config</Heading>
            <Text as="span" variant="caption" tone="muted">
              ({stored.length} metric{stored.length === 1 ? "" : "s"}, weights total{" "}
              {stored.reduce((a, m) => a + (Number(m.weight) || 0), 0)})
            </Text>
          </div>
          {stored.length === 0 ? (
            <Text variant="caption" tone="muted">
              Nothing saved for this simulation type yet — use <strong>Replace</strong> for the first save.
            </Text>
          ) : (
            <DataTable label="Stored config" density="compact" columns={storedColumns} rows={stored} rowKey={(m) => m.key} />
          )}
        </Card>
      )}

      {simTypeId && (
        <Card>
          <div className="flex flex-wrap items-baseline gap-2">
            <Heading level={3}>Metrics</Heading>
            <Text as="span" tone={totalOk ? "success" : "danger"}>
              (weights total {total}{totalOk ? "" : " — must be 100"})
            </Text>
          </div>

          <DataTable
            label="Metrics"
            density="compact"
            columns={editColumns}
            rows={editRows}
            rowKey={({ i }) => String(i)}
            rowActions={({ i }) => (
              <Button variant="text" tone="danger" onClick={() => setMetrics((p) => p.filter((_, j) => j !== i))}>Remove</Button>
            )}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setMetrics((p) => [...p, { ...BLANK }])}>+ Add metric</Button>
            {/* PATCH merges what changed and needs something stored (the server 404s otherwise); REPLACE sends the whole set */}
            <Button variant="outline" onClick={patchChanges} disabled={loading || !totalOk || !stored?.length}>
              {loading ? "Saving…" : "Patch changes"}
            </Button>
            <Button onClick={save} disabled={loading || !totalOk}>
              {loading ? "Saving…" : "Replace all"}
            </Button>
            {stored !== null && (
              <Text as="span" variant="caption" tone="muted">
                {changedMetrics().length} changed, {removedKeys().length} removed
              </Text>
            )}
          </div>
        </Card>
      )}
    </>
  );
}

const ORIGIN_OPTIONS = [
  { value: "server", label: "server (calcFinancials)" },
  { value: "client", label: "client (run report)" },
];

const FORMAT_OPTIONS = ["money", "number", "percent"].map((f) => ({ value: f, label: f }));

const DIRECTION_OPTIONS = [
  { value: "desc", label: "highest wins" },
  { value: "asc", label: "lowest wins" },
];
