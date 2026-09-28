/**
 * The round reports, as MATRICES. Pure: data in, rows out, no I/O.
 *
 * TEAMS ACROSS THE TOP, everything else cascading down the side. Two reports
 * share this shape because they answer two halves of one question:
 *
 *   analysis report    — what did each team CHOOSE, and what did it score
 *   competitor report   — how did they DO, and who won
 *
 * ── IF A FIGURE IS STORED, READ IT ──────────────────────────────────────────
 * This is the rule the file exists to enforce, and it has been broken twice.
 * An earlier export attributed revenue across channels with a hardcoded genre ×
 * channel matrix the server never computed; a later one derived a figure by
 * normalising customers, which contradicted the stored one it sat three rows
 * above (66.9%/33.1% against 59.1%/40.9% for the same round) because
 * `customersObtained` is `marketFit × availableMarket × productScore ×
 * customersObtainedAugment`, so `productScore` enters twice.
 *
 * ── FIT AND SHARE ARE DIFFERENT FIGURES ─────────────────────────────────────
 * `scored[].marketFit`   normalised productScore — what a team's decisions
 *                        EARNED it of the market. The allocation.
 * `scored[].marketShare` customersObtained / Σ customersObtained — the share of
 *                        CUSTOMERS WON. What the decisions achieved after
 *                        `productScore` and the globalInput augmentation.
 * They were one name until 2026-09-24. Whether a team could DELIVER what it won
 * is a third thing — the Demand block shows it, demand against Customers
 * Fulfilled.
 *
 * Exactly ONE figure here is derived — the channel apportionment — and it is
 * marked. Everything else is read.
 */

import { SELLING_PRICE_KEY } from "../constants/impacts";
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
    /** `name` is the chosen option's display name, snapshotted at submission.
     *  The reports print it instead of `value`, which is a bare score. */
    fields?: Array<{ fieldId: unknown; value?: unknown; name?: string | null }>;
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
 * A field's `direction`, for the Weight column — ANALYSIS REPORT ONLY. It was
 * on the competitor report too until 2026-09-24; there it was noise.
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

// `SELLING_PRICE_KEY` is imported from constants/impacts.ts — one definition, so
// a rename cannot leave this file matching a key nobody sends.
//
// `PROJECTED_MARKET_SHARE_KEY` was imported too, to swap that field's row for
// the competed `scored[].marketShare` (every team submits 1, so the raw row said
// nothing). No longer needed: the driver cascade admits only `direction > 0`
// money fields, which excludes it, and the Market Result block prints the
// competed share directly.

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
 * The per-field weighted scores calcFinancials captured — `resolved ×
 * bellFactor × direction`, summing to `dynamicPrice`.
 *
 * READ, never derived. calcFinancials computes these and now keeps them
 * precisely so this file does not re-run a market-model line.
 */
function scoreTerms(
  dec: ReportDecision | null,
  productId: unknown,
): Array<{ key: string; value: number }> {
  const sc = scoredFor(dec, productId) as
    { productScoreBreakdown?: Array<{ key?: unknown; value?: unknown }> } | null;
  return (sc?.productScoreBreakdown ?? [])
    .map((r) => ({ key: String(r.key ?? ""), value: Number(r.value) }))
    .filter((r) => r.key !== "" && Number.isFinite(r.value));
}

const scoreTermFor = (dec: ReportDecision | null, productId: unknown, fieldKey: string) =>
  scoreTerms(dec, productId).find((r) => r.key === fieldKey)?.value ?? null;

// `scoreTotalFor` and `scoreSumFor` were here — Σ of the breakdown terms, whole
// or restricted to a key set. Deleted 2026-09-28 with QA's cascade: the totals
// are now summed from the DRIVER ROWS themselves (`grandScore`), which spans the
// marketing and sales-channel groups too. Those levers have no
// `productScoreBreakdown` entry, so a total read off the breakdown alone would
// no longer match the rows printed above it.

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
/**
 * Units each team carried INTO the reported round, `teamId → productId → units`.
 *
 * READ from the previous round's stored `closingStock`, never derived from this
 * round's figures: `closingStock` is rounded to whole units on write, so
 * `closing + sold - produced` would reconstruct the opening with the rounding
 * error baked in. Empty for round 0, where nothing has been carried yet.
 *
 * It matters on the report because `Notebooks Produced` alone does not explain
 * what a team could sell — the ceiling is `Total Notebooks`, storage plus
 * production, and a reader who sees only production reads a fulfilled figure
 * above it as a defect.
 */
export type OpeningStock = Map<string, Map<string, number>>;

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
  const terms = leverTerms(dec, productId, ["sales_channel"]);
  const total = terms.reduce((a, t) => a + t.weight, 0);
  const out = new Map<string, number>();
  for (const t of terms) out.set(t.key, total > 0 ? t.weight / total : 0);
  return out;
}

/**
 * One lever entry's impact on a product, with the per-product override and the
 * step multiplier applied — `calcFinancials`' own resolution, in one place.
 *
 * No selection check: this reads the DECISION, so every entry in it was chosen.
 * `stepMultiplier` is the shared resolver, so a binary lever's presence IS its
 * selection and a stepped one carries its step's value.
 */
function leverWeight(
  gi: NonNullable<ReportDecision["globalInputs"]>[number],
  metricKey: string,
  productId: unknown,
): number {
  const impact = gi.impacts?.[metricKey];
  if (!impact) return 0;

  const mult = stepMultiplier(gi.options, gi.selectedStepKey);
  if (mult === 0) return 0;

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

  return Math.max(0, impactValue * mult);
}

/** Every entry in the decision carrying one of `metricKeys`, weighted. */
function leverTerms(
  dec: ReportDecision | null,
  productId: unknown,
  metricKeys: string[],
): Array<{ key: string; weight: number }> {
  const terms: Array<{ key: string; weight: number }> = [];
  for (const gi of dec?.globalInputs ?? []) {
    let weight = 0;
    for (const m of metricKeys) weight += leverWeight(gi, m, productId);
    if (gi.impacts && metricKeys.some((m) => gi.impacts?.[m])) {
      terms.push({ key: id(gi.globalInputItemId), weight });
    }
  }
  return terms;
}

/**
 * The two impacts declared `affects: "customersObtained"` in IMPACT_CONFIG —
 * used to decide which lever containers the notebook blocks already account
 * for, NOT to split demand.
 *
 * `demandSharesFor` was here and apportioned demand across BOTH of them,
 * `customersObtained x weight_i / Σ weight`. Deleted 2026-09-28: marketing
 * raises demand but routes no units, so including it in the denominator shrank
 * every channel figure against the report's existing split. Demand per channel
 * is `channelSharesFor`, which renormalises over channels alone.
 */
export const DEMAND_METRICS = ["sales_channel", "marketing"];

/**
 * CAPACITY, split across the levers that raised it.
 *
 * `inventoryQty` is `base x Π(1 + w)` over every `inventoryRate` lever — the
 * Vendors container and Hiring's Production Team in the live config — so the
 * contributions COMPOUND and cannot simply be shared out.
 *
 * Walked incrementally instead, which is exact:
 *
 *   base      = inventoryQty / Π(1 + w)
 *   extra_j   = running x w_j,   running += extra_j
 *   base + Σ extra_j = inventoryQty
 *
 * Order-dependent where two levers are held at once — the second is credited
 * with the compounding on top of the first — and that is inherent to a product,
 * not a choice this makes. Entry order is the decision's own.
 */
export function capacityTermsFor(
  dec: ReportDecision | null,
  productId: unknown,
  inventoryQty: number,
): { base: number; extras: Map<string, number> } {
  const terms = leverTerms(dec, productId, ["inventory"]).filter((t) => t.weight !== 0);

  const augmentation = terms.reduce((a, t) => a * (1 + t.weight), 1);
  const base = augmentation === 0 ? 0 : inventoryQty / augmentation;

  const extras = new Map<string, number>();
  let running = base;
  for (const t of terms) {
    const extra = running * t.weight;
    extras.set(t.key, extra);
    running += extra;
  }
  return { base, extras };
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

/** Every globalInput item carrying one of `metricKeys`. DETECTED, not hardcoded
 *  to a container key, like every other axis in this file — which is what makes
 *  the Vendor and Production rows appear without naming them. */
function leverItemsOf(containers: ReportContainer[], metricKeys: string[]) {
  return containers.flatMap((gi) =>
    (gi.inputs ?? [])
      .filter((item) => metricKeys.some((m) => item.impacts?.[m]))
      .map((item) => ({
        id:       id(item._id),
        label:    item.label ?? item.key ?? "",
        category: gi.label ?? gi.category ?? gi.key ?? "",
        // The item itself, so a caller can read its configured impact without a
        // second lookup through the containers.
        item,
      })),
  );
}

const channelItemsOf = (containers: ReportContainer[]) =>
  leverItemsOf(containers, ["sales_channel"]);

/**
 * A lever's CONFIGURED weight on one product — its impact value with the
 * per-product override applied, and NOTHING team-specific.
 *
 * The Weight column is configuration, the same as a product field's
 * `direction`: one number per row, identical down every team's column. The step
 * multiplier is deliberately absent — that is the team's own selection, and it
 * belongs in the team cells, not the weight.
 *
 * Owner, 2026-09-28: *"marketing and sales channel rows only need to show the
 * direction values"* — these levers move `customersObtained`, so their impact
 * value IS their direction, in the same sense a product field's is.
 */
function configWeightOf(
  item: ReportGlobalInputItem,
  metricKey: string,
  productId: unknown,
): number {
  const impact = item.impacts?.[metricKey] as
    | { type?: string; value?: number; selections?: Array<{ productId: unknown; value: number }> }
    | undefined;
  if (!impact) return 0;

  const override = (impact.selections ?? []).find(
    (s) => id(s.productId) === id(productId),
  )?.value;
  const base = Number(impact.value) || 0;
  return override == null ? base
    : impact.type === "relative" ? base * Number(override)
    : base + Number(override);
}

/** One row of the driver cascade: a decision, its weight, and what it scored. */
interface DriverRow {
  label:  string;
  weight: number;
  /** The Decisions cell — what the team chose. */
  choice: (dec: ReportDecision | null) => string;
  /** The Weighted Score cell, and the numerator of the Market Fit cell. */
  score:  (dec: ReportDecision | null) => number | null;
}

/** A named group of drivers. Its weight is the SUM of its rows' — owner,
 *  2026-09-28: *"just the weight totals from each section"*. */
interface DriverGroup {
  label: string;
  rows:  DriverRow[];
}

const groupWeight = (g: DriverGroup) => g.rows.reduce((a, r) => a + r.weight, 0);

/**
 * The banner that separates the per-notebook blocks from the team-wide ones.
 *
 * ASCII only: the base-14 fonts the PDF uses are WinAnsi, and an em dash or a
 * minus would render as a substituted glyph. See the note in `reportPdf.ts`.
 */
const SUMMARY_HEADING = "SUMMARY - all notebooks";

/**
 * A BANNER row: a section name with every other cell empty.
 *
 * `reportPdf` detects exactly that shape and draws it large, so this is the one
 * way to break the page into parts. Used for each notebook and for the summary
 * banner that separates the per-notebook blocks from the team-wide ones.
 */
function emitHeading(ctx: Ctx, text: string): void {
  ctx.rows.push([
    text,
    "",
    ...(ctx.weights ? [""] : []),
    ...ctx.cols.map(() => ""),
  ]);
}

// ── Builders ─────────────────────────────────────────────────────────────────

interface Ctx {
  cols:   Array<{ id: string; name: string }>;
  byTeam: Map<string, ReportDecision>;
  rows:   string[][];
  /** `weight` renders only when the context was built with `weights: true`;
   *  passing one otherwise is ignored rather than shifting a column. */
  emit:   (
    section: string,
    label: string,
    valueFor: (dec: ReportDecision | null, col: { id: string; name: string }) => string,
    weight?: number | null,
  ) => void;
  weights: boolean;
}

/**
 * `weights` adds the Weight column — ANALYSIS REPORT ONLY.
 *
 * It belongs there and not on the competitor report: the analysis report is
 * where a reader is asking WHY a score came out as it did, and `direction` is
 * half that answer. The competitor report answers "who won", where a column of
 * coefficients is noise.
 *
 * The flag lives here rather than in the cascade because the cascade is shared:
 * one place decides the row width, so the header cannot disagree with it.
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

// `emitLeaderboardWorking` was here — the analysis report's Actual / rank / N /
// weight / points working behind each leaderboard figure. QA, 2026-09-28: the
// leaderboard belongs to the COMPETITOR report only. That report builds its own
// rows inline, so nothing else needs this.

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

// `emitDecisionCascade` was here — `Notebook: X` plus the lever containers,
// shared by both reports. Deleted 2026-09-28: `emitNotebookAnalysis` below now
// builds the notebook block for BOTH reports, differing only by `withScoring`,
// so a cascade that produced a second, older row set had nothing left to serve.

/**
 * ONE NOTEBOOK, as the analysis report tells it — QA's ordering, 2026-09-28.
 *
 *   Inventory   what could be sold: carried stock, the levers that raised
 *               capacity, the base, and the total
 *   Demand      what was won, decomposed: the channel and marketing levers that
 *               earned it, then the notebook's own decisions and their weighted
 *               scores, then the total score and the market share it took
 *   Fulfilled   what was actually served
 *
 * Financials and Cash are NOT here — they are one figure per TEAM, not per
 * notebook, and stay at the top of the report (owner, 2026-09-28).
 */
function emitNotebookAnalysis(
  ctx: Ctx,
  p: ReportProduct,
  containers: ReportContainer[],
  opening: OpeningStock | null,
  /** ANALYSIS ONLY: the Weighted Score / Total Weighted Score / Market Effect
   *  sections. The competitor report takes the same block in the same order
   *  without them — it answers "how did they do", not "why". */
  withScoring = true,
): void {
  const name    = p.productName ?? id(p._id);
  const inputFor = (dec: ReportDecision | null) =>
    (dec?.inputs ?? []).find((i) => id(i.productId) === id(p._id)) ?? null;
  const storedFor = (col: { id: string }) => opening?.get(col.id)?.get(id(p._id)) ?? 0;
  const qtyFor = (dec: ReportDecision | null) =>
    Number(scoredFor(dec, p._id)?.inventoryQty) || 0;

  // THE NOTEBOOK IS THE HEADER, and the blocks under it keep their plain
  // section names — `Inventory`, `Sales Channel`, `Decision`, `Weighted Score`.
  // Naming each section `Weighted Score: <notebook>` instead (tried 2026-09-28)
  // repeated the notebook on every row of a 40-character column and left nothing
  // to scan down.
  emitHeading(ctx, name);

  // ── CAPACITY ─────────────────────────────────────────────────────────────
  // CAPACITY, NOT INVENTORY. A vendor does not put units in the warehouse; it
  // raises how many the team COULD build. `inventoryQty` is that ceiling, and
  // calling the block Inventory (2026-09-28) conflated it with stock on hand.
  const cap = "Capacity";
  ctx.emit(cap, "Raw Capacity", (dec) =>
    dec == null ? BLANK : plain(capacityTermsFor(dec, p._id, qtyFor(dec)).base));

  // Grouped by CONTAINER — "Vendors", "Hiring Options" — not by item. A team
  // holds at most one of each, so a row per item would be mostly blank; this
  // shows each team's own contribution in one line. Detected, so an operator
  // adding a third capacity group gets a row without a code change.
  const capContainers = containers.filter((gi) =>
    (gi.inputs ?? []).some((item) => item.impacts?.["inventory"]),
  );
  for (const gi of capContainers) {
    const itemIds = new Set(
      (gi.inputs ?? [])
        .filter((item) => item.impacts?.["inventory"])
        .map((item) => id(item._id)),
    );
    ctx.emit(cap, `  ${gi.label ?? gi.category ?? gi.key ?? ""}`, (dec) => {
      if (!dec) return BLANK;
      const { extras } = capacityTermsFor(dec, p._id, qtyFor(dec));
      let total = 0;
      let held = false;
      for (const [itemId, extra] of extras) {
        if (!itemIds.has(itemId)) continue;
        total += extra;
        held = true;
      }
      // Absent = the team holds nothing from this group, which is a different
      // statement from holding something that adds no capacity.
      return held ? plain(total) : BLANK;
    });
  }

  // Base plus every contribution above — `inventoryQty`, the build ceiling.
  ctx.emit(cap, "Total Capacity", (dec) => (dec == null ? BLANK : plain(qtyFor(dec))));
  ctx.rows.push([]);

  // ── PRODUCTION ───────────────────────────────────────────────────────────
  const producedFor = (dec: ReportDecision | null) => {
    const inp = inputFor(dec);
    return inp && inp.produced != null ? Number(inp.produced) : null;
  };
  ctx.emit("Production", "Amount Produced", (dec) => {
    const n = producedFor(dec);
    return n == null ? BLANK : String(n);
  });
  // How much of the ceiling the team actually used. Blank rather than 0% with no
  // capacity: a team with nowhere to build has not under-used anything.
  ctx.emit("Production", "Capacity % Used", (dec) => {
    const n = producedFor(dec);
    const q = qtyFor(dec);
    return n == null || q === 0 ? BLANK : pct(n / q);
  });
  ctx.rows.push([]);

  // ── INVENTORY: what is actually on hand ──────────────────────────────────
  ctx.emit("Inventory", "Inventory leftover", (_dec, c) => String(storedFor(c)));
  ctx.emit("Inventory", "Total Inventory", (dec, c) =>
    dec == null ? BLANK : plain(storedFor(c) + (producedFor(dec) ?? 0)));
  ctx.rows.push([]);

  // ── THE DRIVER CASCADE ───────────────────────────────────────────────────
  //
  // ONE tree, rendered THREE times. QA 2026-09-28: the sections are no longer
  // Decisions / Sales Channel / Marketing — those are the GROUPS now, and the
  // sections are what you want to know about them:
  //
  //   Decisions       what the team chose
  //   Weighted Score  what that choice scored
  //   Market Fit      that score as a share of the notebook's total
  //
  // Owner: *"all formats from decisions all the way to sales channel, for the
  // section of WEIGHTED SCORE has the same format and input"* — so the label
  // column is identical down all three, and only the cells differ.
  //
  // Weight DESCENDING within a group: the heaviest driver is most of the answer.
  // `sort` is stable, so ties hold their authored order.
  const fields = [...(p.fields ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .sort((a, b) => (Number(b.direction) || 0) - (Number(a.direction) || 0));

  /** A lever's realised weight for one team — the configured weight with that
   *  team's step multiplier applied. Absent selection ⇒ null, not 0: the team
   *  did not play it, which is not the same as playing it for nothing. */
  const leverScoreFor = (
    dec: ReportDecision | null, itemId: string, metric: string,
  ): number | null => {
    const sel = (dec?.globalInputs ?? []).find(
      (g) => id(g.globalInputItemId) === itemId,
    );
    return sel ? leverWeight(sel, metric, p._id) : null;
  };

  const leverChoiceFor = (dec: ReportDecision | null, itemId: string): string => {
    if (!dec) return BLANK;
    const sel = (dec.globalInputs ?? []).find(
      (g) => id(g.globalInputItemId) === itemId,
    );
    if (!sel) return "No";
    return sel.selectedStepKey != null && sel.selectedStepKey !== ""
      ? String(sel.selectedStepKey)
      : "Yes";
  };

  const leverGroup = (label: string, metric: string): DriverGroup => ({
    label,
    rows: leverItemsOf(containers, [metric]).map((item) => ({
      label:  item.label,
      weight: configWeightOf(item.item, metric, p._id),
      choice: (dec) => leverChoiceFor(dec, item.id),
      score:  (dec) => leverScoreFor(dec, item.id, metric),
    })),
  });

  const groups: DriverGroup[] = [
    {
      // The notebook's own spec. Mirrors calcFinancials' `priceFields` (money,
      // direction > 0, not the selling price) — exactly the set
      // `productScoreBreakdown` holds, so no row here can be permanently blank.
      label: "Design Notebook",
      rows: fields
        .filter(
          (f) =>
            f.type === "money" &&
            (Number(f.direction) || 0) > 0 &&
            String(f.key) !== SELLING_PRICE_KEY,
        )
        .map((f) => ({
          label:  f.label ?? f.key ?? "",
          weight: Number(f.direction) || 0,
          choice: (dec: ReportDecision | null) => {
            const inp = inputFor(dec);
            if (!inp) return BLANK;
            const hit = (inp.fields ?? []).find((x) => id(x.fieldId) === id(f._id));
            if (hit == null || hit.value == null || hit.value === "") return BLANK;
            // THE OPTION'S NAME, snapshotted at submission — "8" tells a reader
            // nothing where "Hard Cover" tells them everything.
            return hit.name ? String(hit.name) : String(hit.value);
          },
          score: (dec: ReportDecision | null) =>
            scoreTermFor(dec, p._id, String(f.key ?? "")),
        })),
    },
    leverGroup("Marketing",     "marketing"),
    leverGroup("Sales Channel", "sales_channel"),
  ].filter((g) => g.rows.length > 0);

  /** Σ of every row in every group, for one team. The Market Fit denominator
   *  and the total row's value. */
  const grandScore = (dec: ReportDecision | null): number | null => {
    let sum = 0;
    let any = false;
    for (const g of groups)
      for (const r of g.rows) {
        const v = r.score(dec);
        if (v == null) continue;
        sum += v;
        any = true;
      }
    return any ? sum : null;
  };
  const grandWeight = groups.reduce((a, g) => a + groupWeight(g), 0);

  // Selling price sits OUTSIDE the cascade: `direction` is 0 on it, so it
  // carries no weight and scores nothing, but it is still the decision a reader
  // most wants to see.
  const priceField = fields.find((f) => String(f.key) === SELLING_PRICE_KEY);

  // ── Decisions ────────────────────────────────────────────────────────────
  ctx.emit("Decisions", "Notebook in Market", (dec) => (inputFor(dec) ? "Yes" : "No"));
  if (priceField) {
    ctx.emit("Decisions", priceField.label ?? "Selling Price", (dec) => {
      const inp = inputFor(dec);
      const hit = (inp?.fields ?? []).find((x) => id(x.fieldId) === id(priceField._id));
      return hit?.value == null || hit.value === "" ? BLANK : money(Number(hit.value));
    });
  }
  for (const g of groups) {
    ctx.emit("Decisions", g.label, () => "", groupWeight(g));
    for (const r of g.rows) ctx.emit("Decisions", `  ${r.label}`, r.choice, r.weight);
  }
  ctx.emit("Decisions", "Total", () => "", grandWeight);
  ctx.rows.push([]);

  if (withScoring) {
    // ── Weighted Score ─────────────────────────────────────────────────────
    for (const g of groups) {
      ctx.emit("Weighted Score", g.label, (dec) => {
        let sum = 0;
        let any = false;
        for (const r of g.rows) {
          const v = r.score(dec);
          if (v == null) continue;
          sum += v;
          any = true;
        }
        return any ? plain(sum) : BLANK;
      }, groupWeight(g));
      for (const r of g.rows) {
        ctx.emit("Weighted Score", `  ${r.label}`, (dec) => {
          const v = r.score(dec);
          return v == null ? BLANK : plain(v);
        }, r.weight);
      }
    }
    ctx.emit("Weighted Score", "Total", (dec) => {
      const v = grandScore(dec);
      return v == null ? BLANK : plain(v);
    }, grandWeight);
    ctx.rows.push([]);

    // ── Market Fit ─────────────────────────────────────────────────────────
    //
    // Each driver's share of the notebook's TOTAL weighted score, so the section
    // closes at 100%. A share of the SCORE, not of demand: a driver reaches
    // demand through a non-linear path, so "this decision won N customers" is an
    // attribution the model does not contain.
    const fitOf = (dec: ReportDecision | null, value: number | null) => {
      const total = grandScore(dec);
      return value == null || total == null || total === 0 ? BLANK : pct(value / total);
    };
    for (const g of groups) {
      ctx.emit("Market Fit", g.label, (dec) => {
        let sum = 0;
        let any = false;
        for (const r of g.rows) {
          const v = r.score(dec);
          if (v == null) continue;
          sum += v;
          any = true;
        }
        return fitOf(dec, any ? sum : null);
      }, groupWeight(g));
      for (const r of g.rows) {
        ctx.emit("Market Fit", `  ${r.label}`, (dec) => fitOf(dec, r.score(dec)), r.weight);
      }
    }
    ctx.emit("Market Fit", "Total", (dec) => fitOf(dec, grandScore(dec)), grandWeight);
    ctx.rows.push([]);
  }

  // The COMPETED figures, which are outcomes rather than drivers.
  ctx.emit("Market Result", "Market fit", (dec) =>
    pct(scoredFor(dec, p._id)?.marketFit));
  ctx.emit("Market Result", "Market share", (dec) =>
    pct(scoredFor(dec, p._id)?.marketShare));
  ctx.rows.push([]);

  ctx.emit("Customers Fulfilled", "Demand", (dec) =>
    plain(scoredFor(dec, p._id)?.customersObtained));
  ctx.emit("Customers Fulfilled", "Notebooks Produced", (dec) => {
    const inp = inputFor(dec);
    return inp && inp.produced != null ? String(inp.produced) : BLANK;
  });
  ctx.emit("Customers Fulfilled", "Customers Fulfilled", (dec) =>
    plain(scoredFor(dec, p._id)?.unitsSold));
  ctx.rows.push([]);

  // ── THIS NOTEBOOK'S MONEY ────────────────────────────────────────────────
  //
  // All three READ from `scored[productId]` — the same fields the closing PnL
  // sums across notebooks, so the per-notebook rows and the statement at the
  // foot cannot disagree.
  //
  // GROSS profit, and it stops there. Owner 2026-09-28: *"save the final net
  // profit for the summarized PnL sheet"*. Gross profit is the deepest line that
  // MEANS anything per notebook — `operatingExpenses` is a team cost and is
  // never apportioned per product, so a net profit here would be a different
  // figure wearing the same name.
  ctx.emit("Financials", "Revenue",      (dec) => money(scoredFor(dec, p._id)?.revenue));
  ctx.emit("Financials", "COGS",         (dec) => money(scoredFor(dec, p._id)?.COGS));
  ctx.emit("Financials", "Gross Profit", (dec) => money(scoredFor(dec, p._id)?.grossProfit));
  ctx.rows.push([]);
}

/**
 * THE COMPETITOR REPORT — standings first, then the figures behind them, then
 * the decisions that produced them.
 *
 * A separate report from the analysis report on purpose: that one answers
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
  opening: OpeningStock | null,
): ReportMatrix {
  const ctx = context(decisions, teams);
  const { emit, rows, cols } = ctx;

  if (board) {
    // CUMULATIVE — and the only thing that is. These sum the points every round
    // up to and including this one paid out. Every row below them is THIS
    // round's figures, ranked against this round's competitors.
    emit("Leaderboard", "Total points", (_d, c) =>
      String(round2(board.totals.get(c.id) ?? 0)));
    // "Rank", not "Standing" — every winning metric below prints a "Rank" row,
    // and two words for one idea made them read as different things.
    emit("Leaderboard", "Rank", (_d, c) => `#${board.standing.get(c.id) ?? "-"}`);
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

  // Cash follows the standings: it is the balance the round's profit moved.
  emitCashRows(ctx, cash);

  // ── PER NOTEBOOK, in the analysis report's order ──────────────────────────
  //
  // SAME BLOCK, SAME ORDER, owner 2026-09-28 — Capacity, Production, Inventory,
  // Sales Channel, Marketing, Decision, Market Fit, Customers Fulfilled — with
  // `withScoring: false`, so the Weighted Score / Total Weighted Score / Market
  // Effect sections stay on the analysis report. One function builds both, so
  // the two reports cannot drift on what a notebook block contains.
  //
  // This replaced five per-notebook loops that each ran the full product list
  // for one figure (Revenue / Demand / Customers Fulfilled / Market fit /
  // Market share by notebook). The same figures are all here, grouped under the
  // notebook they belong to instead of scattered across five blocks.
  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const p of ordered) emitNotebookAnalysis(ctx, p, containers, opening, false);

  // Any lever group the notebook blocks did not already account for.
  const accounted = new Set(
    containers
      .filter((gi) =>
        (gi.inputs ?? []).some((item) =>
          [...DEMAND_METRICS, "inventory"].some((m) => item.impacts?.[m]),
        ),
      )
      .map((gi) => id(gi._id)),
  );
  for (const gi of containers) {
    if (!accounted.has(id(gi._id))) emitLeverRows(ctx, gi);
  }

  // ── Team totals, then the close ───────────────────────────────────────────
  //
  // BANNERED, owner 2026-09-28: every block above belongs to ONE notebook, and
  // these sum across all of them. Without a break the first team-wide row reads
  // as though it still belonged to the last notebook on the page.
  emitHeading(ctx, SUMMARY_HEADING);
  //
  // `customersObtained` is DEMAND: the customers this team won in the market.
  // "Customers Fulfilled" is `unitsSold`, the server's own
  // `min(customersObtained, openingStock + produced)` — NOT `produced / demand`,
  // which ignores carried stock and exceeds 100% on overproduction. The gap
  // between the two rows is the teaching point.
  emit("Demand", "Demand", (dec) => plain(sumScored(dec, "customersObtained")));
  emit("Demand", "Total Books Produced", (dec) => plain(sumScored(dec, "produced")));
  emit("Demand", "Customers Fulfilled", (dec) => plain(sumScored(dec, "unitsSold")));
  rows.push([]);

  for (const p of ordered) {
    emit("Revenue by notebook", p.productName ?? id(p._id), (dec) =>
      money(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);

  // THE CLOSING SECTION, last on the page — the same place the analysis report
  // puts it. "Net Profit" is the server's `operatingProfit`, RENAMED not
  // recomputed; the player's P&L sheet calls the same field "Net Income".
  const FINANCIALS: Array<[string, string, (n: number | null) => string]> = [
    ["Revenue",            "revenue",           money],
    ["COGS",               "COGS",              money],
    ["Gross Profit",       "grossProfit",       money],
    ["Operating Expenses", "operatingExpenses", money],
    ["Net Profit",         "operatingProfit",   money],
  ];
  for (const [label, field, fmt] of FINANCIALS) {
    emit("PnL", label, (dec) => fmt(sumScored(dec, field)));
  }
  // Net profit ÷ revenue. Blank rather than 0% with no revenue: a team that
  // sold nothing has no margin, and 0% reads as one that broke even.
  emit("PnL", "Profit Margin", (dec) => {
    const rev = sumScored(dec, "revenue");
    const net = sumScored(dec, "operatingProfit");
    return rev == null || net == null || rev === 0 ? BLANK : pct(net / rev);
  });
  rows.push([]);

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
 * THE ANALYSIS REPORT — why each team's round came out as it did.
 *
 * NO `board`: the leaderboard is the COMPETITOR report's alone (QA,
 * 2026-09-28). This one answers "why", not "who won".
 */
export function buildDecisionMatrix(
  roundNumber: number,
  decisions: ReportDecision[],
  teams: ReportTeam[],
  products: ReportProduct[],
  containers: ReportContainer[],
  cash: CashWalk | null,
  opening: OpeningStock | null,
): ReportMatrix {
  // `true` — the Weight column. THIS report is where `direction` earns its
  // place: the reader is asking why a score came out as it did.
  const ctx = context(decisions, teams, true);
  const { emit, rows, cols } = ctx;

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  emitCashRows(ctx, cash);

  // ── PER NOTEBOOK: capacity, production, demand, share, fulfilment ─────────
  for (const p of ordered) emitNotebookAnalysis(ctx, p, containers, opening);

  // Any lever group the notebook blocks did NOT already account for. Channels,
  // marketing and the capacity levers are shown there; a container carrying
  // none of those impacts would otherwise vanish from the report entirely.
  const accounted = new Set(
    containers
      .filter((gi) =>
        (gi.inputs ?? []).some((item) =>
          [...DEMAND_METRICS, "inventory"].some((m) => item.impacts?.[m]),
        ),
      )
      .map((gi) => id(gi._id)),
  );
  for (const gi of containers) {
    if (!accounted.has(id(gi._id))) emitLeverRows(ctx, gi);
  }

  // ── THE CLOSE: money, last ────────────────────────────────────────────────
  //
  // BOTTOM-MOST, owner 2026-09-28: every block above explains how a team got
  // here — capacity, demand, share, fulfilment — and these three close it out.
  // They opened the report until this change, which put the answer before the
  // working.
  //
  // Bannered for the same reason the competitor report is: these sum ACROSS
  // notebooks, and the blocks above each belong to one.
  emitHeading(ctx, SUMMARY_HEADING);
  //
  // Revenue broken down twice over the SAME total: by where it was sold, then
  // by what was sold. Both reconcile to the PnL Revenue row BELOW them — the
  // splits come first and the statement they roll into closes the report.
  const channels = channelItemsOf(containers);
  if (channels.length > 0) {
    for (const p of ordered) {
      for (const ch of channels) {
        emit("Revenue by channel", `${p.productName ?? id(p._id)} · ${ch.label}`, (dec) => {
          const sc = scoredFor(dec, p._id);
          if (!sc) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          // `undefined` = the team did not select the channel at all, which is
          // a different statement from "it sold nothing".
          return share == null ? BLANK : money(Number(sc.revenue ?? 0) * share);
        });
      }
    }
    rows.push([]);
  }

  for (const p of ordered) {
    emit("Revenue by notebook", p.productName ?? id(p._id), (dec) =>
      money(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);

  // THE CLOSING SECTION. Last on the page, owner 2026-09-28: the two revenue
  // splits above roll into its Revenue row, and every block before them explains
  // how the team got there. "Net Profit" is the server's `operatingProfit` —
  // RENAMED, not recomputed.
  const FINANCIALS: Array<[string, string, (n: number | null) => string]> = [
    ["Revenue",            "revenue",           money],
    ["COGS",               "COGS",              money],
    ["Gross Profit",       "grossProfit",       money],
    ["Operating Expenses", "operatingExpenses", money],
    ["Net Profit",         "operatingProfit",   money],
  ];
  for (const [label, field, fmt] of FINANCIALS) {
    emit("PnL", label, (dec) => fmt(sumScored(dec, field)));
  }
  emit("PnL", "Profit Margin", (dec) => {
    const rev = sumScored(dec, "revenue");
    const net = sumScored(dec, "operatingProfit");
    return rev == null || net == null || rev === 0 ? BLANK : pct(net / rev);
  });
  rows.push([]);

  collapseSectionRuns(rows);
  return {
    header: [...leadHeader(ctx, "Decision"), ...cols.map((c) => c.name)],
    rows,
    teamCount: cols.length,
    rowCount: rows.filter((r) => r.length > 0).length,
    roundNumber,
  };
}
