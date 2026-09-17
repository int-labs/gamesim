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
 *   decisions_<simId>_round<N>.pdf
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
 * ── ARITHMETIC IN THIS FILE — read before trusting a figure ──────────────────
 * Most cells are READ, not computed. Three things are computed, and only these:
 *
 *   1. The `Financial` rows SUM a team's per-product `scored` metrics, because a
 *      column is a TEAM. Unchanged behaviour.
 *   2. `Revenue by notebook` / `Customers by notebook` READ `scored[productId]`
 *      per product. No arithmetic at all — `calcFinancials` already computes
 *      per-product revenue; it was simply never shown, because only the summed
 *      `Financial` rows were.
 *   3. `… by channel` APPORTIONS a product's revenue and customers across the
 *      channels the team selected, by each channel's share of demand.
 *
 *      *** THIS IS THE ONLY DERIVED FIGURE IN THE REPORT, AND IT IS A SECOND
 *      IMPLEMENTATION OF A SERVER FORMULA. *** `calcFinancials` computes the
 *      same weights to blend the consignment rate but never persists the split,
 *      so there is no stored field to read. `channelSharesFor` below mirrors its
 *      weighting line for line. The durable fix is for `calcFinancials` to
 *      persist a per-channel split on `scored`, after which this function should
 *      be DELETED rather than kept in step by hand.
 */

import { mkdirSync, createWriteStream } from "fs";
import { resolve, join } from "path";
import PDFDocument from "pdfkit";

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

/** What an unmade decision looks like. One constant so the matrix reads
 *  consistently — an empty cell is indistinguishable from a missing column.
 *  Declared before `num`, which returns it. */
const BLANK = "-";

const num = (n, dp = 2) => (n == null ? BLANK : Number(n).toFixed(dp));

// ── PDF ──────────────────────────────────────────────────────────────────────
//
// The rows are written AS IS — same matrix, same strings, no reformatting. This
// replaced a CSV writer; the only thing that changed is the container.
//
// Courier (the PDF base-14 monospace, so no font file ships with this script)
// and a fixed-width layout, because the whole point of the matrix is that a
// reader scans DOWN a team's column. A proportional face breaks that alignment.
// Landscape A4 for the same reason — columns are teams, and they must fit.
const PAGE = { size: "A4", layout: "landscape", margin: 36 };
const FONT_SIZE = 8;
const LINE_H = 10.5;
/** Courier's advance width is exactly 0.6 em at any size. */
const CHAR_W = FONT_SIZE * 0.6;

const pad = (s, w) => (s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length));
const padLeft = (s, w) => (s.length >= w ? s.slice(0, w) : " ".repeat(w - s.length) + s);

/**
 * One round's matrix as a paginated PDF table.
 *
 * `header` repeats on every page — a 90-row matrix runs over two or three
 * sheets, and a column of bare numbers with the team names left behind on page
 * one is not a report anyone can read.
 *
 * Returns a promise: pdfkit writes through a stream, so the file is not on disk
 * when `end()` returns, and the caller's "[write] …" line would otherwise be a
 * lie the script tells before the bytes land.
 */
function writePdf(path, { title, subtitle, header, rows }) {
  return new Promise((ok, fail) => {
    const doc = new PDFDocument(PAGE);
    const out = createWriteStream(path);
    out.on("finish", ok);
    out.on("error", fail);
    doc.on("error", fail);
    doc.pipe(out);

    // Column widths from the CONTENT, so a long product name or team name is
    // never truncated by a guess. The two label columns are capped; the team
    // columns are numbers and short strings.
    const all = [header, ...rows.filter((r) => r.length > 0)];
    const colCount = header.length;
    const widths = [];
    for (let c = 0; c < colCount; c++) {
      const longest = all.reduce((w, r) => Math.max(w, String(r[c] ?? "").length), 0);
      // Caps sized to the real content — "Notebook: Minimalist Notebook" is 29
      // characters and a 26-cap truncated it to "Notebook: Minimalist Noteb",
      // which is a section heading the reader cannot identify.
      widths.push(Math.min(longest, c === 0 ? 34 : c === 1 ? 48 : 18));
    }

    const usable = doc.page.width - PAGE.margin * 2;
    // Truncation is a LAST resort, so say when it happens rather than letting a
    // wide roster silently lose characters off the right edge.
    const lineChars = widths.reduce((a, w) => a + w, 0) + (colCount - 1) * 2;
    if (lineChars * CHAR_W > usable) {
      console.error(
        `[warn] ${colCount - 2} teams need ${Math.ceil(lineChars * CHAR_W)}pt but the page gives ` +
        `${Math.floor(usable)}pt — right-hand columns will be clipped. Lower FONT_SIZE or split the roster.`,
      );
    }
    const line = (cols, { rightAlign = true } = {}) =>
      cols
        .map((v, c) => {
          const s = String(v ?? "");
          // Labels left, figures right — the same alignment the sheet uses, so
          // a decimal point lines up down a team's column.
          return c < 2 || !rightAlign ? pad(s, widths[c]) : padLeft(s, widths[c]);
        })
        .join("  ");

    let y = 0;
    const startPage = (first) => {
      if (!first) doc.addPage(PAGE);
      y = PAGE.margin;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#000")
        .text(title, PAGE.margin, y, { width: usable });
      y += 16;
      if (subtitle) {
        doc.font("Helvetica").fontSize(8).fillColor("#444")
          .text(subtitle, PAGE.margin, y, { width: usable });
        y += 12;
      }
      y += 4;
      doc.font("Courier-Bold").fontSize(FONT_SIZE).fillColor("#000")
        .text(line(header, { rightAlign: false }), PAGE.margin, y);
      y += LINE_H;
      doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + usable, y).strokeColor("#999").stroke();
      y += 4;
      doc.font("Courier").fontSize(FONT_SIZE).fillColor("#000");
    };

    startPage(true);
    const bottom = doc.page.height - PAGE.margin;

    for (const r of rows) {
      if (y + LINE_H > bottom) startPage(false);
      // A `[]` row is a section separator in the matrix — kept as vertical
      // space rather than dropped, because it is what groups the sections.
      if (r.length === 0) { y += LINE_H * 0.6; continue; }
      doc.text(line(r), PAGE.margin, y, { lineBreak: false });
      y += LINE_H;
    }

    doc.end();
  });
}

// ── Channel apportionment — THE ONE DERIVED FIGURE ───────────────────────────
//
// SECOND IMPLEMENTATION WARNING: this mirrors `calcFinancials`' own channel
// weighting (server/src/sim/calcFinancials.ts, `channelTerms` → `share`). It
// exists only because that split is never persisted. If the two ever disagree,
// calcFinancials is right and this is wrong.
//
// Mirrored line for line:
//   • `effectiveMultiplier` — the selected step's multiplier for an item with
//     `options`, else 1. A zero-step item is skipped entirely.
//   • the per-product `selections[]` override, with the two rules kept apart:
//     RELATIVE multiplies the base value, ABSOLUTE adds to it.
//   • `weight = max(0, impactValue × effectiveMultiplier)`.
//   • `share = weight / Σweight`, RENORMALISED over the channels this team
//     actually selected — a team on one channel sends 100% through it, not that
//     channel's share of a full line-up.
//
// NOT filtered by `productsImpacted`. `roundCalculation` — the path that writes
// the `scored` figures this report reads — passes every entry unfiltered, while
// `/projections/recalc` filters. Mirroring the OFFICIAL path is correct here;
// that the two paths differ at all is a separate defect worth a look.
function channelSharesFor(dec, productId) {
  const terms = [];
  for (const gi of dec?.globalInputs ?? []) {
    const impact = gi?.impacts?.["sales_channel"];
    if (!impact) continue;

    const options = gi.options ?? {};
    const hasOptions = Object.keys(options).length > 0;
    const mult = hasOptions ? Number(options[gi.selectedStepKey] ?? 0) : 1;
    if (mult === 0) continue;

    const override = (impact.selections ?? []).find(
      (s) => String(s.productId?.$oid ?? s.productId) === String(productId),
    )?.value;
    const base = Number(impact.value) || 0;
    const impactValue =
      override == null ? base
      : impact.type === "relative" ? base * Number(override)
      : base + Number(override);

    terms.push({
      key: String(gi.globalInputItemId?.$oid ?? gi.globalInputItemId),
      weight: Math.max(0, impactValue * mult),
    });
  }
  const total = terms.reduce((a, t) => a + t.weight, 0);
  const byKey = new Map();
  for (const t of terms) byKey.set(t.key, total > 0 ? t.weight / total : 0);
  return byKey;
}

/** This team's scored metrics for one product, or null before the round is
 *  calculated. `scored` is keyed by productId. */
const scoredFor = (dec, productId) =>
  dec?.scored?.[String(productId)] ?? null;

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

  // `order` is the operator's, so the cascade follows the order they authored.
  const orderedProducts = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── Gross revenue, BROKEN DOWN BY NOTEBOOK ─────────────────────────────────
  //
  // Read, not computed. `calcFinancials` already produces revenue per product —
  // it lands on `Decision.scored[productId].revenue` — and this report was only
  // ever showing the SUM of them in the `Financial` block above, so a team that
  // earned everything on one notebook read identically to one that spread it.
  //
  // These rows add up to `Financial · Revenue` by construction, since that row
  // is the sum of exactly these values.
  for (const p of orderedProducts) {
    emit("Revenue by notebook", p.productName ?? String(p._id), (dec) =>
      num(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);

  for (const p of orderedProducts) {
    emit("Customers by notebook", p.productName ?? String(p._id), (dec) =>
      num(scoredFor(dec, p._id)?.customersObtained));
  }
  rows.push([]);

  // ── …and each notebook split ACROSS THE CHANNELS that sold it ──────────────
  //
  // DERIVED — see `channelSharesFor`. Rows are every configured channel item,
  // not only the chosen ones, so the axis is stable across teams and a channel
  // a team did not pick reads "-" rather than vanishing from its column.
  //
  // A "channel" is any globalInput item carrying a `sales_channel` impact —
  // detected, not hardcoded to a container key, the same way every other
  // section in this file derives its rows from the backend.
  const channelItems = containers.flatMap((gi) =>
    (gi.inputs ?? [])
      .filter((item) => item.impacts?.["sales_channel"])
      .map((item) => ({ id: String(item._id), label: item.label ?? item.key })),
  );

  if (channelItems.length > 0) {
    // revenue_channel = revenue(product) × share(channel)
    for (const p of orderedProducts) {
      for (const ch of channelItems) {
        emit("Revenue by channel", `${p.productName ?? p._id} · ${ch.label}`, (dec) => {
          const sc = scoredFor(dec, p._id);
          if (!sc) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          // `undefined` = this team did not select the channel at all, which is
          // a different statement from "it sold nothing", and reads as one.
          return share == null ? BLANK : num(Number(sc.revenue ?? 0) * share);
        });
      }
    }
    rows.push([]);

    // customers_channel = customersObtained(product) × share(channel)
    for (const p of orderedProducts) {
      for (const ch of channelItems) {
        emit("Customers by channel", `${p.productName ?? p._id} · ${ch.label}`, (dec) => {
          const sc = scoredFor(dec, p._id);
          if (!sc) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          return share == null ? BLANK : num(Number(sc.customersObtained ?? 0) * share);
        });
      }
    }
    rows.push([]);

    // The split itself, as a percentage — so a reader can check the two blocks
    // above rather than having to take them on trust.
    for (const p of orderedProducts) {
      for (const ch of channelItems) {
        emit("Channel share", `${p.productName ?? p._id} · ${ch.label}`, (dec) => {
          // Gated on `scored` like the two blocks above. Without this it printed
          // a split for a notebook the team never made: the weights come from
          // the channel's per-product `selections[]`, which exist for every
          // product regardless of what was built, so an unmade Indie Notebook
          // read "0% / 100%" as though it had been sold somewhere.
          if (!scoredFor(dec, p._id)) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          return share == null ? BLANK : `${(share * 100).toFixed(1)}%`;
        });
      }
    }
    rows.push([]);
  }

  // ── One section per notebook, its own fields nested beneath ────────────────

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

  // A section name is printed only on the FIRST row of its run. Repeating
  // "Revenue by channel" down twelve consecutive rows is noise on a page — the
  // CSV needed it because a spreadsheet may be sorted or filtered; a PDF is read
  // top to bottom and cannot be.
  let lastSection = null;
  for (const r of rows) {
    if (r.length === 0) { lastSection = null; continue; }
    if (r[0] === lastSection) r[0] = "";
    else lastSection = r[0];
  }

  const header = ["Section", "Decision", ...cols.map((c) => c.name)];
  return {
    header,
    rows,
    teamCount: cols.length,
    rowCount: rows.filter((r) => r.length > 0).length,
    roundNumber,
  };
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

  const simName = sim.simulationName ?? sim.name ?? SIM_ID;

  for (const r of [...byRound.keys()].sort((a, b) => a - b)) {
    const m = buildMatrix(r, byRound.get(r), teams, products, containers);
    const p = join(OUT_DIR, `decisions_${SIM_ID}_round${r}.pdf`);
    // AWAITED — pdfkit writes through a stream, so without this the script can
    // exit before the file is flushed.
    await writePdf(p, {
      title: `Round ${r} — decision comparison`,
      subtitle:
        `${simName}  ·  ${m.teamCount} teams  ·  generated ${new Date().toISOString().slice(0, 10)}  ·  ` +
        `channel rows are apportioned, not stored — see the script header`,
      header: m.header,
      rows: m.rows,
    });
    console.error(`[write] ${p}  (${m.rowCount} decisions × ${m.teamCount} teams)`);
  }

  console.error("[done]");
}

main().catch((err) => { console.error("[error]", err.message); process.exit(1); });
