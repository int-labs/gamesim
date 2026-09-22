/**
 * The round reports, as MATRICES. Pure: data in, rows out, no I/O.
 *
 * TEAMS ACROSS THE TOP, everything else cascading down the side. Two reports
 * share this shape because they answer two halves of one question:
 *
 *   decision comparison — what did each team CHOOSE
 *   competitor report   — how did they DO, and who won
 *
 * ── IF A FIGURE IS STORED, READ IT ──────────────────────────────────────────
 * This is the rule the file exists to enforce, and it has been broken twice.
 * An earlier export attributed revenue across channels with a hardcoded genre ×
 * channel matrix the server never computed; a later one derived a market share
 * by normalising customers, which contradicted the stored
 * `scored[].marketShare` it sat three rows above (66.9%/33.1% against
 * 59.1%/40.9% for the same round) because `customersObtained` is
 * `marketShare × availableMarket × productScore × customersObtainedAugment`,
 * so `productScore` enters twice.
 *
 * Exactly ONE figure here is derived — the channel apportionment — and it is
 * marked. Everything else is read.
 */

import { stepMultiplier } from "../sim/calcFinancials";
import type { LeaderboardMetric } from "../models/leaderboardConfig";
import type { RoundScore, Standings } from "./leaderboard";

/**
 * A scored leaderboard, ready to render: THIS round's ranked metrics plus the
 * standings accumulated across every round up to it.
 *
 * Scored by the caller, not here — the cumulative half needs every prior
 * round's decisions, and this module does no I/O.
 */
export interface ScoredLeaderboard extends Standings {
  round: RoundScore;
}

// ── The shapes this module needs, and nothing more ───────────────────────────
//
// Structural on purpose: the caller may hand over lean Mongoose documents or
// plain JSON from an HTTP fetch, and neither should have to be converted first.

export interface ReportTeam { _id: unknown; teamName?: string | null }

export interface ReportProductField {
  _id:    unknown;
  key?:   string;
  label?: string;
  order?: number;
  /** `money` / `number` / `percentage` — WHICH FORMULA applies, not an input
   *  widget. The debrief's VoC filter keys off it. */
  type?:  string;
  minValue?: number | null;
  maxValue?: number | null;
  /** The vocFit weight this field carries in `calcMarketModel`'s score. Bounded
   *  0..1 on the model, `required` with a default of 1 — so a field never lacks
   *  one, and 0 is the only way to say "this does not compete". */
  direction?: number;
}

export interface ReportProduct {
  _id:          unknown;
  productName?: string;
  order?:       number;
  fields?:      ReportProductField[];
}

export interface ReportGlobalInputItem {
  _id:      unknown;
  key?:     string;
  label?:   string;
  impacts?: Record<string, unknown>;
}

export interface ReportContainer {
  _id?:      unknown;
  key?:      string;
  label?:    string;
  category?: string;
  inputs?:   ReportGlobalInputItem[];
}

export interface ReportDecision {
  teamId:       unknown;
  roundNumber?: number;
  inputs?: Array<{
    productId: unknown;
    produced?: number | null;
    fields?: Array<{ fieldId: unknown; value?: unknown }>;
  }>;
  globalInputs?: Array<{
    globalInputItemId: unknown;
    selectedStepKey?:  string | null;
    /** SNAPSHOT of the item's energy at submission — not the live config's.
     *  Editing a lever must not rewrite what a past round cost. */
    energy?:           number;
    /** The parent container's name, snapshotted the same way. */
    category?:         string;
    options?:          Record<string, number> | null;
    impacts?: Record<string, {
      type?: string;
      value?: number;
      selections?: Array<{ productId: unknown; value: number }>;
    }> | null;
  }>;
  /** Written by roundCalculation at round close, keyed by productId. */
  scored?: Record<string, Record<string, number>> | null;
  /** CLIENT-ORIGIN leaderboard figures for this round — insight answers and
   *  anything else only the browser can compute. Submitted with the decision. */
  clientMetrics?: Record<string, number> | null;
}

/** `TeamRunReport.metrics` for one team — the client-origin half. */
export type ReportRunMetrics = Record<string, number>;

export interface ReportMatrix {
  header:      string[];
  rows:        string[][];
  teamCount:   number;
  rowCount:    number;
  roundNumber: number;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** What an unmade decision looks like. One constant, so an empty cell is never
 *  mistaken for a missing column. */
export const BLANK = "-";

/** Exported so the debrief builder resolves ids identically — a lean document
 *  and an HTTP-fetched one spell an ObjectId differently. */
export const id = (v: unknown): string => String((v as { $oid?: string })?.$oid ?? v);

export const money = (n: number | null | undefined): string =>
  n == null
    ? BLANK
    : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const plain = (n: number | null | undefined): string =>
  n == null
    ? BLANK
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (n: number | null | undefined, dp = 1): string =>
  n == null ? BLANK : `${(Number(n) * 100).toFixed(dp)}%`;

/**
 * A field's `direction`, for the Weight column.
 *
 * EMPTY rather than `BLANK`: most rows in that column are not product fields at
 * all, and "-" here means "the team submitted nothing", which is a claim about a
 * TEAM. A row with no weight is making no claim about anybody.
 *
 * A direction of 0 reads as empty too — it is the model's own way of saying the
 * field does not compete (`selling_price` carries it), so printing "0.000"
 * against it would suggest a weight that lost rather than one that never ran.
 *
 * 3dp: every live direction is authored to 3 or fewer, so this is lossless
 * today. A finer-grained weight WOULD round here.
 */
const weightCell = (n: number | null | undefined): string => {
  const v = Number(n);
  return n == null || !Number.isFinite(v) || v === 0 ? "" : v.toFixed(3);
};

/** Points can be fractional — a per-product metric splits its weight across
 *  notebooks — but a trailing `.00` on a whole number is noise. */
const round2 = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};

const FORMATTERS: Record<LeaderboardMetric["format"], (n: number | null) => string> = {
  money,
  number: plain,
  percent: (n) => pct(n),
};

/** The product field that is NOT a decision — every team submits `1`. The real
 *  figure is the competed `scored[].marketShare`. Mirrors
 *  PROJECTED_MARKET_SHARE_KEY in constants/impacts.ts. */
const PROJECTED_MARKET_SHARE_KEY = "projected_market_share";

// ── Shared readers ───────────────────────────────────────────────────────────

/** Summed across a team's products, because a column is a TEAM. `null` for a
 *  round nobody has calculated — `scored` is absent until then, and a zero
 *  would read as a scored round that earned nothing. */
export function sumScored(
  dec: ReportDecision | null,
  field: string,
): number | null {
  if (!dec?.scored) return null;
  return Object.values(dec.scored).reduce((a, m) => a + (Number(m?.[field]) || 0), 0);
}

/** One product's scored metrics, or null before the round is calculated. */
export const scoredFor = (dec: ReportDecision | null, productId: unknown) =>
  dec?.scored?.[id(productId)] ?? null;

/**
 * CASH, walked forward from the configured opening.
 *
 *   cashStart(0) = seed
 *   cashStart(r) = seed + Σ operatingProfit(i)   for every i < r
 *   cashEnd(r)   = cashStart(r) + operatingProfit(r)
 *
 * A SECOND COMPUTATION ON PURPOSE. The player client banks the same
 * `operatingProfit` into `player.cash` at each round boundary, so these two
 * derive one number twice from the same inputs. Owner's call to keep both as a
 * cross-check on what the client displays — if they ever disagree, THIS is the
 * one to trust.
 *
 * An uncalculated round contributes 0, not a gap: `sumScored` returns null
 * before a round is scored, and cash does not move on a round nobody ran.
 */
export interface CashWalk {
  /** teamId → cash at the START of the reported round. */
  opening: Map<string, number>;
  /** teamId → cash at its END. */
  closing: Map<string, number>;
}

export function buildCashWalk(
  seed: number,
  roundNumber: number,
  byRound: Map<number, ReportDecision[]>,
  teamIds: string[],
): CashWalk {
  const opening = new Map<string, number>();
  const closing = new Map<string, number>();

  // Ascending and bounded BELOW the reported round: a later round's profit
  // cannot move this round's opening, and the report may be regenerated for an
  // earlier round after later ones exist.
  const priorRounds = [...byRound.keys()]
    .filter((r) => r < roundNumber)
    .sort((a, b) => a - b);

  const profitFor = (r: number, teamId: string): number => {
    const dec = (byRound.get(r) ?? []).find((d) => id(d.teamId) === teamId) ?? null;
    return sumScored(dec, "operatingProfit") ?? 0;
  };

  for (const t of teamIds) {
    let cash = seed;
    for (const r of priorRounds) cash += profitFor(r, t);
    opening.set(t, cash);
    closing.set(t, cash + profitFor(roundNumber, t));
  }

  return { opening, closing };
}

/**
 * THE ONE DERIVED FIGURE — a team's channel split for one product.
 *
 * SECOND IMPLEMENTATION WARNING: mirrors `calcFinancials`' own `channelTerms →
 * share` weighting, which exists only to blend the consignment rate and is
 * never persisted. If the two disagree, calcFinancials is right. The durable
 * fix is to persist the split on `scored` and delete this.
 *
 *   weight = max(0, impactValue × stepMultiplier)
 *   share  = weight / Σweight, RENORMALISED over the channels this team picked
 *
 * NOT filtered by `productsImpacted`: `roundCalculation` — the path that writes
 * the `scored` figures read here — passes every entry unfiltered, while
 * `/projections/recalc` filters. Mirroring the official path is correct; that
 * the two differ at all is a separate defect.
 */
export function channelSharesFor(
  dec: ReportDecision | null,
  productId: unknown,
): Map<string, number> {
  const terms: Array<{ key: string; weight: number }> = [];

  for (const gi of dec?.globalInputs ?? []) {
    const impact = gi.impacts?.["sales_channel"];
    if (!impact) continue;

    // calcFinancials' own resolver. No selection check: this loop iterates the
    // DECISION, so every entry in it was chosen.
    const mult = stepMultiplier(gi.options, gi.selectedStepKey);
    if (mult === 0) continue;

    const override = (impact.selections ?? []).find(
      (s) => id(s.productId) === id(productId),
    )?.value;
    const base = Number(impact.value) || 0;
    // RELATIVE multiplies the base, ABSOLUTE adds to it — the two rules kept
    // apart, as in calcFinancials.
    const impactValue =
      override == null ? base
      : impact.type === "relative" ? base * Number(override)
      : base + Number(override);

    terms.push({ key: id(gi.globalInputItemId), weight: Math.max(0, impactValue * mult) });
  }

  const total = terms.reduce((a, t) => a + t.weight, 0);
  const out = new Map<string, number>();
  for (const t of terms) out.set(t.key, total > 0 ? t.weight / total : 0);
  return out;
}

/** A section name prints only on the FIRST row of its run: a PDF is read top to
 *  bottom and cannot be sorted, so repeating it is noise. */
function collapseSectionRuns(rows: string[][]): void {
  let last: string | null = null;
  for (const r of rows) {
    if (r.length === 0) { last = null; continue; }
    if (r[0] === last) r[0] = "";
    else last = r[0];
  }
}

/** Every globalInput item carrying a `sales_channel` impact. DETECTED, not
 *  hardcoded to a container key, like every other axis in this file. */
function channelItemsOf(containers: ReportContainer[]) {
  return containers.flatMap((gi) =>
    (gi.inputs ?? [])
      .filter((item) => item.impacts?.["sales_channel"])
      .map((item) => ({ id: id(item._id), label: item.label ?? item.key ?? "" })),
  );
}

// ── Builders ─────────────────────────────────────────────────────────────────

interface Ctx {
  cols:   Array<{ id: string; name: string }>;
  byTeam: Map<string, ReportDecision>;
  rows:   string[][];
  /** `weight` is only rendered when the context was built with `weights: true`;
   *  passing one otherwise is silently ignored rather than shifting a column. */
  emit:   (
    section: string,
    label: string,
    valueFor: (dec: ReportDecision | null, col: { id: string; name: string }) => string,
    weight?: number | null,
  ) => void;
  weights: boolean;
}

/**
 * `weights` adds the Weight column — COMPETITOR REPORT ONLY. The cascade below
 * is shared by both reports, so the flag lives here rather than in the cascade:
 * one place decides the row width, and the header cannot disagree with it.
 */
function context(
  decisions: ReportDecision[],
  teams: ReportTeam[],
  weights = false,
): Ctx {
  const byTeam = new Map(decisions.map((d) => [id(d.teamId), d]));
  // The roster's own order, so successive rounds line up column for column.
  const cols = teams.map((t) => ({ id: id(t._id), name: t.teamName ?? id(t._id) }));
  const rows: string[][] = [];
  const emit: Ctx["emit"] = (section, label, valueFor, weight) =>
    rows.push([
      section,
      label,
      ...(weights ? [weightCell(weight)] : []),
      ...cols.map((c) => valueFor(byTeam.get(c.id) ?? null, c)),
    ]);
  return { cols, byTeam, rows, emit, weights };
}

/** The fixed columns, so a header can never disagree with what `emit` pushes. */
const leadHeader = (ctx: Ctx, labelCol: string): string[] =>
  ["Section", labelCol, ...(ctx.weights ? ["Weight"] : [])];

/** Cash rows, shared by both reports so they cannot drift on how it is shown.
 *  `null` when no opening was configured — see the seed read in roundReport. */
function emitCashRows(ctx: Ctx, cash: CashWalk | null): void {
  if (!cash) return;
  ctx.emit("Cash", "Opening", (_d, c) => money(cash.opening.get(c.id) ?? null));
  ctx.emit("Cash", "Closing", (_d, c) => money(cash.closing.get(c.id) ?? null));
  // The delta is what the round actually did to the balance. Printed rather
  // than left to the reader because the two figures above are cumulative and
  // subtracting them by eye across a wide table is where mistakes happen.
  ctx.emit("Cash", "Change", (_d, c) => {
    const o = cash.opening.get(c.id);
    const l = cash.closing.get(c.id);
    return o == null || l == null ? BLANK : money(l - o);
  });
  ctx.rows.push([]);
}

/** One lever container's rows: every configured item, chosen or not. */
function emitLeverRows(ctx: Ctx, gi: ReportContainer): void {
  const section = gi.label ?? gi.category ?? gi.key ?? "";
  for (const item of gi.inputs ?? []) {
    ctx.emit(section, item.label ?? item.key ?? "", (dec) => {
      // "-" ONLY when the team submitted nothing at all. It used to mean both
      // "no decision" and "decided against this lever" — a team that
      // deliberately left a channel off read the same as one that never played.
      if (!dec) return BLANK;
      const sel = (dec.globalInputs ?? []).find(
        (g) => id(g.globalInputItemId) === id(item._id),
      );
      if (!sel) return "No";
      // A stepped lever records WHICH step; a binary one has no step key, so
      // its presence IS the selection.
      return sel.selectedStepKey != null && sel.selectedStepKey !== ""
        ? String(sel.selectedStepKey)
        : "Yes";
    });
  }
  ctx.rows.push([]);
}

/**
 * The per-notebook and per-lever cascade, shared by both reports.
 *
 * `Notebook: X` down to the last lever container — the decisions half. The
 * competitor report carries it too so a standing can be traced to the choices
 * that produced it.
 */
function emitDecisionCascade(
  ctx: Ctx,
  products: ReportProduct[],
  containers: ReportContainer[],
): void {
  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const p of ordered) {
    const section = `Notebook: ${p.productName ?? id(p._id)}`;
    const inputFor = (dec: ReportDecision | null) =>
      (dec?.inputs ?? []).find((i) => id(i.productId) === id(p._id)) ?? null;

    ctx.emit(section, "Made this notebook", (dec) => (inputFor(dec) ? "Yes" : "No"));
    ctx.emit(section, "Produce / phase", (dec) => {
      const inp = inputFor(dec);
      // `null` is "not stated", which the server builds NOTHING for — distinct
      // from an explicit 0 the team typed.
      return inp && inp.produced != null ? String(inp.produced) : BLANK;
    });

    // `direction` is read PER PRODUCT, not per field key: the weights are
    // genre-specific, so the same field carries a different one on each
    // notebook (Minimalist page_size 0.145 against Anime's 0.057).
    const fields = [...(p.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const f of fields) {
      // The one field that is an OUTCOME, not a decision: every team submits 1
      // for `projected_market_share`, so the row read "1 1 1" and said nothing.
      //
      // NO WEIGHT on this row, deliberately. The field does carry a `direction`,
      // but the cell beside it is the COMPETED market share, not the submission
      // the weight applies to — printing one here would attribute a decision
      // weight to an outcome.
      if (String(f.key) === PROJECTED_MARKET_SHARE_KEY) {
        ctx.emit(section, f.label ?? f.key ?? "", (dec) =>
          pct(scoredFor(dec, p._id)?.marketShare));
        continue;
      }
      ctx.emit(section, f.label ?? f.key ?? "", (dec) => {
        const inp = inputFor(dec);
        if (!inp) return BLANK;
        const hit = (inp.fields ?? []).find((x) => id(x.fieldId) === id(f._id));
        // The RAW submitted value: for an enum field that is the option key the
        // server resolves through `options`, and re-deriving a label here would
        // be a second interpretation of the decision.
        return hit == null || hit.value == null || hit.value === ""
          ? BLANK
          : String(hit.value);
      }, f.direction);
    }
    ctx.rows.push([]);
  }

  for (const gi of containers) emitLeverRows(ctx, gi);
}

/**
 * THE COMPETITOR REPORT — standings first, then the figures behind them, then
 * the decisions that produced them.
 *
 * A separate report from the decision comparison on purpose: that one answers
 * "what did each team CHOOSE", this one "how did they DO". Same machinery,
 * different question.
 *
 * `metrics` is the operator's `LeaderboardConfig`. With none configured the
 * leaderboard blocks are simply absent and the rest of the report still
 * renders — an unconfigured simulation is a normal state, not an error.
 */
export function buildCompetitorMatrix(
  roundNumber: number,
  decisions: ReportDecision[],
  teams: ReportTeam[],
  products: ReportProduct[],
  containers: ReportContainer[],
  board: ScoredLeaderboard | null,
  cash: CashWalk | null,
): ReportMatrix {
  // `true` — the Weight column. Competitor report only: the decision comparison
  // keeps its existing header.
  const ctx = context(decisions, teams, true);
  const { emit, rows, cols } = ctx;

  if (board) {
    // CUMULATIVE — and the only thing that is. These sum the points every round
    // up to and including this one paid out. Every row below them is THIS
    // round's figures, ranked against this round's competitors.
    emit("Leaderboard", "Total points", (_d, c) =>
      String(round2(board.totals.get(c.id) ?? 0)));
    emit("Leaderboard", "Standing", (_d, c) => `#${board.standing.get(c.id) ?? "-"}`);
    rows.push([]);

    // Actual / Rank / Point per metric, matching the operator's reference sheet.
    for (const b of board.round.blocks) {
      const fmt = FORMATTERS[b.format] ?? plain;
      emit(b.label, "Actual", (_d, c) => fmt(b.scores.get(c.id)?.value ?? null));
      emit(b.label, "Rank", (_d, c) => {
        const r = b.scores.get(c.id)?.rank;
        return r == null ? BLANK : String(r);
      });
      emit(b.label, `Point (weight ${round2(b.weight)})`, (_d, c) => {
        const p = b.scores.get(c.id)?.points;
        return p == null ? BLANK : String(round2(p));
      });
      rows.push([]);
    }
  }

  // ── The figures behind the standings ──────────────────────────────────────
  // "Net Profit" is the server's `operatingProfit` — RENAMED, not recomputed.
  // The player's P&L sheet calls the same field "Net Income"; one number, and
  // worth knowing before reconciling the two.
  const FINANCIALS: Array<[string, string, (n: number | null) => string]> = [
    ["Revenue",            "revenue",           money],
    ["COGS",               "COGS",              money],
    ["Gross Profit",       "grossProfit",       money],
    ["Operating Expenses", "operatingExpenses", money],
    ["Net Profit",         "operatingProfit",   money],
    ["Customers Obtained", "customersObtained", plain],
  ];
  for (const [label, field, fmt] of FINANCIALS) {
    emit("Financial", label, (dec) => fmt(sumScored(dec, field)));
  }
  // Net profit ÷ revenue. Blank rather than 0% with no revenue: a team that
  // sold nothing has no margin, and 0% reads as one that broke even.
  emit("Financial", "Profit Margin", (dec) => {
    const rev = sumScored(dec, "revenue");
    const net = sumScored(dec, "operatingProfit");
    return rev == null || net == null || rev === 0 ? BLANK : pct(net / rev);
  });
  rows.push([]);

  // Cash follows profit: it is the balance that profit moved.
  emitCashRows(ctx, cash);

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const p of ordered) {
    emit("Revenue by notebook", p.productName ?? id(p._id), (dec) =>
      money(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);
  for (const p of ordered) {
    emit("Customers by notebook", p.productName ?? id(p._id), (dec) =>
      plain(scoredFor(dec, p._id)?.customersObtained));
  }
  rows.push([]);
  for (const p of ordered) {
    emit("Market share", p.productName ?? id(p._id), (dec) =>
      pct(scoredFor(dec, p._id)?.marketShare));
  }
  rows.push([]);

  // The decisions that produced all of the above — `Notebook: X` down to the
  // last lever, the same cascade the comparison report carries.
  emitDecisionCascade(ctx, products, containers);

  collapseSectionRuns(rows);
  return {
    header: [...leadHeader(ctx, "Metric"), ...cols.map((c) => c.name)],
    rows,
    teamCount: cols.length,
    rowCount: rows.filter((r) => r.length > 0).length,
    roundNumber,
  };
}

/**
 * THE DECISION COMPARISON — what each team chose, side by side.
 */
export function buildDecisionMatrix(
  roundNumber: number,
  decisions: ReportDecision[],
  teams: ReportTeam[],
  products: ReportProduct[],
  containers: ReportContainer[],
  cash: CashWalk | null,
): ReportMatrix {
  const ctx = context(decisions, teams);
  const { emit, rows, cols } = ctx;

  const FINANCIALS: Array<[string, string]> = [
    ["Revenue", "revenue"],
    ["COGS", "COGS"],
    ["Gross Profit", "grossProfit"],
    ["Operating Expenses", "operatingExpenses"],
    ["Net Profit", "operatingProfit"],
    ["Customers Obtained", "customersObtained"],
  ];
  for (const [label, field] of FINANCIALS) {
    emit("Financial", label, (dec) => plain(sumScored(dec, field)));
  }
  rows.push([]);

  emitCashRows(ctx, cash);

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Per-product revenue is READ — calcFinancials already computes it; only the
  // summed `Financial` rows were ever shown.
  for (const p of ordered) {
    emit("Revenue by notebook", p.productName ?? id(p._id), (dec) =>
      plain(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);
  for (const p of ordered) {
    emit("Customers by notebook", p.productName ?? id(p._id), (dec) =>
      plain(scoredFor(dec, p._id)?.customersObtained));
  }
  rows.push([]);

  // Channels: the POSITION first, then the notebooks split across it. A revenue
  // line against a channel the team never switched on is a category error, not
  // a small number, so the reader must know which are live first.
  const channelContainers = containers.filter((gi) =>
    (gi.inputs ?? []).some((item) => item.impacts?.["sales_channel"]),
  );
  const channelIds = new Set(channelContainers.map((gi) => id(gi._id)));
  const channels = channelItemsOf(channelContainers);

  for (const gi of channelContainers) emitLeverRows(ctx, gi);

  if (channels.length > 0) {
    for (const p of ordered) {
      for (const ch of channels) {
        emit("Revenue by channel", `${p.productName ?? id(p._id)} · ${ch.label}`, (dec) => {
          const sc = scoredFor(dec, p._id);
          if (!sc) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          // `undefined` = the team did not select the channel at all, which is
          // a different statement from "it sold nothing".
          return share == null ? BLANK : plain(Number(sc.revenue ?? 0) * share);
        });
      }
    }
    rows.push([]);
    for (const p of ordered) {
      for (const ch of channels) {
        emit("Customers by channel", `${p.productName ?? id(p._id)} · ${ch.label}`, (dec) => {
          const sc = scoredFor(dec, p._id);
          if (!sc) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          return share == null ? BLANK : plain(Number(sc.customersObtained ?? 0) * share);
        });
      }
    }
    rows.push([]);
  }

  emitDecisionCascade(ctx, products, containers.filter((gi) => !channelIds.has(id(gi._id))));

  collapseSectionRuns(rows);
  return {
    header: [...leadHeader(ctx, "Decision"), ...cols.map((c) => c.name)],
    rows,
    teamCount: cols.length,
    rowCount: rows.filter((r) => r.length > 0).length,
    roundNumber,
  };
}
