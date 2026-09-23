/**
 * The player debrief, as NUMERIC SERIES. Pure: data in, numbers out, no I/O.
 *
 * ── WHY THIS IS NOT `reportMatrix` ──────────────────────────────────────────
 * That module renders a PDF and emits display strings — `money()` returns
 * "$1,234.00" and a missing figure is the literal "-". A chart needs the number
 * and needs `null` to stay `null`, so a shared builder would have to format for
 * neither reader. The two answer the same questions from the same fields; they
 * differ only in what they hand back.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
 * NO 0..1 NORMALISATION. The VoC chart's bubbles are
 * `(resolved − min) / (max − min)` and its price tick is `min / (min + max)`,
 * and both already exist in the player client — `priceSensitivity()` in
 * engine/finlit/core/config/fieldConfig.ts is the single definition behind the
 * market tab's label AND the debrief's tick. Computing either here would make
 * two. So this emits RESOLVED VALUES and RAW BOUNDS, and the client does the
 * arithmetic it already owns.
 *
 * Every money and unit figure is READ from `Decision.scored`. The only things
 * derived here are the energy sum and the lever investment, both of which are
 * decision × config lookups the server has never stored.
 */

import { SELLING_PRICE_KEY } from "../constants/impacts";
import { stepMultiplier } from "../sim/calcFinancials";
import {
  buildCashWalk,
  id,
  scoredFor,
  sumScored,
  type CashWalk,
  type ReportDecision,
  type ReportProduct,
  type ReportProductField,
  type ReportTeam,
} from "./reportMatrix";

/**
 * Which fields can appear on the VoC chart at all.
 *
 * MIRRORS `priceFields` in calcFinancials — `type === "money" && direction > 0`,
 * which is precisely the set that builds `dynamicPrice`. Plus `selling_price`
 * itself, which carries `direction: 0` and takes its weight from the client's
 * `priceSensitivity()` instead.
 *
 * Everything else is EXCLUDED, not merely dropped for failing a number check.
 * Owner, 2026-09-22: *"enum valued decisions should never be considered in the
 * VoC chart. they're completely weightless and serve no contribution."* A
 * weightless field has no position on a weighted axis, so emitting it and
 * letting the chart decide would push that judgement to the wrong layer.
 */
function isVocField(f: ReportProductField): boolean {
  if (String(f.key) === SELLING_PRICE_KEY) return true;
  return f.type === "money" && (Number(f.direction) || 0) > 0;
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface DebriefTeamRef {
  teamId:   string;
  teamName: string;
}

/**
 * A product field's METADATA — bounds and weight, never a normalised score.
 * `direction` is the VoC weight; `selling_price` carries 0 and the client
 * substitutes `priceSensitivity()` for it.
 */
export interface DebriefField {
  /** Matches the keys of `DebriefTeamProduct.fieldValues`. Join on THIS, never
   *  on array position or label. */
  fieldId:   string;
  key:       string;
  label:     string;
  direction: number;
  minValue:  number | null;
  maxValue:  number | null;
}

export interface DebriefProduct {
  productId:   string;
  productName: string;
  fields:      DebriefField[];
}

export interface DebriefTeamProduct {
  revenue:           number | null;
  customersObtained: number | null;
  unitsSold:         number | null;
  produced:          number | null;
  inventoryQty:      number | null;
  closingStock:      number | null;
  /** Normalised productScore — what the team's decisions EARNED it of the
   *  market. The allocation, not a share of sales. */
  marketFit:         number | null;
  /** `customersObtained / Σ customersObtained` — the share of customers WON. */
  marketShare:       number | null;
  /** The server's 0..1 pricing score. Already normalised, so it is READ, not
   *  recomputed — it is what drives `customersObtained`. */
  productScore:      number | null;
  sellingPrice:      number | null;
  /** fieldId → the team's submitted value. The client normalises it against
   *  the matching `DebriefField` bounds; see the header. */
  fieldValues:       Record<string, number>;
}

export interface DebriefTeamRound {
  /** Σ item.energy × step, across the levers this team selected. DERIVED. */
  energy:            number;
  cashOpening:       number | null;
  cashClosing:       number | null;
  revenue:           number | null;
  cogs:              number | null;
  grossProfit:       number | null;
  operatingExpenses: number | null;
  netProfit:         number | null;
  unitsSold:         number | null;
  customersObtained: number | null;
  /** category → incurred cost. Operator-owned FREE TEXT: take the keys from
   *  here, never from a hardcoded list, or renaming a row drops a cost band. */
  costByCategory:    Record<string, number>;
  /** container label → energy spent on it. The TnO breakdown. */
  energyByLever:     Record<string, number>;
  byProduct:         Record<string, DebriefTeamProduct>;
}

export interface DebriefRound {
  roundNumber: number;
  teams:       Record<string, DebriefTeamRound>;
}

export interface DebriefPayload {
  simulationId: string;
  roundNumber:  number;
  /** The requesting team, so the slide can highlight it. `null` for an
   *  operator, who is not one of the columns. */
  you:          string | null;
  teams:        DebriefTeamRef[];
  products:     DebriefProduct[];
  /** Round 0 .. the reported round, ascending — the progress lines need the
   *  whole run, not just this round. */
  rounds:       DebriefRound[];
}

// ── Derived: energy and lever investment ─────────────────────────────────────

/**
 * A lever's energy for one decision — ENTIRELY from the decision.
 *
 * `Decision.globalInputs[]` snapshots `energy`, `category` and `options` at
 * submission, so nothing here reads the live `GlobalInput` config. That is the
 * point: an operator raising a lever's energy cost must not retroactively
 * change what a finished round shows.
 *
 * `stepMultiplier` is calcFinancials' own resolver — the same one
 * `getGlobalInputQuantity` uses. No selection check is needed here: this reader
 * iterates the DECISION, so every entry it sees was chosen.
 */
function leverEnergy(sel: {
  energy?:          number;
  selectedStepKey?: string | null;
  options?:         Record<string, number> | null;
}): number {
  const spent = (Number(sel.energy) || 0) * stepMultiplier(sel.options, sel.selectedStepKey);
  return Number.isFinite(spent) ? spent : 0;
}

// ── Readers ──────────────────────────────────────────────────────────────────

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Both cost arrays, summed per category across the team's products.
 *
 *  BOTH are required: `calcFinancials` states that COGS and opex totals are
 *  only whole when the globalInput rows are added to the per-unit rows. They
 *  are disjoint, not overlapping. */
function costsByCategory(dec: ReportDecision | null): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (category: unknown, value: unknown) => {
    const key = String(category ?? "").trim();
    const n = Number(value);
    if (!key || !Number.isFinite(n)) return;
    out[key] = (out[key] ?? 0) + n;
  };

  for (const metrics of Object.values(dec?.scored ?? {})) {
    const m = metrics as unknown as {
      incurredCosts?:    Array<{ category?: unknown; incurredCost?: unknown }>;
      globalInputCosts?: Array<{ category?: unknown; incurredCost?: unknown }>;
    };
    for (const row of m.incurredCosts ?? []) add(row.category, row.incurredCost);
    for (const row of m.globalInputCosts ?? []) add(row.category, row.incurredCost);
  }
  return out;
}

function productBlock(
  dec: ReportDecision | null,
  product: ReportProduct,
  vocFieldIds: Set<string>,
): DebriefTeamProduct {
  const sc = scoredFor(dec, product._id) as Record<string, unknown> | null;
  const input = (dec?.inputs ?? []).find((i) => id(i.productId) === id(product._id)) ?? null;

  // VOC FIELDS ONLY — the set is decided by `isVocField`, not by whether a
  // value happens to parse as a number. A weightless field is excluded on
  // purpose rather than failing a cast.
  //
  // The value is the RAW submission. Money fields carry a number already
  // (`ConfigOption` supplies one scalar `score`), so there is nothing to
  // resolve; running `resolveFieldValue` here would be a second reading of the
  // decision, which belongs to calcFinancials.
  const fieldValues: Record<string, number> = {};
  for (const f of input?.fields ?? []) {
    const key = id(f.fieldId);
    if (!vocFieldIds.has(key)) continue;
    const v = num(f.value);
    if (v !== null) fieldValues[key] = v;
  }

  return {
    revenue:           sc ? num(sc.revenue) : null,
    customersObtained: sc ? num(sc.customersObtained) : null,
    unitsSold:         sc ? num(sc.unitsSold) : null,
    produced:          sc ? num(sc.produced) : null,
    inventoryQty:      sc ? num(sc.inventoryQty) : null,
    closingStock:      sc ? num(sc.closingStock) : null,
    marketFit:         sc ? num(sc.marketFit) : null,
    marketShare:       sc ? num(sc.marketShare) : null,
    productScore:      sc ? num(sc.productScore) : null,
    sellingPrice:      sc ? num(sc.sellingPrice) : null,
    fieldValues,
  };
}

// ── Builder ──────────────────────────────────────────────────────────────────

export interface DebriefInput {
  simulationId: string;
  roundNumber:  number;
  you:          string | null;
  teams:        ReportTeam[];
  products:     ReportProduct[];
  /** EVERY round up to and including the reported one — the progress lines and
   *  the cash walk both need the history, not just this round. */
  byRound:      Map<number, ReportDecision[]>;
  /** Configured opening cash, or `null` when the operator set none. */
  cashSeed:     number | null;
}

export function buildDebriefSeries(input: DebriefInput): DebriefPayload {
  // NOTE: no `containers`. Everything the energy sum needs is snapshotted on
  // the decision itself — see `leverEnergy`.
  const { simulationId, roundNumber, you, teams, products, byRound, cashSeed } = input;

  const teamRefs: DebriefTeamRef[] = teams.map((t) => ({
    teamId:   id(t._id),
    teamName: t.teamName ?? id(t._id),
  }));
  const teamIds = teamRefs.map((t) => t.teamId);

  const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // The VoC-eligible fields, per product — the weights are genre-specific, so
  // the same key carries a different `direction` on each notebook.
  const vocFieldIds = new Set<string>();
  const productMeta: DebriefProduct[] = ordered.map((p) => ({
    productId:   id(p._id),
    productName: p.productName ?? id(p._id),
    fields: [...(p.fields ?? [])]
      .filter(isVocField)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((f) => {
        vocFieldIds.add(id(f._id));
        return {
          fieldId:   id(f._id),
          key:       String(f.key ?? ""),
          label:     f.label ?? f.key ?? "",
          direction: Number(f.direction) || 0,
          minValue:  num(f.minValue),
          maxValue:  num(f.maxValue),
        };
      }),
  }));

  // One walk per round, because cash at round r is the seed plus every profit
  // BEFORE r — scoring each round independently would restate the opening.
  const walkFor = (r: number): CashWalk | null =>
    cashSeed == null ? null : buildCashWalk(cashSeed, r, byRound, teamIds);

  const rounds: DebriefRound[] = [...byRound.keys()]
    .filter((r) => r <= roundNumber)
    .sort((a, b) => a - b)
    .map((r) => {
      const decs = byRound.get(r) ?? [];
      const cash = walkFor(r);
      const teamsOut: Record<string, DebriefTeamRound> = {};

      for (const t of teamIds) {
        const dec = decs.find((d) => id(d.teamId) === t) ?? null;

        const energyByLever: Record<string, number> = {};
        let energy = 0;
        for (const sel of dec?.globalInputs ?? []) {
          const spent = leverEnergy(sel);
          if (spent === 0) continue;
          energy += spent;
          // `category` is the container name as snapshotted on the decision.
          const bucket = String(sel.category ?? "").trim() || "Other";
          energyByLever[bucket] = (energyByLever[bucket] ?? 0) + spent;
        }

        const revenue = sumScored(dec, "revenue");
        const net     = sumScored(dec, "operatingProfit");

        const byProduct: Record<string, DebriefTeamProduct> = {};
        for (const p of ordered) byProduct[id(p._id)] = productBlock(dec, p, vocFieldIds);

        teamsOut[t] = {
          energy,
          cashOpening:       cash?.opening.get(t) ?? null,
          cashClosing:       cash?.closing.get(t) ?? null,
          revenue,
          cogs:              sumScored(dec, "COGS"),
          grossProfit:       sumScored(dec, "grossProfit"),
          operatingExpenses: sumScored(dec, "operatingExpenses"),
          netProfit:         net,
          unitsSold:         sumScored(dec, "unitsSold"),
          customersObtained: sumScored(dec, "customersObtained"),
          costByCategory:    costsByCategory(dec),
          energyByLever,
          byProduct,
        };
      }

      return { roundNumber: r, teams: teamsOut };
    });

  return { simulationId, roundNumber, you, teams: teamRefs, products: productMeta, rounds };
}
