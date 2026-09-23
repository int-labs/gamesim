import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getRoundDebrief } from "../api";
import type { RoundDebrief, DebriefRoundDto } from "../types";

/**
 * The operator's view of a round's debrief — the same figures the player sees
 * on the limbo screen, for projecting during a live debrief session.
 *
 * READ-ONLY and DERIVES NOTHING. Every number comes off `GET /round-debrief`,
 * which is the same endpoint the player client calls; the only transformation
 * here is pivoting teams-as-keys into the row shape recharts wants.
 *
 * ── WHY THE CHARTS ARE NOT SHARED WITH THE PLAYER CLIENT ────────────────────
 * They are separate apps with separate design systems — pixel SVG on Tailwind
 * tokens there, MUI/recharts here — and `recharts` was already a dependency of
 * this app with no importers. What must NOT be duplicated is arithmetic, and
 * there is none: the server ships finished numbers.
 *
 * ── WHAT IS DELIBERATELY MISSING ────────────────────────────────────────────
 * The VoC dot plot. It is the one chart needing a 0..1 normalisation, and that
 * formula (`priceSensitivityFromBounds`, plus the investment position) lives in
 * the player client as the SINGLE definition shared with its market tab.
 * Re-deriving it here would make two. Adding it means either extracting that
 * formula somewhere both repos can read, or accepting a flagged mirror — a
 * decision worth making deliberately rather than in passing.
 */

const COLORS = ["#4C72B0", "#DD8452", "#55A868", "#C44E52", "#9B59B6", "#8C8C8C"];

/** Built from the roster once, read only by teamId — never by array position,
 *  which would repaint a team when the roster order shifts between rounds. */
function palette(teamIds: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  teamIds.forEach((id) => {
    if (!out[id]) out[id] = COLORS[Object.keys(out).length % COLORS.length];
  });
  return out;
}

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function RoundDebriefPage() {
  const [filterSim, setFilterSim] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [data, setData] = useState<RoundDebrief | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // `filterRound` is a STRING and rounds are 0-BASED, so this tests emptiness —
  // `!filterRound` would refuse round 0, which every simulation has.
  const canLoad = filterSim !== "" && filterRound !== "";

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
        What the teams see on their limbo screen after a round is closed. Read-only —
        this changes nothing and does not require the round to be visible to players.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <input
          placeholder="simulationId"
          value={filterSim}
          onChange={(e) => setFilterSim(e.target.value)}
          style={{ width: 280 }}
        />
        <input
          placeholder="roundNumber (0-based)"
          value={filterRound}
          onChange={(e) => setFilterRound(e.target.value)}
          style={{ width: 170 }}
        />
        <button onClick={load} disabled={!canLoad || loading}>
          {loading ? "Loading…" : "Load debrief"}
        </button>
      </div>

      {error && <div style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}
      {data && <DebriefCharts data={data} />}
    </div>
  );
}

function DebriefCharts({ data }: { data: RoundDebrief }) {
  const { teams, rounds, roundNumber } = data;
  const colors = useMemo(() => palette(teams.map((t) => t.teamId)), [teams]);
  const here = rounds.find((r) => r.roundNumber === roundNumber) ?? null;

  /** One row per team — for the single-round comparisons. */
  const byTeamRows = (pick: (t: DebriefRoundDto["teams"][string]) => number | null) =>
    teams.map((t) => ({
      name: t.teamName,
      value: here?.teams[t.teamId] ? pick(here.teams[t.teamId]) : null,
    }));

  /** One row per round, a column per team — for the progress lines. */
  const overRounds = (pick: (t: DebriefRoundDto["teams"][string]) => number | null) =>
    rounds.map((r) => {
      const row: Record<string, number | string | null> = { round: `Round ${r.roundNumber + 1}` };
      for (const t of teams) {
        const block = r.teams[t.teamId];
        row[t.teamName] = block ? pick(block) : null;
      }
      return row;
    });

  // Cost categories are operator FREE TEXT — collected from the payload, never
  // a hardcoded list, or renaming a row on the console drops a whole band.
  const costCategories = useMemo(() => {
    const seen = new Set<string>();
    for (const t of teams) {
      for (const k of Object.keys(here?.teams[t.teamId]?.costByCategory ?? {})) seen.add(k);
    }
    return [...seen].sort();
  }, [teams, here]);

  const leverNames = useMemo(() => {
    const seen = new Set<string>();
    for (const t of teams) {
      for (const k of Object.keys(here?.teams[t.teamId]?.energyByLever ?? {})) seen.add(k);
    }
    return [...seen].sort();
  }, [teams, here]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Panel title="Total energy consumption" note="Energy spent on levers — hiring, vendors, channels, marketing.">
        <SimpleBar rows={byTeamRows((t) => t.energy)} colors={colors} teams={teams} />
      </Panel>

      <Panel title="Cash utilization" note="Opening balance and where it closed.">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={teams.map((t) => ({
            name: t.teamName,
            Start: here?.teams[t.teamId]?.cashOpening ?? null,
            End: here?.teams[t.teamId]?.cashClosing ?? null,
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" /><YAxis tickFormatter={money} />
            <Tooltip formatter={(v: any) => money(Number(v))} /><Legend />
            <Bar dataKey="Start" fill="#B8C7DE" />
            <Bar dataKey="End" fill="#4C72B0" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Total revenue">
        <MultiLine rows={overRounds((t) => t.revenue)} teams={teams} colors={colors} fmt={money} />
      </Panel>

      <Panel title="Gross profit">
        <MultiLine rows={overRounds((t) => t.grossProfit)} teams={teams} colors={colors} fmt={money} />
      </Panel>

      <Panel title="Net profit">
        <MultiLine rows={overRounds((t) => t.netProfit)} teams={teams} colors={colors} fmt={money} />
      </Panel>

      {costCategories.length > 0 && (
        <Panel title="Total cost breakdown" note="Cost rows as the facilitator named them.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teams.map((t) => {
              const row: Record<string, string | number> = { name: t.teamName };
              for (const c of costCategories) row[c] = here?.teams[t.teamId]?.costByCategory[c] ?? 0;
              return row;
            })}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis tickFormatter={money} />
              <Tooltip formatter={(v: any) => money(Number(v))} /><Legend />
              {costCategories.map((c, i) => (
                <Bar key={c} dataKey={c} stackId="cost" fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      <Panel title="Units sold vs demand" note="Demand is the customers each team won; units sold is what stock allowed.">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={teams.map((t) => ({
            name: t.teamName,
            "Customers obtained": here?.teams[t.teamId]?.customersObtained ?? null,
            "Units sold": here?.teams[t.teamId]?.unitsSold ?? null,
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" /><YAxis />
            <Tooltip /><Legend />
            <Bar dataKey="Customers obtained" fill="#DD8452" />
            <Bar dataKey="Units sold" fill="#55A868" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {leverNames.length > 0 && (
        <Panel title="Investment level of operations" note="Energy committed to each kind of lever.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={leverNames.map((l) => {
              const row: Record<string, string | number> = { name: l };
              for (const t of teams) row[t.teamName] = here?.teams[t.teamId]?.energyByLever[l] ?? 0;
              return row;
            })}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis />
              <Tooltip /><Legend />
              {teams.map((t) => (
                <Bar key={t.teamId} dataKey={t.teamName} fill={colors[t.teamId]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}
    </div>
  );
}

function SimpleBar({
  rows, colors, teams,
}: {
  rows: { name: string; value: number | null }[];
  colors: Record<string, string>;
  teams: { teamId: string; teamName: string }[];
}) {
  // One colour per team, resolved by id through the name on the row.
  const byName: Record<string, string> = {};
  for (const t of teams) byName[t.teamName] = colors[t.teamId];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" /><YAxis />
        <Tooltip />
        <Bar dataKey="value" name="Energy" fill={byName[rows[0]?.name] ?? COLORS[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MultiLine({
  rows, teams, colors, fmt,
}: {
  rows: Record<string, number | string | null>[];
  teams: { teamId: string; teamName: string }[];
  colors: Record<string, string>;
  fmt: (n: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="round" /><YAxis tickFormatter={fmt} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} /><Legend />
        {teams.map((t) => (
          <Line
            key={t.teamId}
            type="monotone"
            dataKey={t.teamName}
            stroke={colors[t.teamId]}
            strokeWidth={2}
            // A round a team did not play is a GAP, not a value between its
            // neighbours.
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 12 }}>
      <strong>{title}</strong>
      {note && <div style={{ color: "#666", fontSize: 12, margin: "4px 0 8px" }}>{note}</div>}
      {children}
    </div>
  );
}
