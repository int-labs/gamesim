/**
 * Export every decision a team made, as a comparison MATRIX.
 *
 *   node scripts/exportRoundData.mjs --email <staff> --password <pw> --sim <simulationId>
 *   node scripts/exportRoundData.mjs --token <jwt> --sim <id> --round 0 --out ./exports
 *
 * Options:
 *   --email / --password   Staff credentials (alternative to --token)
 *   --token                Pre-issued JWT (skips login)
 *   --sim                  simulationId (required)
 *   --round                One round number, 0-BASED (default: every round)
 *   --out                  Output directory (default: current directory)
 *
 * Env: GAMESIM_API_URL (default http://localhost:5000/api)
 *
 * ── SHAPE ───────────────────────────────────────────────────────────────────
 * TEAMS ACROSS THE TOP, every decision cascading down the side. One file per
 * round, so each stays a single rectangle:
 *
 *   decisions_<simId>_round<N>.csv
 *
 *   Section              Decision            Team 1   Team 2   Team 3
 *   Financial            Gross Profit        781.62   -510.00  1367.60
 *   Notebook: Anime      Made this notebook  Yes      No       Yes
 *   Notebook: Anime      Paper Material      black    -        black
 *   Notebook: Anime      Page Size           a5       -        b5
 *   Sales Channels       Retail              Yes      -        -
 *   Hiring               Production Lead     2        -        1
 *
 * This is a REPORT, read by a person comparing teams — not a pivot source. It
 * is deliberately transposed relative to a tidy table: the question it answers
 * is "what did each team choose, side by side", and the row order is the
 * cascade — money first, then each notebook with its own design decisions
 * nested under it, then every company-wide lever.
 *
 * ── SECTIONS AND ROWS COME FROM THE BACKEND ─────────────────────────────────
 * Notebook sections are the `Product` documents in `order`; their rows are that
 * product's own `fields[]`, by `order`, labelled with `field.label`. Lever
 * sections are the `GlobalInput` containers, and their rows are each
 * container's `inputs[]`. So a product field, a channel, a marketing option, a
 * candidate or a vendor the operator adds appears here with no code change, and
 * nothing is hardcoded — no channel triple, no genre list, no product names.
 *
 * A row is emitted for EVERY configured option, not only the chosen ones: a
 * blank cell is a decision too, and a matrix that hid unchosen levers could not
 * be compared across teams.
 *
 * ── WHY THE PREVIOUS VERSION WAS REPLACED ───────────────────────────────────
 * It read `Projections` (what-if, rewritten on every keystroke) rather than
 * `Decision.scored`; it attributed each product's revenue across channels using
 * a hardcoded genre × channel split matrix, a calculation the server does not
 * perform; and it read channel selections out of `inputs[].fields`, where they
 * have never lived — they are `globalInputs` selections — so that lookup was
 * always all-zero and every attributed revenue cell was 0.
 *
 * Nothing here is recomputed. Financials are summed across a team's products
 * because a column is a team, and that is the only arithmetic in the file.
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

// ── HTTP ─────────────────────────────────────────────────────────────────────
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

/** Some endpoints answer with a bare array, others wrap it in `data`. */
const list = (res) => (Array.isArray(res) ? res : (res?.data ?? []));

async function login() {
  const data = await api("POST", "/users/login", { email: EMAIL, password: PASSWORD });
  token = data.token;
  console.error(`[auth] signed in as ${EMAIL}`);
}

// ── CSV ──────────────────────────────────────────────────────────────────────
const cell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};
const row = (cols) => cols.map(cell).join(",");

/** What an unmade decision looks like. One constant so the matrix reads
 *  consistently — an empty cell is indistinguishable from a missing column.
 *  Declared before `num`, which returns it. */
const BLANK = "-";

const num = (n, dp = 2) => (n == null ? BLANK : Number(n).toFixed(dp));

// ── The matrix ───────────────────────────────────────────────────────────────
function buildMatrix(roundNumber, decisions, teams, products, containers) {
  // One column per team, in the roster's own order so successive rounds line up.
  const byTeam = new Map(decisions.map((d) => [String(d.teamId), d]));
  const cols = teams.map((t) => ({ id: String(t._id), name: t.teamName ?? String(t._id) }));

  const rows = [];
  /** `valueFor` runs once per team, left to right. */
  const emit = (section, decision, valueFor) =>
    rows.push([section, decision, ...cols.map((c) => valueFor(byTeam.get(c.id) ?? null))]);

  // ── Financial ──────────────────────────────────────────────────────────────
  // Summed across the team's products, because a column is a TEAM. Blank for a
  // round the operator has not calculated — `scored` is absent until then, and
  // zeros would read as a scored round of nothing.
  const sumScored = (dec, pick) => {
    if (!dec?.scored) return null;
    return Object.values(dec.scored).reduce((a, m) => a + (Number(pick(m)) || 0), 0);
  };
  const FINANCIALS = [
    ["Revenue",            (m) => m.revenue],
    ["COGS",               (m) => m.COGS],
    ["Gross Profit",       (m) => m.grossProfit],
    ["Operating Expenses", (m) => m.operatingExpenses],
    ["Operating Profit",   (m) => m.operatingProfit],
    ["Customers Obtained", (m) => m.customersObtained],
  ];
  for (const [label, pick] of FINANCIALS) {
    emit("Financial", label, (dec) => num(sumScored(dec, pick)));
  }
  rows.push([]);

  // ── One section per notebook, its own fields nested beneath ────────────────
  // `order` is the operator's, so the cascade follows the order they authored.
  const orderedProducts = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const p of orderedProducts) {
    const section = `Notebook: ${p.productName ?? p._id}`;
    const inputFor = (dec) =>
      (dec?.inputs ?? []).find((i) => String(i.productId?.$oid ?? i.productId) === String(p._id)) ?? null;

    emit(section, "Made this notebook", (dec) => (inputFor(dec) ? "Yes" : "No"));
    emit(section, "Produce / phase", (dec) => {
      const inp = inputFor(dec);
      // `null` is "not stated", which the server builds NOTHING for — distinct
      // from an explicit 0 the team typed.
      return inp && inp.produced != null ? String(inp.produced) : BLANK;
    });

    const fields = [...(p.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const f of fields) {
      emit(section, f.label ?? f.key, (dec) => {
        const inp = inputFor(dec);
        if (!inp) return BLANK;
        const hit = (inp.fields ?? []).find(
          (x) => String(x.fieldId?.$oid ?? x.fieldId) === String(f._id),
        );
        // The raw submitted value: for an enum field that is the option KEY the
        // server resolves through `options`, and re-deriving a label here would
        // be a second interpretation of the decision.
        return hit == null || hit.value == null || hit.value === "" ? BLANK : String(hit.value);
      });
    }
    rows.push([]);
  }

  // ── One section per lever container ────────────────────────────────────────
  // Channels, marketing, hiring, vendors — whatever the operator configured.
  // Every ITEM gets a row, chosen or not.
  for (const gi of containers) {
    const section = gi.label ?? gi.category ?? gi.key;
    for (const item of gi.inputs ?? []) {
      emit(section, item.label ?? item.key, (dec) => {
        const sel = (dec?.globalInputs ?? []).find(
          (g) => String(g.globalInputItemId?.$oid ?? g.globalInputItemId) === String(item._id),
        );
        if (!sel) return BLANK;
        // A stepped lever records WHICH step; a binary one has no step key, so
        // its presence IS the selection.
        return sel.selectedStepKey != null && sel.selectedStepKey !== ""
          ? String(sel.selectedStepKey)
          : "Yes";
      });
    }
    rows.push([]);
  }

  const header = ["Section", "Decision", ...cols.map((c) => c.name)];
  const body = [row(header), ...rows.map(row)].join("\n") + "\n";
  return { body, teamCount: cols.length, rowCount: rows.filter((r) => r.length > 0).length, roundNumber };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!token) await login();

  const teams = list(await api("GET", `/teams?simulationId=${SIM_ID}`));
  console.error(`[teams] ${teams.length}`);
  if (teams.length === 0) throw new Error("no teams on this simulation — nothing to compare");

  const sim = await api("GET", `/simulations/${SIM_ID}`);
  const simTypeId = sim.simulationTypeId ?? sim.simulationType;

  const products = list(await api("GET", `/products?simulationTypeId=${simTypeId}`));
  console.error(`[products] ${products.length}`);

  const containers = list(await api("GET", `/global-inputs?simulationTypeId=${simTypeId}`));
  const itemCount = containers.reduce((a, g) => a + (g.inputs?.length ?? 0), 0);
  console.error(`[global-inputs] ${containers.length} container(s), ${itemCount} item(s)`);

  const qs = new URLSearchParams({ simulationId: SIM_ID });
  if (ROUND) qs.set("roundNumber", ROUND);
  const decisions = list(await api("GET", `/decisions?${qs}`));
  console.error(`[decisions] ${decisions.length}`);

  // One matrix per round. Grouped from the decisions themselves rather than
  // from the round list, so a round nobody submitted to produces no file
  // instead of an empty grid.
  const byRound = new Map();
  for (const d of decisions) {
    const r = Number(d.roundNumber);
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r).push(d);
  }
  if (byRound.size === 0) {
    console.error("[warn] no decisions found — has any team submitted?");
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  for (const r of [...byRound.keys()].sort((a, b) => a - b)) {
    const m = buildMatrix(r, byRound.get(r), teams, products, containers);
    const p = join(OUT_DIR, `decisions_${SIM_ID}_round${r}.csv`);
    writeFileSync(p, m.body, "utf8");
    console.error(`[write] ${p}  (${m.rowCount} decisions × ${m.teamCount} teams)`);
  }

  console.error("[done]");
}

main().catch((err) => { console.error("[error]", err.message); process.exit(1); });
