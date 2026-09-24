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

import { PROJECTED_MARKET_SHARE_KEY, SELLING_PRICE_KEY } from "../constants/impacts";
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

// `PROJECTED_MARKET_SHARE_KEY` was mirrored here as a local string. It and
// `SELLING_PRICE_KEY` are imported from constants/impacts.ts now — one
// definition, so a rename cannot leave this file matching a key nobody sends.
//
// `projected_market_share` is the product field that is NOT a decision: every
// team submits 1, and the real figure is the competed `scored[].marketShare`.

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

/** Σ of the terms — equals `dynamicPrice`. `null` when nothing is scored, so a
 *  share is blank rather than dividing by zero. */
const scoreTotalFor = (dec: ReportDecision | null, productId: unknown) => {
  const rows = scoreTerms(dec, productId);
  return rows.length === 0 ? null : rows.reduce((a, r) => a + r.value, 0);
};

/**
 * Σ of the terms for a NAMED SET of fields — the Sum row under each working
 * section.
 *
 * Restricted to the keys passed rather than reusing `scoreTotalFor`: the rows
 * above it are the `scoring` set, and a total that quietly included a term with
 * no row would not add up on the page.
 *
 * `null` when the team has no term for ANY of them, so the Sum row is blank
 * exactly where the rows above it are.
 */
const scoreSumFor = (
  dec: ReportDecision | null,
  productId: unknown,
  keys: Set<string>,
): number | null => {
  const rows = scoreTerms(dec, productId).filter((r) => keys.has(r.key));
  return rows.length === 0 ? null : rows.reduce((a, r) => a + r.value, 0);
};

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

/**
 * THE WORKING BEHIND EVERY LEADERBOARD FIGURE — analysis report only.
 *
 * The competitor report prints Actual / Rank / Point. This prints every term
 * that produced them, so a team can reconstruct its own score:
 *
 *     points = weight x (N - rank + 1)
 *
 * `N` is the number of teams that HAVE a figure, which is why it is printed
 * rather than assumed to be the roster size: a team that never submitted is not
 * ranked at all, and that changes what everyone else scored.
 *
 * Read from the same `scoreRound` output the competitor report renders — not
 * recomputed, so the two cannot disagree about a team's points.
 */
function emitLeaderboardWorking(ctx: Ctx, board: ScoredLeaderboard | null): void {
  if (!board) return;

  for (const b of board.round.blocks) {
    const fmt = FORMATTERS[b.format] ?? plain;
    // Ranked teams only — `scoreMetric` omits a team with no figure.
    const n = b.scores.size;

    ctx.emit(b.label, "Actual", (_d, c) => fmt(b.scores.get(c.id)?.value ?? null));
    ctx.emit(b.label, "  rank", (_d, c) => {
      const r = b.scores.get(c.id)?.rank;
      return r == null ? BLANK : String(r);
    });
    ctx.emit(b.label, "  teams ranked (N)", () => String(n));
    ctx.emit(b.label, "  weight", () => round2(b.weight));
    ctx.emit(b.label, "  points = weight x (N - rank + 1)", (_d, c) => {
      const s = b.scores.get(c.id);
      // Both must be present: a team with a rank but no points has not been
      // scored, and printing the left-hand side alone would imply it had.
      if (!s || s.rank == null || s.points == null) return BLANK;
      // The arithmetic spelled out beside its result, so the row is checkable
      // by eye rather than taken on trust.
      return `${round2(b.weight)} x ${n - s.rank + 1} = ${round2(s.points)}`;
    });
    ctx.rows.push([]);
  }

  ctx.emit("Leaderboard", "Total points (all rounds)", (_d, c) =>
    round2(board.totals.get(c.id) ?? 0));
  ctx.emit("Leaderboard", "Rank", (_d, c) => `#${board.standing.get(c.id) ?? "-"}`);
  ctx.rows.push([]);
}

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
  /** ANALYSIS REPORT ONLY: adds the working under each field — its weighted
   *  score and that score's share. The competitor report answers "who won" and
   *  does not want three rows per spec. */
  detail = false,
): void {
  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const p of ordered) {
    const section = `Notebook: ${p.productName ?? id(p._id)}`;
    const inputFor = (dec: ReportDecision | null) =>
      (dec?.inputs ?? []).find((i) => id(i.productId) === id(p._id)) ?? null;

    ctx.emit(section, "Made this notebook", (dec) => (inputFor(dec) ? "Yes" : "No"));
    ctx.emit(section, "Books Produced", (dec) => {
      const inp = inputFor(dec);
      // `null` is "not stated", which the server builds NOTHING for — distinct
      // from an explicit 0 the team typed.
      return inp && inp.produced != null ? String(inp.produced) : BLANK;
    });

    // The backend's `order` is the authored reading order, and the competitor
    // report keeps it. The ANALYSIS report overrides it with `direction`
    // DESCENDING: that report exists to answer why a score came out as it did,
    // and the heaviest driver is most of the answer, so it belongs at the top.
    // `sort` is stable, so ties — and the unweighted rows, which fall to the
    // bottom — hold their authored order.
    const fields = [...(p.fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (ctx.weights) {
      fields.sort((a, b) => (Number(b.direction) || 0) - (Number(a.direction) || 0));
    }
    for (const f of fields) {
      // The one field that is an OUTCOME, not a decision: every team submits 1
      // for `projected_market_share`, so the row read "1 1 1" and said nothing.
      if (String(f.key) === PROJECTED_MARKET_SHARE_KEY) {
        ctx.emit(section, f.label ?? f.key ?? "", (dec) =>
          pct(scoredFor(dec, p._id)?.marketShare));
        continue;
      }
      const isPrice = String(f.key) === SELLING_PRICE_KEY;
      ctx.emit(section, f.label ?? f.key ?? "", (dec) => {
        const inp = inputFor(dec);
        if (!inp) return BLANK;
        const hit = (inp.fields ?? []).find((x) => id(x.fieldId) === id(f._id));
        if (hit == null || hit.value == null || hit.value === "") return BLANK;
        // MONEY, to 2dp — a price is the one field a reader compares in dollars.
        if (isPrice) return money(Number(hit.value));
        // THE OPTION'S NAME, snapshotted on the decision at submission. `value`
        // is a score, and "8" tells a reader nothing where "Hard Cover" tells
        // them everything. Falls back to the raw value for a field with no
        // option table. NOT looked up from the live config: renaming an option
        // must not rewrite what a finished round says the team chose.
        return hit.name ? String(hit.name) : String(hit.value);
      }, f.direction);
    }
    ctx.rows.push([]);

    // ── The working, as its OWN SECTIONS ──────────────────────────────────
    //
    // THREE SECTIONS, each a full pass over the same drivers — not three rows
    // per driver. Owner, 2026-09-24: *"make weighted score and share of score
    // as its own section ... so that it does not become confusing to read"*.
    // Matches the reference sheet's Decision Drivers / Weighted Scores / VOC.
    if (!detail) continue;

    // Only the fields that CARRY a weighted score. Mirrors calcFinancials'
    // `priceFields` (money, direction > 0, not the selling price), which is
    // exactly the set `productScoreBreakdown` contains — so no row here can be
    // permanently blank.
    const scoring = fields.filter(
      (f) =>
        f.type === "money" &&
        (Number(f.direction) || 0) > 0 &&
        String(f.key) !== SELLING_PRICE_KEY,
    );
    if (scoring.length === 0) continue;

    const productName = p.productName ?? id(p._id);
    // The keys the Sum rows add up — exactly the rows printed above them.
    const scoringKeys = new Set(scoring.map((f) => String(f.key ?? "")));
    const weightSum = scoring.reduce((a, f) => a + (Number(f.direction) || 0), 0);

    for (const f of scoring) {
      ctx.emit(`Weighted Score: ${productName}`, f.label ?? f.key ?? "", (dec) => {
        const v = scoreTermFor(dec, p._id, String(f.key ?? ""));
        return v == null ? BLANK : plain(v);
      }, f.direction);
    }
    // Σ of the rows above. NOT `dynamicPrice` read back: it is the same figure
    // today, and printing the sum of what is on the page keeps it that way if
    // the `scoring` filter ever narrows.
    ctx.emit(`Weighted Score: ${productName}`, "Sum", (dec) => {
      const v = scoreSumFor(dec, p._id, scoringKeys);
      return v == null ? BLANK : plain(v);
    }, weightSum);
    ctx.rows.push([]);

    // A SHARE OF THE SCORE, not a share of demand. A field reaches demand
    // through dynamicPrice -> productScore -> customersObtained, which is NOT
    // linear, so "this decision won N customers" is an attribution the model
    // does not contain. This says only how much of the product's score the
    // field accounts for, which it does.
    for (const f of scoring) {
      ctx.emit(`Share of Score: ${productName}`, f.label ?? f.key ?? "", (dec) => {
        const v = scoreTermFor(dec, p._id, String(f.key ?? ""));
        const total = scoreTotalFor(dec, p._id);
        return v == null || total == null || total === 0 ? BLANK : pct(v / total);
      }, f.direction);
    }
    // Reads 100.0% wherever `scoring` covers the whole breakdown, which it does
    // today — and that is the point: it tells the reader the shares above are a
    // complete account of the score, not a selection from it.
    ctx.emit(`Share of Score: ${productName}`, "Sum", (dec) => {
      const v = scoreSumFor(dec, p._id, scoringKeys);
      const total = scoreTotalFor(dec, p._id);
      return v == null || total == null || total === 0 ? BLANK : pct(v / total);
    }, weightSum);
    ctx.rows.push([]);
  }

  for (const gi of containers) emitLeverRows(ctx, gi);
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
    // `customersObtained` was here. It is not a financial figure — it moved to
    // the Demand block below and is called DEMAND there.
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

  // ── Demand, and how much of it the team actually served ───────────────────
  //
  // `customersObtained` is DEMAND: the customers this team won in the market.
  // It used to sit in the Financial block, where it was the only row that was
  // not money.
  //
  // "Customers Fulfilled" is `unitsSold`, which the server already stores as
  // `min(customersObtained, openingStock + produced)` — the customers actually
  // served. NOT `produced / demand`: that ratio ignores carried stock and
  // exceeds 100% on overproduction, and the gap between these two rows is the
  // teaching point (demand won, but stock could not cover it).
  emit("Demand", "Demand", (dec) => plain(sumScored(dec, "customersObtained")));
  emit("Demand", "Total Books Produced", (dec) => plain(sumScored(dec, "produced")));
  emit("Demand", "Customers Fulfilled", (dec) => plain(sumScored(dec, "unitsSold")));
  rows.push([]);

  // Cash follows profit: it is the balance that profit moved.
  emitCashRows(ctx, cash);

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const p of ordered) {
    emit("Revenue by notebook", p.productName ?? id(p._id), (dec) =>
      money(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);
  // DEMAND, not "Customers": this is `customersObtained` — the customers the
  // team WON, before stock could or could not cover them. The Demand block above
  // uses the same word for the same field.
  for (const p of ordered) {
    emit("Demand by Notebook", p.productName ?? id(p._id), (dec) =>
      plain(scoredFor(dec, p._id)?.customersObtained));
  }
  rows.push([]);
  // Demand SERVED, per notebook — `unitsSold`, the same field the Demand
  // block's "Customers Fulfilled" row totals. Read, not recomputed. The gap
  // against the block above is per-notebook stock that did not cover demand,
  // which the summed row cannot show: a team can overbuild one notebook and run
  // short on another and still total out even.
  for (const p of ordered) {
    emit("Customers Fulfilled by Notebook", p.productName ?? id(p._id), (dec) =>
      plain(scoredFor(dec, p._id)?.unitsSold));
  }
  rows.push([]);
  // BOTH figures: the fit is what the decisions EARNED before productScore and
  // the lever augmentation; the share is what they WON after.
  for (const p of ordered) {
    emit("Market fit", p.productName ?? id(p._id), (dec) =>
      pct(scoredFor(dec, p._id)?.marketFit));
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
  board: ScoredLeaderboard | null,
): ReportMatrix {
  // `true` — the Weight column. THIS report is where `direction` earns its
  // place: the reader is asking why a score came out as it did.
  const ctx = context(decisions, teams, true);
  const { emit, rows, cols } = ctx;

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── CHANNELS FIRST ────────────────────────────────────────────────────────
  // The revenue-by-channel breakdown opens the report. The POSITION rows come
  // immediately before it: a revenue line against a channel the team never
  // switched on is a category error, not a small number, so the reader must
  // know which are live before reading any split.
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
          return share == null ? BLANK : money(Number(sc.revenue ?? 0) * share);
        });
      }
    }
    rows.push([]);
    for (const p of ordered) {
      for (const ch of channels) {
        emit("Demand by Channel", `${p.productName ?? id(p._id)} · ${ch.label}`, (dec) => {
          const sc = scoredFor(dec, p._id);
          if (!sc) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          return share == null ? BLANK : plain(Number(sc.customersObtained ?? 0) * share);
        });
      }
    }
    rows.push([]);
    // The block above is demand WON; this is demand SERVED. `unitsSold` is the
    // server's own `min(customersObtained, openingStock + produced)`, read not
    // recomputed — the gap between the two blocks is stock that did not cover
    // the demand, and it is the teaching point.
    //
    // Apportioned by the SAME share the two blocks above use, which assumes the
    // shortfall fell evenly across channels. The model does not allocate stock
    // per channel, so no split it could contradict exists.
    for (const p of ordered) {
      for (const ch of channels) {
        emit("Customers Fulfilled by Channel", `${p.productName ?? id(p._id)} · ${ch.label}`, (dec) => {
          const sc = scoredFor(dec, p._id);
          if (!sc) return BLANK;
          const share = channelSharesFor(dec, p._id).get(ch.id);
          return share == null ? BLANK : plain(Number(sc.unitsSold ?? 0) * share);
        });
      }
    }
    rows.push([]);
  }

  // ── The figures, then the working behind them ─────────────────────────────
  const FINANCIALS: Array<[string, string, (n: number | null) => string]> = [
    ["Revenue",            "revenue",           money],
    ["COGS",               "COGS",              money],
    ["Gross Profit",       "grossProfit",       money],
    ["Operating Expenses", "operatingExpenses", money],
    ["Net Profit",         "operatingProfit",   money],
  ];
  for (const [label, field, fmt] of FINANCIALS) {
    emit("Financial", label, (dec) => fmt(sumScored(dec, field)));
  }
  rows.push([]);

  emit("Demand", "Demand", (dec) => plain(sumScored(dec, "customersObtained")));
  emit("Demand", "Total Books Produced", (dec) => plain(sumScored(dec, "produced")));
  emit("Demand", "Customers Fulfilled", (dec) => plain(sumScored(dec, "unitsSold")));
  rows.push([]);

  emitCashRows(ctx, cash);

  for (const p of ordered) {
    emit("Revenue by notebook", p.productName ?? id(p._id), (dec) =>
      money(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);
  for (const p of ordered) {
    emit("Demand by Notebook", p.productName ?? id(p._id), (dec) =>
      plain(scoredFor(dec, p._id)?.customersObtained));
  }
  rows.push([]);
  // Same block the competitor report carries, so the two reports do not
  // disagree about what a notebook served.
  for (const p of ordered) {
    emit("Customers Fulfilled by Notebook", p.productName ?? id(p._id), (dec) =>
      plain(scoredFor(dec, p._id)?.unitsSold));
  }
  rows.push([]);

  emitLeaderboardWorking(ctx, board);

  emitDecisionCascade(
    ctx, products, containers.filter((gi) => !channelIds.has(id(gi._id))), true,
  );

  collapseSectionRuns(rows);
  return {
    header: [...leadHeader(ctx, "Decision"), ...cols.map((c) => c.name)],
    rows,
    teamCount: cols.length,
    rowCount: rows.filter((r) => r.length > 0).length,
    roundNumber,
  };
}
