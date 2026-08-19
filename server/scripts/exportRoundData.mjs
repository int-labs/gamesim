/**
 * Export round projections and results for a simulation as pivoted CSV files.
 *
 *   node scripts/exportRoundData.mjs --email <staff> --password <pw> --sim <simulationId>
 *   node scripts/exportRoundData.mjs --email … --password … --sim <id> --round 1
 *   node scripts/exportRoundData.mjs --token <jwt> --sim <id> --out ./exports
 *
 * Options:
 *   --email / --password   Staff credentials (alternative to --token)
 *   --token                Pre-issued JWT (skips login)
 *   --sim                  simulationId (required)
 *   --round                Filter to a specific round number (optional)
 *   --out                  Output directory (default: current directory)
 *
 * Writes two files:
 *   projections_<simId>[_roundN].csv
 *     Pivoted: one section per productId, rows = teams, columns = metrics
 *   results_<simId>[_roundN].csv
 *     Pivoted: one section per product×segment, rows = teams, columns = score + share
 *
 * Env: GAMESIM_API_URL (default http://localhost:5000/api)
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";

const API = (process.env.GAMESIM_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");

// ── Args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (n, d = undefined) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const EMAIL     = opt("email",    process.env.ADMIN_EMAIL);
const PASSWORD  = opt("password", process.env.ADMIN_PASSWORD);
const TOKEN_ARG = opt("token",    process.env.GAMESIM_TOKEN);
const SIM_ID    = opt("sim");
const ROUND     = opt("round");
const OUT_DIR   = resolve(opt("out", "."));

if (!SIM_ID) {
  console.error("usage: node scripts/exportRoundData.mjs --sim <simulationId> [--round N] [--email E --password P | --token T] [--out ./dir]");
  process.exit(2);
}
if (!TOKEN_ARG && (!EMAIL || !PASSWORD)) {
  console.error("error: supply --token OR both --email and --password");
  process.exit(2);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
let token = TOKEN_ARG ?? null;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function login() {
  const data = await api("POST", "/users/login", { email: EMAIL, password: PASSWORD });
  token = data.token;
  console.error(`[auth] signed in as ${EMAIL}`);
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
const cell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};
const row  = (...cols) => cols.map(cell).join(",");
const num  = (n, dp = 4) => (n == null ? "" : Number(n).toFixed(dp));
const int  = (n) => (n == null ? "" : String(Math.round(Number(n))));

// ── Channel split weights (mirrors engine/finlit/core/config/channels.ts) ────
// Revenue is attributed to each active channel proportionally by its split
// weight — the same formula the engine uses for channel costs.
const CHANNEL_SPLITS = {
  cute:       { offline: 0.35, online: 0.35, retail: 0.30 },
  anime:      { offline: 0.30, online: 0.40, retail: 0.30 },
  minimalist: { offline: 0.30, online: 0.30, retail: 0.40 },
  indie:      { offline: 0.40, online: 0.30, retail: 0.30 },
};
const PRODUCT_GENRE = {
  "Cute Notebook":       "cute",
  "Anime Notebook":      "anime",
  "Minimalist Notebook": "minimalist",
  "Indie Notebook":      "indie",
};

function attributeRevenue(totalRevenue, activeChannels, genre) {
  const splits = CHANNEL_SPLITS[genre] ?? { offline: 1/3, online: 1/3, retail: 1/3 };
  const activeSplitSum = activeChannels.reduce((s, ch) => s + (splits[ch] ?? 0), 0) || 1;
  return {
    offline: activeChannels.includes("offline") ? totalRevenue * (splits.offline / activeSplitSum) : 0,
    online:  activeChannels.includes("online")  ? totalRevenue * (splits.online  / activeSplitSum) : 0,
    retail:  activeChannels.includes("retail")  ? totalRevenue * (splits.retail  / activeSplitSum) : 0,
  };
}

// ── Pivoted projections ───────────────────────────────────────────────────────
// Grouped by channel combination. Each block = one distinct combination of
// active channels (offline, online, retail). Teams that didn't activate any
// channel are excluded. Within each block rows are: team × product, sorted by
// teamName then product name, so combinations can be compared directly.
//
// Combination labels use × as separator, e.g. "offline × online".
// Order of blocks: single channels first (alpha), then pairs, then triple.
function buildProjectionsCsv(docs, teamMap, productMap, channelLookup, decisionLookup) {
  // Flatten to one entry per teamId × productId × round
  const rows = [];
  for (const p of docs) {
    for (const [productId, proj] of Object.entries(p.projections ?? {})) {
      rows.push({ roundNumber: p.roundNumber, teamId: String(p.teamId), productId, proj });
    }
  }

  // Enrich each row with attributed revenue per channel
  const ALL_CH = ["offline", "online", "retail"];
  const enriched = rows.map((r) => {
    const ch = channelLookup?.get(`${r.teamId}:${r.productId}`);
    const active = ch ? ALL_CH.filter((c) => ch[c] === 1) : [];
    const productName = productMap.get(r.productId) ?? r.productId;
    const genre = PRODUCT_GENRE[productName] ?? "indie";
    const totalRev = Number(r.proj.revenue ?? 0);
    const rev = active.length > 0
      ? attributeRevenue(totalRev, active, genre)
      : { offline: 0, online: 0, retail: 0 };
    return { ...r, productName, totalRev, rev };
  });

  // Group by productId for sub-sections
  const byProduct = new Map();
  for (const r of enriched) {
    if (!byProduct.has(r.productName)) byProduct.set(r.productName, []);
    byProduct.get(r.productName).push(r);
  }

  const PROJ_HEADER = row(
    "teamName", "roundNumber", "score", "unit_cost", "revenue", "customersObtained", "sellingPrice", "cogs", "grossProfit",
  );

  const blocks = [];
  for (const ch of ALL_CH) {
    const lines = [`channel: ${ch}`];
    for (const [productName, entries] of [...byProduct.entries()].sort()) {
      entries.sort((a, b) =>
        (teamMap.get(a.teamId) ?? a.teamId).localeCompare(teamMap.get(b.teamId) ?? b.teamId) ||
        a.roundNumber - b.roundNumber
      );
      lines.push(`product: ${productName}`, PROJ_HEADER);
      for (const { roundNumber, teamId, proj, rev, productId } of entries) {
        const dv = decisionLookup?.get(`${teamId}:${productId}`);
        lines.push(row(
          teamMap.get(teamId) ?? teamId,
          roundNumber,
          num(dv?.score, 4),
          num(dv?.unit_cost, 2),
          num(rev[ch], 2),
          int(proj.customersObtained),
          num(proj.sellingPrice, 2),
          num(proj.COGS, 2),
          num(proj.grossProfit, 2),
        ));
      }
      lines.push("");
    }
    blocks.push(lines.join("\n").trimEnd());
  }

  return blocks.join("\n\n") + "\n";
}

// ── Coalesced results ─────────────────────────────────────────────────────────
// One row per team. Scores and shares are averaged across all product×segment
// combinations so teams can be ranked without the product breakdown.
function buildCoalescedResults(docs, teamMap) {
  // Accumulate per teamId: sum of scores, sum of shares, count of entries
  const acc = new Map(); // teamId → { scoreSum, shareSum, count, roundNumber }
  for (const r of docs) {
    for (const [teamId, score] of Object.entries(r.weightedScores ?? {})) {
      if (!acc.has(teamId)) acc.set(teamId, { scoreSum: 0, shareSum: 0, count: 0, roundNumber: r.roundNumber });
      const a = acc.get(teamId);
      a.scoreSum += score;
      a.shareSum += r.marketShares?.[teamId] ?? 0;
      a.count += 1;
    }
  }

  // Sort by avg score desc
  const teams = [...acc.entries()].sort((a, b) => (b[1].scoreSum / b[1].count) - (a[1].scoreSum / a[1].count));

  const lines = [
    "section: results",
    row("rank", "teamName", "roundNumber", "avgScore", "avgMarketSharePct"),
  ];
  teams.forEach(([teamId, a], idx) => {
    lines.push(row(
      idx + 1,
      teamMap.get(teamId) ?? teamId,
      a.roundNumber,
      num(a.scoreSum / a.count, 4),
      num((a.shareSum / a.count) * 100, 2),
    ));
  });

  return lines.join("\n");
}

// ── Round report (combined) ───────────────────────────────────────────────────
function buildRoundReport(results, projections, teamMap, productMap, channelLookup, decisionLookup) {
  const resultsSection = buildCoalescedResults(results, teamMap);
  const projectionsSection = "section: projections\n" + buildProjectionsCsv(projections, teamMap, productMap, channelLookup, decisionLookup).trimEnd();
  return resultsSection + "\n\n" + projectionsSection + "\n";
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!token) await login();

  // Fetch team names
  console.error(`[fetch] teams        sim=${SIM_ID}`);
  const teamsRes = await api("GET", `/teams?simulationId=${SIM_ID}`);
  const teamList = Array.isArray(teamsRes) ? teamsRes : (teamsRes.data ?? []);
  const teamMap  = new Map(teamList.map((t) => [String(t._id), t.teamName]));
  console.error(`[teams] resolved ${teamMap.size} team names`);

  // Resolve simulationTypeId so we can fetch products + segments
  const sim = await api("GET", `/simulations/${SIM_ID}`);
  const simTypeId = sim.simulationTypeId ?? sim.simulationType;

  console.error(`[fetch] products     simType=${simTypeId}`);
  const productsRes = await api("GET", `/products?simulationTypeId=${simTypeId}`);
  const productMap  = new Map((Array.isArray(productsRes) ? productsRes : []).map((p) => [String(p._id), p.productName]));
  console.error(`[products] resolved ${productMap.size} product names`);

  console.error(`[fetch] segments     simType=${simTypeId}`);
  const segmentsRes = await api("GET", `/segments?simulationTypeId=${simTypeId}`);
  const segmentMap  = new Map((Array.isArray(segmentsRes) ? segmentsRes : []).map((s) => [String(s._id), s.name]));
  console.error(`[segments] resolved ${segmentMap.size} segment names`);

  const qs = new URLSearchParams({ simulationId: SIM_ID });
  if (ROUND) qs.set("roundNumber", ROUND);

  console.error(`[fetch] projections  sim=${SIM_ID}${ROUND ? ` round=${ROUND}` : ""}`);
  const projections = await api("GET", `/projections?${qs}`);

  console.error(`[fetch] results      sim=${SIM_ID}${ROUND ? ` round=${ROUND}` : ""}`);
  const results = await api("GET", `/results?${qs}`);

  mkdirSync(OUT_DIR, { recursive: true });

  const suffix = ROUND ? `_round${ROUND}` : "";
  console.error(`[fetch] decisions    sim=${SIM_ID}${ROUND ? ` round=${ROUND}` : ""}`);
  const decisions = await api("GET", `/decisions?${qs}`);

  // Build fieldId → key map from all product fields
  const fieldKeyMap = new Map();
  for (const [, name] of productMap) { void name; } // already have productMap
  const allProductsRes = await api("GET", `/products?simulationTypeId=${simTypeId}`);
  for (const p of Array.isArray(allProductsRes) ? allProductsRes : []) {
    for (const f of p.fields ?? []) fieldKeyMap.set(String(f._id), f.key);
  }

  // Build per-team per-product decision lookups
  const CHANNEL_KEYS = { channel_offline: "offline", channel_online: "online", channel_retail: "retail" };
  const channelLookup = new Map();   // `${teamId}:${productId}` → { offline, online, retail }
  const decisionLookup = new Map();  // `${teamId}:${productId}` → { score, unit_cost, selling_price }
  for (const dec of decisions) {
    for (const input of dec.inputs ?? []) {
      const key = `${dec.teamId}:${input.productId}`;
      const ch  = { offline: 0, online: 0, retail: 0 };
      const dv  = { score: null, unit_cost: null, selling_price: null };
      for (const f of input.fields ?? []) {
        const fkey = fieldKeyMap.get(String(f.fieldId));
        if (!fkey) continue;
        if (CHANNEL_KEYS[fkey]) ch[CHANNEL_KEYS[fkey]] = f.value === 1 ? 1 : 0;
        if (fkey === "score")         dv.score         = f.value;
        if (fkey === "unit_cost")     dv.unit_cost     = f.value;
        if (fkey === "selling_price") dv.selling_price = f.value;
      }
      channelLookup.set(key, ch);
      decisionLookup.set(key, dv);
    }
  }

  const reportFile = join(OUT_DIR, `round_report_${SIM_ID}${suffix}.csv`);

  writeFileSync(reportFile, buildRoundReport(results, projections, teamMap, productMap, channelLookup, decisionLookup), "utf8");
  console.error(`[write] ${reportFile}`);

  console.error("[done]");
}

main().catch((err) => { console.error("[error]", err.message); process.exit(1); });
