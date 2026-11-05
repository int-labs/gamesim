/** Round reports as matrices. Pure, no I/O; if a figure is stored, read it. */

import { SELLING_PRICE_KEY } from "../constants/impacts";
import { stepMultiplier } from "../sim/calcFinancials";
import type { LeaderboardMetric } from "../models/leaderboardConfig";
import type { RoundScore, Standings } from "./leaderboard";

/** This round's ranked metrics plus standings; scored by the caller. */
export interface ScoredLeaderboard extends Standings {
  round: RoundScore;
}

// Structural types on purpose: the caller may pass lean Mongoose documents or
// plain JSON, and neither should need converting first.

export interface ReportTeam { _id: unknown; teamName?: string | null }

export interface ReportProductField {
  _id:    unknown;
  key?:   string;
  label?: string;
  order?: number;
  /** Which formula applies, not an input widget. The VoC filter keys off it. */
  type?:  string;
  minValue?: number | null;
  maxValue?: number | null;
  /** vocFit weight in `calcMarketModel`. 0..1, defaults to 1; 0 means the
   *  field does not compete. */
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
  /** stepKey → multiplier. Absent on a binary lever. Read for the top rung. */
  options?: Record<string, number>;
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
    /** `name` is the option's display name at submission; reports print it
     *  rather than `value`, which is a bare score. */
    fields?: Array<{ fieldId: unknown; value?: unknown; name?: string | null }>;
  }>;
  globalInputs?: Array<{
    globalInputItemId: unknown;
    selectedStepKey?:  string | null;
    /** SNAPSHOT of the item's energy at submission, not the live config's.
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
  /** CLIENT-ORIGIN leaderboard figures for this round, insight answers and
   *  anything else only the browser can compute. Submitted with the decision. */
  clientMetrics?: Record<string, number> | null;
}

/** `TeamRunReport.metrics` for one team, the client-origin half. */
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

/** Exported so the debrief builder resolves ids identically, a lean document
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

/** A field's `direction` for the Weight column; empty when 0 or absent. */
const weightCell = (n: number | null | undefined): string => {
  const v = Number(n);
  return n == null || !Number.isFinite(v) || v === 0 ? "" : v.toFixed(3);
};

/** Points can be fractional (a per-product metric splits its weight), but a
 *  trailing `.00` on a whole number is noise. */
const round2 = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};

const FORMATTERS: Record<LeaderboardMetric["format"], (n: number | null) => string> = {
  money,
  number: plain,
  percent: (n) => pct(n),
};

// `SELLING_PRICE_KEY` comes from constants/impacts.ts so a rename cannot leave
// this file matching a key nobody sends.

/** Summed across a team's products, because a column is a team. `null` before
 *  the round is calculated; zero would read as "scored and earned nothing". */
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

/** Per-field weighted scores from calcFinancials. Read, never derived. */
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

// Totals come from the driver rows, not the breakdown: levers have no entry there.

/** Units carried in, read from the previous round's stored `closingStock`. */
export type OpeningStock = Map<string, Map<string, number>>;

export interface CashWalk {
  /** teamId → cash at the START of the reported round. */
  opening: Map<string, number>;
  /** teamId → cash at its END. */
  closing: Map<string, number>;
}

/** Cash walked forward; authoritative over the client's `player.cash`. */
export function buildCashWalk(
  seed: number,
  roundNumber: number,
  byRound: Map<number, ReportDecision[]>,
  teamIds: string[],
): CashWalk {
  const opening = new Map<string, number>();
  const closing = new Map<string, number>();

  // Bounded below the reported round so a later profit cannot move this opening.
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

/** !important a second implementation of calcFinancials' channel weighting; that one wins. */
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

/** One lever's impact on a product, override and step multiplier applied. */
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
  // `relative` multiplies the base, `absolute` adds to it, as in calcFinancials.
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

/** Impacts declaring `affects: "customersObtained"`; not a demand split. */
export const DEMAND_METRICS = ["sales_channel", "marketing"];

/** Capacity split across levers; contributions compound, so walk incrementally. */
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

/** Every globalInput item carrying one of `metricKeys`. Detected, never
 *  hardcoded to a container key. */
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

/** A lever's configured weight; no step multiplier, that belongs in the team cells. */
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

/** Weight anchors per family, keyed by container so a label rename cannot move one. */
const DESIGN_ANCHOR = 0.95;
const CONTAINER_ANCHOR: Record<string, number> = {
  marketing: 0.77,
  channel:   0.75,
};

/** The spec group's heading, and the one group whose weights are not shown:
 *  its weighted score alone carries it. */
const DESIGN_GROUP = "Design Notebook";
const showsWeight = (g: DriverGroup) => g.label !== DESIGN_GROUP;

/** !important global, not per notebook: a per-notebook divisor flattens the report. */
export interface WeightTops {
  design: number;
  /** container key → its heaviest configured weight, over all notebooks. */
  byContainer: Record<string, number>;
}

export function weightTopsOf(
  products: ReportProduct[],
  containers: ReportContainer[],
): WeightTops {
  let design = 0;
  for (const p of products)
    for (const f of p.fields ?? [])
      if (
        f.type === "money" &&
        (Number(f.direction) || 0) > 0 &&
        String(f.key) !== SELLING_PRICE_KEY
      )
        design = Math.max(design, Number(f.direction) || 0);

  const byContainer: Record<string, number> = {};
  for (const gi of containers) {
    const key = String(gi.key ?? gi.category ?? "");
    if (CONTAINER_ANCHOR[key] == null) continue; // unanchored family: Vendors
    let top = 0;
    for (const item of gi.inputs ?? [])
      for (const metric of DEMAND_METRICS)
        if (item.impacts?.[metric])
          // Through `leverMaxWeight` so overrides and the top step both count.
          for (const p of products)
            top = Math.max(top, leverMaxWeight(item, metric, p._id));
    byContainer[key] = top;
  }

  return { design, byContainer };
}

/** A lever's weight at its top step; the ladders are monotonic. */
function leverMaxWeight(
  item: ReportGlobalInputItem,
  metricKey: string,
  productId: unknown,
): number {
  const steps = Object.values(item.options ?? {}).map(Number).filter(Number.isFinite);
  const topMultiplier = steps.length > 0 ? Math.max(...steps) : 1;
  return configWeightOf(item, metricKey, productId) * topMultiplier;
}

/** One row of the driver cascade: a decision, its weight, and what it scored. */
interface DriverRow {
  label:  string;
  weight: number;
  /** The Decisions cell, what the team chose. */
  choice: (dec: ReportDecision | null) => string;
  /** The Weighted Score cell, and the numerator of the Market Fit cell. */
  score:  (dec: ReportDecision | null) => number | null;
}

/** A named group of drivers. Its weight is the sum of its rows'. */
interface DriverGroup {
  label: string;
  rows:  DriverRow[];
}

const groupWeight = (g: DriverGroup) => g.rows.reduce((a, r) => a + r.weight, 0);

/** Separates the per-notebook blocks from the team-wide ones.
 *  ASCII only: the PDF's base-14 fonts are WinAnsi. See `reportPdf.ts`. */
const SUMMARY_HEADING = "All Notebooks";

/** A banner row: a section name with every other cell empty. `reportPdf`
 *  detects that shape and draws it large; it is the only page break. */
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

/** `weights` adds the Weight column, analysis report only. */
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
 *  `null` when no opening was configured, see the seed read in roundReport. */
function emitCashRows(ctx: Ctx, cash: CashWalk | null): void {
  if (!cash) return;
  ctx.emit("Cash", "Opening", (_d, c) => money(cash.opening.get(c.id) ?? null));
  ctx.emit("Cash", "Closing", (_d, c) => money(cash.closing.get(c.id) ?? null));
  // The delta is printed because the two figures above are cumulative.
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
      // "-" only when the team submitted nothing at all.
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

/** One notebook: Inventory, Demand, Fulfilled. Financials are per team. */
function emitNotebookAnalysis(
  ctx: Ctx,
  p: ReportProduct,
  containers: ReportContainer[],
  /** Catalogue-wide divisors, see `weightTopsOf`. */
  tops: WeightTops,
  opening: OpeningStock | null,
  /** Analysis only: the Weighted Score / Total / Market Effect sections. The
   *  competitor report takes the same block without them. */
  withScoring = true,
): void {
  const name    = p.productName ?? id(p._id);
  const inputFor = (dec: ReportDecision | null) =>
    (dec?.inputs ?? []).find((i) => id(i.productId) === id(p._id)) ?? null;
  const storedFor = (col: { id: string }) => opening?.get(col.id)?.get(id(p._id)) ?? 0;
  const qtyFor = (dec: ReportDecision | null) =>
    Number(scoredFor(dec, p._id)?.inventoryQty) || 0;

  // The notebook is the header; sections under it keep plain names, so the
  // 40-character column has something to scan down.
  emitHeading(ctx, name);

  // Capacity, not inventory: a vendor raises the ceiling, not the warehouse.
  const cap = "Capacity";
  ctx.emit(cap, "Raw Capacity", (dec) =>
    dec == null ? BLANK : plain(capacityTermsFor(dec, p._id, qtyFor(dec)).base));

  // Grouped by container, not item: a team holds at most one of each.
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

  // Base plus every contribution above, `inventoryQty`, the build ceiling.
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

  // One tree rendered three times: Decisions, Weighted Score, Market Fit.
  const fields = [...(p.fields ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .sort((a, b) => (Number(b.direction) || 0) - (Number(a.direction) || 0));

  /** A lever's realised weight for one team. No selection yields null, not 0:
   *  not playing it differs from playing it for nothing. */
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

  /** A metric group spanning containers. Only `sales_channel` uses it, and one
   *  container carries it, so the anchor is named rather than resolved. */
  const leverGroup = (label: string, metric: string, anchorKey: string): DriverGroup => {
    const items = leverItemsOf(containers, [metric]);
    const scale = scalerFor(CONTAINER_ANCHOR[anchorKey], tops.byContainer[anchorKey] ?? 0);
    // Same scaler as the weight, so a team on the top step scores exactly the
    // weight shown beside it.
    const scaleScore = scoreScalerFor(
      CONTAINER_ANCHOR[anchorKey],
      tops.byContainer[anchorKey] ?? 0,
    );
    return {
      label,
      rows: items.map((item) => ({
        label:  item.label,
        weight: scale(leverMaxWeight(item.item, metric, p._id)),
        choice: (dec) => leverChoiceFor(dec, item.id),
        score:  (dec) => scaleScore(leverScoreFor(dec, item.id, metric)),
      })),
    };
  };

  /** !important one group per container; each item once or `grandScore` double-counts. */
  const leverGroupsByContainer = (metric: string): DriverGroup[] =>
    containers
      .map((gi) => ({
        gi,
        items: (gi.inputs ?? []).filter((item) => item.impacts?.[metric]),
      }))
      .filter(({ items }) => items.length > 0)
      // The container that IS the metric leads; the rest follow in the order the
      // operator configured them, rather than whatever order Mongo returned.
      .sort((a, b) =>
        Number(String(b.gi.key ?? b.gi.category ?? "") === metric) -
        Number(String(a.gi.key ?? a.gi.category ?? "") === metric))
      .map(({ gi, items }) => {
        // Per container, so Vendors is left unscaled.
        const key = String(gi.key ?? gi.category ?? "");
        const scale = scalerFor(CONTAINER_ANCHOR[key], tops.byContainer[key] ?? 0);
        // SAME scaler as the weight, see the note on `scalerFor`.
        const scaleScore = scoreScalerFor(CONTAINER_ANCHOR[key], tops.byContainer[key] ?? 0);
        return {
          label: gi.label ?? gi.category ?? gi.key ?? "",
          rows: items.map((item) => ({
            label:  item.label ?? item.key ?? "",
            weight: scale(leverMaxWeight(item, metric, p._id)),
            choice: (dec: ReportDecision | null) => leverChoiceFor(dec, id(item._id)),
            score:  (dec: ReportDecision | null) =>
              scaleScore(leverScoreFor(dec, id(item._id), metric)),
          })),
        };
      });

  const filterByMoney = fields.filter(
    (f) =>
      f.type === "money" &&
      (Number(f.direction) || 0) > 0 &&
      String(f.key) !== SELLING_PRICE_KEY,
  );

  /** !important scale at the ROW, never in `grandScore`: it feeds the Market Fit denominator. */
  const scalerFor = (anchor: number | undefined, top: number) =>
    anchor == null
      ? (w: number) => w
      : (w: number) => w * (top > 0 ? anchor / top : 1);

  /** The same scale, null-safe, a missing score is unknown, not zero. */
  const scoreScalerFor = (anchor: number | undefined, top: number) =>
    anchor == null
      ? (v: number | null): number | null => v
      : (v: number | null): number | null =>
          v == null ? null : v * (top > 0 ? anchor / top : 1);

  const scaleWeight = scalerFor(DESIGN_ANCHOR, tops.design);

  /** !important coupled to `calcDiminishingReturnsCostFactor`. */
  const PEAK_FACTOR = 2 - Math.exp(-2);
  const maxAttainable = (f: ReportProductField): number => {
    const max = Number(f.maxValue) || 0;
    const min = Number(f.minValue) || 0;
    const peak = max > min ? PEAK_FACTOR : 1;
    return max * peak * (Number(f.direction) || 0);
  };

  /** !important divide by what was attainable; `direction` is a share, the score a magnitude. */
  const designScoreFor = (f: ReportProductField) => {
    const weight = scaleWeight(Number(f.direction) || 0);
    const attainable = maxAttainable(f);
    return (v: number | null): number | null =>
      v == null || attainable <= 0 ? null : (v / attainable) * weight;
  };
  const groups: DriverGroup[] = [
    {
      // The notebook's own spec; mirrors calcFinancials' `priceFields`.
      label: DESIGN_GROUP,
      rows: filterByMoney
        .map((f) => ({
          label:  f.label ?? f.key ?? "",
          weight: scaleWeight(Number(f.direction) || 0),
          choice: (dec: ReportDecision | null) => {
            const inp = inputFor(dec);
            if (!inp) return BLANK;
            const hit = (inp.fields ?? []).find((x) => id(x.fieldId) === id(f._id));
            if (hit == null || hit.value == null || hit.value === "") return BLANK;
            // THE OPTION'S NAME, snapshotted at submission, "8" tells a reader
            // nothing where "Hard Cover" tells them everything.
            return hit.name ? String(hit.name) : String(hit.value);
          },
          score: (dec: ReportDecision | null) =>
            designScoreFor(f)(scoreTermFor(dec, p._id, String(f.key ?? ""))),
        })),
    },
    // Marketing and Vendors get their own headings; Sales Channel stays a metric group.
    ...leverGroupsByContainer("marketing"),
    leverGroup("Sales Channel", "sales_channel", "channel"),
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
        // !important already scaled per row; scaling again moves the total off the parts.
        sum += v;
        any = true;
      }
    return any ? sum : null;
  };


  // Selling price sits outside the cascade: `direction` is 0, so it scores nothing.
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
  // No weight column here: Decisions answers what was chosen.
  for (const g of groups) {
    ctx.emit("Decisions", g.label, () => "");
    for (const r of g.rows) ctx.emit("Decisions", `  ${r.label}`, r.choice);
  }
  ctx.emit("Decisions", "Total", () => "");
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
        // `showsWeight`, the design group's weights are omitted; the levers
        // keep theirs, where a weight and its score meet at the top step.
      }, showsWeight(g) ? groupWeight(g) : undefined);
      for (const r of g.rows) {
        ctx.emit("Weighted Score", `  ${r.label}`, (dec) => {
          const v = r.score(dec);
          return v == null ? BLANK : plain(v);
        }, showsWeight(g) ? r.weight : undefined);
      }
    }
    ctx.emit("Weighted Score", "Total", (dec) => {
      const v = grandScore(dec);
      return v == null ? BLANK : plain(v);
    });
    ctx.rows.push([]);

    // Each driver's share of the notebook's total score, so the section closes at 100%.
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
      }, showsWeight(g) ? groupWeight(g) : undefined);
      for (const r of g.rows) {
        ctx.emit(
          "Market Fit", `  ${r.label}`,
          (dec) => fitOf(dec, r.score(dec)),
          showsWeight(g) ? r.weight : undefined,
        );
      }
    }
    ctx.emit("Market Fit", "Total", (dec) => fitOf(dec, grandScore(dec)));
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

  // All three read from `scored[productId]`; gross profit is the deepest per-notebook line.
  ctx.emit("Financials", "Revenue",      (dec) => money(scoredFor(dec, p._id)?.revenue));
  ctx.emit("Financials", "COGS",         (dec) => money(scoredFor(dec, p._id)?.COGS));
  ctx.emit("Financials", "Gross Profit", (dec) => money(scoredFor(dec, p._id)?.grossProfit));
  ctx.rows.push([]);
}

/** The team-wide close: headline figures, revenue breakdowns, then the PnL. */
function emitAllNotebooks(
  ctx: Ctx,
  ordered: ReportProduct[],
  containers: ReportContainer[],
  withChannelSplit: boolean,
): void {
  const { emit, rows } = ctx;

  emitHeading(ctx, SUMMARY_HEADING);

  // !important mean, not sum: `marketFit` is a share of one market per notebook.
  emit("Market Fit", "Market fit (average)", (dec) => {
    const vals = Object.values(dec?.scored ?? {})
      .map((m) => Number((m as { marketFit?: unknown })?.marketFit))
      .filter((v) => Number.isFinite(v));
    return vals.length === 0 ? BLANK : pct(vals.reduce((a, b) => a + b, 0) / vals.length);
  });
  rows.push([]);

  // `customersObtained` is demand won; "Customers Fulfilled" is `unitsSold`.
  emit("Demand", "Demand", (dec) => plain(sumScored(dec, "customersObtained")));
  emit("Demand", "Total Books Produced", (dec) => plain(sumScored(dec, "produced")));
  rows.push([]);

  emit("Customers Fulfilled", "Customers Fulfilled", (dec) =>
    plain(sumScored(dec, "unitsSold")));
  rows.push([]);

  // !important deliberately repeated from the PnL block; do not remove as a duplicate.
  emit("Revenue", "Revenue", (dec) => money(sumScored(dec, "revenue")));
  rows.push([]);

  emit("Profit", "Gross Profit", (dec) => money(sumScored(dec, "grossProfit")));
  emit("Profit", "Net Profit",   (dec) => money(sumScored(dec, "operatingProfit")));
  rows.push([]);

  if (withChannelSplit) {
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
  }

  for (const p of ordered) {
    emit("Revenue by notebook", p.productName ?? id(p._id), (dec) =>
      money(scoredFor(dec, p._id)?.revenue));
  }
  rows.push([]);

  // The closing statement. "Net Profit" is the server's `operatingProfit`, renamed.
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
  // Net profit ÷ revenue. Blank rather than 0% with no revenue: a team that sold
  // nothing has no margin, and 0% reads as one that broke even.
  emit("PnL", "Profit Margin", (dec) => {
    const rev = sumScored(dec, "revenue");
    const net = sumScored(dec, "operatingProfit");
    return rev == null || net == null || rev === 0 ? BLANK : pct(net / rev);
  });
  rows.push([]);
}

/** The competitor report; leaderboard blocks are absent when no metrics are configured. */
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
    // !important cumulative, and the only thing that is.
    emit("Leaderboard", "Total points", (_d, c) =>
      String(round2(board.totals.get(c.id) ?? 0)));
    // "Rank", not "Standing", every winning metric below prints a "Rank" row,
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

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Summary sits under the leaderboard here; the analysis report keeps it at the foot.
  emitAllNotebooks(ctx, ordered, containers, false);

  // Same block and order as the analysis report, with `withScoring: false`.
  const tops = weightTopsOf(ordered, containers);
  for (const p of ordered) emitNotebookAnalysis(ctx, p, containers, tops, opening, false);

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


  collapseSectionRuns(rows);
  return {
    header: [...leadHeader(ctx, "Metric"), ...cols.map((c) => c.name)],
    rows,
    teamCount: cols.length,
    rowCount: rows.filter((r) => r.length > 0).length,
    roundNumber,
  };
}

/** The analysis report: why each team's round came out as it did.
 *  No `board`; the leaderboard belongs to the competitor report alone. */
export function buildDecisionMatrix(
  roundNumber: number,
  decisions: ReportDecision[],
  teams: ReportTeam[],
  products: ReportProduct[],
  containers: ReportContainer[],
  cash: CashWalk | null,
  opening: OpeningStock | null,
): ReportMatrix {
  // `true`, the Weight column. THIS report is where `direction` earns its
  // place: the reader is asking why a score came out as it did.
  const ctx = context(decisions, teams, true);
  const { rows, cols } = ctx;

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  emitCashRows(ctx, cash);

  // ── PER NOTEBOOK: capacity, production, demand, share, fulfilment ─────────
  // ONCE, before the loop: the weight divisors span the whole catalogue.
  const tops = weightTopsOf(ordered, containers);
  for (const p of ordered) emitNotebookAnalysis(ctx, p, containers, tops, opening);

  // Lever groups the notebook blocks did not already account for.
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

  // Money last: the summary closes what the blocks above explain.
  emitAllNotebooks(ctx, ordered, containers, true);

  collapseSectionRuns(rows);
  return {
    header: [...leadHeader(ctx, "Decision"), ...cols.map((c) => c.name)],
    rows,
    teamCount: cols.length,
    rowCount: rows.filter((r) => r.length > 0).length,
    roundNumber,
  };
}
