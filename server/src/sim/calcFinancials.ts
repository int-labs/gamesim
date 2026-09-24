import mongoose from "mongoose";
import { IMPACT_CONFIG, SELLING_PRICE_KEY } from "../constants/impacts";
import { calcBellCurveScore } from "../utils/calcBellCurveScore";
import { calcReverseDiminishingReturns } from "../utils/calcReverseDiminishingReturns";
import { calcDiminishingReturnsCostFactor } from "../utils/calcDiminishingReturnsCostFactor";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProductField {
  _id:          mongoose.Types.ObjectId;
  key:          string;
  label:        string;
  type:         string;
  order:        number;
  required:     boolean;
  minValue:     number | null;
  maxValue:     number | null;
  direction:    number;
  tightening:   number;
  coefficients: Record<string, number>;
  options:      Record<string, number>;
  unitCost:     number | null;
}

export interface GlobalInputItem {
  _id:              mongoose.Types.ObjectId;
  key:              string;
  label:            string;
  minPossibleValue: number | null;
  maxPossibleValue: number | null;
  cost:             number;
  energy:           number;
}

export interface GlobalInputContainer {
  _id:      mongoose.Types.ObjectId;
  category: string;
  key:      string;
  inputs:   GlobalInputItem[];
}

export interface ProductCostBreakdown {
  key:   string;
  label: string;
  value: number;
}

/**
 * One field's contribution to `dynamicPrice`: `resolved × bellFactor ×
 * direction`. Same shape as the cost breakdown, a different quantity — this is
 * a weighted SCORE, not money.
 *
 * Exists so the analysis report can show what each decision contributed without
 * re-deriving a market-model line.
 */
export type ProductScoreBreakdown = ProductCostBreakdown;

export interface BaseVariables {
  availableMarket: number;
  [key: string]:   number | undefined;
}

export interface DecisionField {
  fieldId: mongoose.Types.ObjectId;
  value:   number | string | null;
}

export interface DecisionProductInput {
  productId: mongoose.Types.ObjectId;
  /** Units the team committed to producing. null = not stated. Read RAW — no
   *  bell curve; that belongs to the `inventoryQty` ceiling, not to a quantity
   *  the player typed. */
  produced:  number | null;
  fields:    DecisionField[];
}

// Decision.globalInputs is still an evolving part of the real schema —
// this is the minimal shape this function needs from it.
export interface DecisionGlobalInputEntry {
  globalInputItemId: mongoose.Types.ObjectId;
  category:          string;
  key:               string;
  label:             string;
  selectedStepKey:   string | null;
  options:           Record<string, number>;
  impacts:           Record<string, {
    type:  "relative" | "absolute";
    value: number;
    /** Per-product multiplier on `value`, keyed by productId. 0.5 halves this
     *  impact for that product; absent means the base value stands. */
    selections?: Array<{ productId: unknown; value: number }>;
  }>;
  impactLevel:       string | null;
  cost:              number;
  /** Already normalised by `readCostTreatment` at the entry point — this
   *  function never falls back or defaults, so the live projection and the
   *  official round close cannot interpret the same decision differently. */
  costTreatment:     { cogs: number; opex: number };
  energy:            number;
  productsImpacted:  mongoose.Types.ObjectId[];
}

export interface DecisionDocument {
  teamId:       mongoose.Types.ObjectId;
  inputs:       DecisionProductInput[];
  globalInputs: DecisionGlobalInputEntry[];
}


/**
 * A team's MARKET FIT for one product: the normalised `productScore` across the
 * teams competing for it, summing to 1.
 *
 * It was called a market share until 2026-09-24 and it is not one. It is the
 * ALLOCATION basis — how much of the available market a team's decisions earn
 * it — and it is an INPUT to this function. The real market share is each
 * team's share of the CUSTOMERS WON, which is an OUTPUT and cannot be known
 * here: `customersObtained` is computed from this, so a share defined on it
 * would be circular. `roundCalculation` computes it once every pass is done.
 */
export interface TeamFit {
  teamId: mongoose.Types.ObjectId;
  value:  number;
}

/** The single interpreter of a globalInput entry's cost.
 *
 *  Legacy documents carry a flat `cost` and no treatment; those are period
 *  costs — that is precisely what the old code did with them, so this fallback
 *  restates history rather than rewriting it. Documents written from here on
 *  carry `costTreatment`.
 *
 *  Both money paths must call this — /projections/recalc (client payload) and
 *  roundCalculation (stored Decision). Sharing one reader is what makes it
 *  impossible for the live projection and the official score to interpret the
 *  same decision differently. */
export const readCostTreatment = (gi: {
  cost?: number;
  costTreatment?: { cogs?: number; opex?: number };
}): { cogs: number; opex: number } =>
  gi.costTreatment
    ? { cogs: gi.costTreatment.cogs ?? 0, opex: gi.costTreatment.opex ?? 0 }
    : { cogs: 0, opex: gi.cost ?? 0 };

/** Costs charged PER UNIT. `inputQty × costPerUnit === incurredCost` holds for
 *  every entry — do not add a row here that cannot satisfy it. */
export interface IncurredCostBreakdown {
  key:          string;
  label:        string;
  category:     string;
  inputQty:     number;
  leftover:     number;
  costPerUnit:  number;
  incurredCost: number;
  /** Which side of the gross-profit line this entry falls on, so the frontend
   *  can group the breakdown into COGS and OpEx sections without re-deriving
   *  the classification. */
  treatment:    "cogs" | "opex";
}

/** GlobalInput spend, grouped into one row per category per side of the line.
 *  Deliberately has NO inputQty/costPerUnit: the charge is `costTreatment ×
 *  step`, already final, so there is no quantity to divide by. */
export interface GlobalInputCostBreakdown {
  /** The P&L row name — operator-owned free text, never normalised. */
  category:     string;
  label:        string;
  treatment:    "cogs" | "opex";
  incurredCost: number;
  /** The items summed into this row, so the sheet can show what made it up. */
  contributors: Array<{
    label:        string;
    /** The selected option's multiplier; 1 for a radio/checkbox. */
    stepValue:    number;
    incurredCost: number;
  }>;
}

export interface TeamFinancials {
  teamId:              mongoose.Types.ObjectId;
  customersObtained:   number;
  sellingPrice:        number;
  dynamicPrice:        number;
  productScore:        number;
  csatScore:           number; // raw bell curve score before marketing augmentation
  dynamicCost:         number;
  /** Production CEILING for the round — the most the player could make.
   *  Derived from the product's own field values against the per-product
   *  INVENTORY_BASE. Never the amount produced; see `produced`. */
  inventoryQty:        number;
  /** Units actually built this round: min(the team's target, inventoryQty).
   *  This is what COGS is charged on. */
  produced:            number;
  /** Unsold units at close: (openingStock + produced) − unitsSold. Carries no
   *  charge of its own — COGS was recognised on the build — and is read as the
   *  next round's openingStock. */
  closingStock:        number;
  /** Units actually sold — demand clamped by opening stock plus production. */
  unitsSold:           number;
  revenue:             number;
  COGS:                number;
  grossProfit:         number;
  /** Period costs: the channel's cut of each sale, plus every globalInput cost
   *  declared as opex. Sits BELOW the gross-profit line. */
  operatingExpenses:   number;
  operatingProfit:     number;
  productCostBreakdown: ProductCostBreakdown[];
  /** Per-field contributions to `dynamicPrice`. Sums to it by construction. */
  productScoreBreakdown: ProductScoreBreakdown[];
  incurredCosts:       IncurredCostBreakdown[];
  globalInputCosts:    GlobalInputCostBreakdown[];
}

/** The metric block persisted under `projections[productId]`.
 *
 *  Both writers call this — /projections/recalc and roundCalculation — so a
 *  field added to the sheet reaches the live projection and the official round
 *  close together, or not at all. They hand-maintained near-identical literals
 *  before, and the sets had already fallen out of order.
 *
 *  `marketFit` and `marketShare` are deliberately NOT here: recalc has no
 *  competed figures to write, and inventing them would let a what-if overwrite
 *  a scored result. The round close spreads them in on top. */
export const toProjectionMetrics = (f: TeamFinancials) => ({
  customersObtained: f.customersObtained,
  sellingPrice:      f.sellingPrice,
  dynamicPrice:      f.dynamicPrice,
  productScore:      f.productScore,
  dynamicCost:       f.dynamicCost,
  inventoryQty:      f.inventoryQty,
  produced:          f.produced,
  // Read by the NEXT round as its openingStock. Both writers of this shape put
  // it here, so a round can always find the one before it.
  closingStock:      f.closingStock,
  unitsSold:         f.unitsSold,
  revenue:           f.revenue,
  COGS:              f.COGS,
  grossProfit:       f.grossProfit,
  operatingExpenses: f.operatingExpenses,
  operatingProfit:   f.operatingProfit,
  productCostBreakdown: f.productCostBreakdown,
  // The analysis report's weighted-score rows. Persisted with the rest so the
  // report reads it like every other figure.
  productScoreBreakdown: f.productScoreBreakdown,
  incurredCosts:     f.incurredCosts,
  // Both readers must take BOTH arrays: COGS and opex totals are only whole
  // when the globalInput rows are added to the unit rows.
  globalInputCosts:  f.globalInputCosts,
});

/** Named so storing collections can declare it honestly — two of the metrics
 *  are ARRAYS, not numbers. */
export type ProjectionMetrics = ReturnType<typeof toProjectionMetrics>;

/**
 * The OFFICIAL block: metrics plus the two competed figures only the round
 * close has. Stored on `Decision.scored[productId]`.
 *
 * TWO DIFFERENT THINGS, and they were one name until 2026-09-24:
 *
 *   marketFit    normalised productScore — the ALLOCATION. How much of the
 *                available market this team's decisions earned it. An INPUT to
 *                calcFinancials.
 *   marketShare  customersObtained_i / Σ customersObtained across the teams
 *                competing for this product — the share of CUSTOMERS WON. An
 *                OUTCOME, computed by roundCalculation after every pass.
 *
 * Fit is what the decisions earned before `productScore` and the globalInput
 * augmentation are applied; share is what they won after. Whether a team could
 * DELIVER what it won is a third thing, and the Demand block on the reports
 * shows it: demand against Customers Fulfilled (`unitsSold`).
 */
export type ScoredMetrics = ProjectionMetrics & {
  marketFit:   number;
  marketShare: number;
};

export interface CostBreakdownEntry {
  category:     string;
  key:          string;
  label:        string;
  quantity:     number;
  incurredCost: number;
}

export interface CalcFinancialsInput {
  productId:     mongoose.Types.ObjectId;
  /** One per competing team — the ALLOCATION basis, not a share of sales. */
  marketFits:    TeamFit[];
  productFields: ProductField[];
  decisions:     DecisionDocument[];
  globalInputs:  DecisionGlobalInputEntry[]; // flat — category already embedded
  baseVariables: BaseVariables;
  /**
   * teamId (as string) → units carried in from the previous round's
   * `closingStock`. Absent/0 in round 1.
   *
   * NOT `inventoryQty`: that is the per-round production CEILING, recomputed
   * from field values every round and never persisted. BOTH callers must pass
   * this — `roundCalculation` and `recalcProjections` — or the live projection
   * computes `sellable = produced` while the scored round uses
   * `openingStock + produced`.
   */
  openingStock?: Record<string, number>;
}

export interface CalcFinancialsOutput {
  results: TeamFinancials[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (value: number, min: number | null, max: number | null): number => {
  let v = value;
  if (min !== null) v = Math.max(v, min);
  if (max !== null) v = Math.min(v, max);
  return v;
};

// ── Resolve the effective numeric value for any field type ──────────────────
const resolveFieldValue = (
  raw:   number | string | null,
  field: ProductField
): number => {
  if (field.type === "enum") {
    const key = String(raw ?? "");
    return field.options?.[key] ?? 0;
  }

  const numeric = Number(raw ?? 0);
  const clamped = clamp(numeric, field.minValue, field.maxValue);

  if (field.type === "percentage") {
    return clamped / 100;
  }

  return clamped;
};

// ── Updated getDecisionInput to use resolveFieldValue ───────────────────────
const getDecisionInput = (
  decision:     DecisionDocument | undefined,
  productId:    mongoose.Types.ObjectId,
  productField: ProductField
): number => {
  if (!decision) return 0;
  const productInput = decision.inputs.find((inp) => inp.productId.equals(productId));
  const fieldEntry   = productInput?.fields.find((f) => f.fieldId.equals(productField._id));

  // resolveFieldValue handles enum lookup and numeric clamping
  const resolved = resolveFieldValue(fieldEntry?.value ?? null, productField);

  // bell curve only applies to numeric/money/percentage/currency types —
  // enum fields resolve to a fixed multiplier, no diminishing returns needed
  if (productField.type === "enum") return resolved;

  return resolved * calcDiminishingReturnsCostFactor(
    resolved,
    productField.minValue,
    productField.maxValue
  );
};

/**
 * THE step multiplier. One implementation — callers differ only in where they
 * get the two operands, never in the rule.
 *
 *   no options              → 1   (radio/checkbox is binary)
 *   options, no key         → 0
 *   options, unknown key    → 0   (collapses the entry rather than guessing)
 *
 * IT SAYS NOTHING ABOUT WHETHER THE TEAM SELECTED THE ITEM. That is a separate
 * question and belongs to the caller: a reader iterating a DECISION has it
 * answered by construction, while one iterating the CONFIG must look the entry
 * up first. Conflating the two is what charged every declined binary lever at
 * full cost — see `getGlobalInputQuantity` below.
 *
 * Mirrored by `gamesim/impacts.ts` in the player repo, which cannot import this.
 */
export const stepMultiplier = (
  options:         Record<string, number> | null | undefined,
  selectedStepKey: string | null | undefined,
): number => {
  const opts = options ?? {};
  if (Object.keys(opts).length === 0) return 1;
  if (!selectedStepKey) return 0;
  return opts[selectedStepKey] ?? 0;
};

const getGlobalInputQuantity = (
  decision: DecisionDocument | undefined,
  entry:    DecisionGlobalInputEntry
): number => {
  if (!decision) return 0;

  const match = decision.globalInputs.find((gi) =>
    gi.globalInputItemId.equals(entry.globalInputItemId)
  );

  // Item not selected at all. Checked HERE and not inside `stepMultiplier`,
  // because absence is the "no" and a binary item that was never chosen must
  // not reach the binary-is-1 rule.
  if (!match) return 0;

  // `options` from the CONFIG entry, the chosen key from the DECISION.
  return stepMultiplier(entry.options, match.selectedStepKey);
};

const INVENTORY_BASE = 1000;

// ─── Core Calculation ────────────────────────────────────────────────────────

export const calcPricingScore = (
  sellingPrice: number,
  dynamicPrice: number,
  min:          number | null,
  max:          number | null,
): number => {
  if (dynamicPrice <= 0) return 0;

  if (sellingPrice <= dynamicPrice) {
    // underselling side — bell curve skewed toward min
    // raw score: 1 at min, falls toward 0 as sellingPrice approaches dynamicPrice
    const rawScore = calcBellCurveScore(sellingPrice, min, dynamicPrice, min ?? 0);

    // normalize so junction (sellingPrice === dynamicPrice) lands at ~0.5
    // scale: 0 → 0.5, 1 → 1 (min stays at peak, junction meets at 0.5)
    return 0.5 + (rawScore * 0.5);
  }

  // overpricing side — reverse diminishing returns from dynamicPrice outward
  // raw score: 1 at dynamicPrice, decays toward 0 as sellingPrice increases
  const rawScore = calcReverseDiminishingReturns(sellingPrice, dynamicPrice, max);

  // normalize so junction (sellingPrice === dynamicPrice) lands at ~0.5
  // scale: 1 → 0.5, 0 → 0 (junction meets at 0.5, extreme overpricing → 0)
  // console.log(rawScore);
  return rawScore * 0.5;
};


export function calcFinancials(input: CalcFinancialsInput): CalcFinancialsOutput {
  const { productId, marketFits, productFields, decisions, globalInputs, baseVariables, openingStock } = input;

  const availableMarket = baseVariables.availableMarket ?? 0;

  const sellingPriceField = productFields.find((f) => f.key === SELLING_PRICE_KEY);
  const priceFields       = productFields.filter((f) => f.type === "money" && f.direction > 0 && f.key !== SELLING_PRICE_KEY);
  const costFields        = productFields.filter((f) => f.type === "money" && f.unitCost != null);

  const results: TeamFinancials[] = marketFits.map(({ teamId, value: marketFit }) => {
    const decision = decisions.find((d) => d.teamId.equals(teamId));

    const sellingPriceEntry = sellingPriceField
      ? decision?.inputs
          .find((inp) => inp.productId.equals(productId))
          ?.fields.find((f) => f.fieldId.equals(sellingPriceField._id))
      : null;
    const sellingPrice = Number(sellingPriceEntry?.value ?? 0);

    // PER-FIELD CONTRIBUTIONS, captured not recomputed.
    //
    // The arithmetic below is unchanged — each term is simply kept instead of
    // being summed away, so the analysis report can show what each decision
    // contributed to the score. Deriving these in the report would be a second
    // implementation of a market-model line; this is the same one.
    //
    // `Σ productScoreBreakdown === dynamicPrice` by construction.
    const productScoreBreakdown: ProductScoreBreakdown[] = [];
    const dynamicPrice = priceFields.reduce((sum, field) => {
      const resolved    = resolveFieldValue(
        decision?.inputs.find(inp => inp.productId.equals(productId))
          ?.fields.find(f => f.fieldId.equals(field._id))?.value ?? null,
        field
      );
      const bellFactor  = calcDiminishingReturnsCostFactor(resolved, field.minValue, field.maxValue);
      const contribution = resolved * bellFactor * field.direction;
      productScoreBreakdown.push({
        key:   field.key,
        label: field.label ?? field.key,
        value: contribution,
      });
      return sum + contribution;
    }, 0);

    // ── Cost contribution (raw value * unitCost, no bell curve) ───────────────
    const productCostBreakdown: ProductCostBreakdown[] = [];
    let dynamicCost = 0;

    costFields.forEach((field) => {
      const raw = Number(
        decision?.inputs.find(inp => inp.productId.equals(productId))
          ?.fields.find(f => f.fieldId.equals(field._id))?.value ?? 0
      );

      // cost starts at minValue (baseline), team's input adds on top
      const effectiveValue   = (field.minValue ?? 0) + raw;
      const costContribution = effectiveValue * (field.unitCost ?? 0);
      dynamicCost           += costContribution;

      productCostBreakdown.push({
        key:   field.key,
        label: field.label,
        value: costContribution,
      });
    });

    let inventoryAugmentation = 1;
    let customersObtainedAugment = baseVariables.customersObtainedBase ?? 0.3;
    let dynamicPriceAugment      = baseVariables.dynamicPriceBase      ?? 0.55; // quality augmentation from inventory-affecting global inputs

    /**
     * One entry per SELECTED channel: its cut as a RATE on the selling price,
     * and its share of demand.
     *
     * Collected as pairs rather than summed in place, because the split between
     * channels is not a free choice — a channel's `sales_channel` impact IS its
     * share of the customers obtained, so the same weighting that decides how
     * many units sell decides which channel sold them. Summing the raw rates
     * would charge every channel's cut on every unit; a plain average would
     * ignore that a channel pulling 67% of demand carries 67% of the sales.
     */
    const channelTerms: Array<{ rate: number; weight: number; side: "cogs" | "opex" }> = [];

    globalInputs.forEach((entry) => {
      // ONE resolution, and it lives in `getGlobalInputQuantity` — which already
      // returns 1 for a SELECTED binary item and 0 for one the team never
      // selected. A `hasOptions ? m : 1` ternary used to sit here and restate
      // that rule, but the restatement could not tell "binary and chosen" from
      // "binary and absent": both are `hasOptions === false`, so a declined
      // lever came back as 1 and had every impact below applied to it.
      //
      // ABSENCE IS THE "NO". There is no decline flag on the decision — the
      // client submits selections only — and the reports read it the same way
      // (`!sel → "No"` in reportMatrix).
      const effectiveMultiplier = getGlobalInputQuantity(decision, entry);

      if (effectiveMultiplier === 0) return;

      // Paired from THIS entry before its impacts are dispatched below — the
      // rate and the weight are two SEPARATE impacts on one item
      // (`consignment` and `sales_channel`), and they must not be matched across
      // items.
      let entryRate   = 0;
      let entryWeight = 0;

      Object.entries(entry.impacts).forEach(([metricKey, impact]) => {
        const config = IMPACT_CONFIG[metricKey];
        if (!config) return;

        // ── Per-product override ───────────────────────────────────────────
        // `impacts[k].selections[]` carries a per-product adjustment keyed by
        // productId. The operator's admin client writes it and the GlobalInput
        // validator accepts it, but NOTHING read it — so every configured
        // override moved no number at all.
        //
        // `undefined` when this impact declares no override, or declares none
        // for this product — NOT defaulted to a neutral value, because the two
        // impact types do not consume it the same way:
        //
        //   • relative is a RATE     → the override MULTIPLIES it (0.5 halves)
        //   • absolute is a QUANTITY → the override ADDS to it
        //
        // With no override, `impactValue` is `impact.value` and each branch
        // below runs exactly as it did before this was wired.
        const override = impact.selections?.find(
          (sel) => String(sel.productId) === String(productId)
        )?.value;

        const impactValue =
          override == null       ? impact.value
          : impact.type === "relative" ? impact.value * override
          :                              impact.value + override;

        if (config.affects === "inventoryRate") {
          if (impact.type === "relative") {
            inventoryAugmentation *= (1 + impactValue * effectiveMultiplier);
            dynamicPriceAugment   *= (1 + impactValue * effectiveMultiplier);
          } else {
            inventoryAugmentation += (impactValue * effectiveMultiplier);
            dynamicPriceAugment   += (impactValue * effectiveMultiplier);
          }
        }

        if (config.affects === "customersObtained") {
          if (impact.type === "relative") {
            customersObtainedAugment *= (1 + impactValue * effectiveMultiplier);
          } else {
            customersObtainedAugment += (impactValue * effectiveMultiplier);
          }
          // A `sales_channel` pull doubles as this entry's share of the sales.
          // Other customersObtained sources (marketing) are company-wide and
          // route no units, so they must not weight the consignment split.
          if (metricKey === "sales_channel") {
            entryWeight += Math.max(0, impactValue * effectiveMultiplier);
          }
        }

        if (config.affects === "dynamicCost") {
          if (impact.type === "relative") {
            dynamicCost = Math.max(0, dynamicCost * (1 - impactValue * effectiveMultiplier));
          } else {
            dynamicCost = Math.max(0, dynamicCost - impactValue * effectiveMultiplier);
          }
        }

        if (config.affects === "consignment") {
          // `impactValue`, not `× effectiveMultiplier`: a channel is binary, so
          // that term is always 1 here. Live data carries no per-product
          // `selections[]` on this key, so `impactValue` is the base rate — but
          // it is read through the same override path as everything else, so
          // adding one later needs no change here.
          entryRate += impactValue;
        }
      });

      // A channel that pulls demand but takes no cut still belongs here: it
      // carries sales at a zero rate, which correctly dilutes the paid channels'
      // share. Only an entry with neither is skipped.
      if (entryRate !== 0 || entryWeight !== 0) {
        // The OPERATOR'S choice, not a constant: `costTreatment` is the item's
        // own `cogs`/`opex` enum, already split into legs by `readCostTreatment`
        // at the entry point, so whichever leg carries the cost names the side.
        // Both legs zero — a free item — falls to "opex", which is the schema
        // default the enum itself carries.
        const side = entry.costTreatment.cogs > 0 ? "cogs" : "opex";
        channelTerms.push({ rate: entryRate, weight: entryWeight, side });
      }
    });

    /**
     * The blended cut ONE unit pays: each channel's rate weighted by its share
     * of demand.
     *
     * RENORMALISED over the SELECTED channels. The operator's per-product
     * `sales_channel.selections[]` already sum to 1 across all three, but a team
     * that picked only one sends 100% of its sales through it, not that
     * channel's share of a full line-up.
     */
    const totalChannelWeight = channelTerms.reduce((sum, t) => sum + t.weight, 0);

    // Accumulated PER SIDE, because the treatment is the operator's per-item
    // choice — two selected channels may sit on opposite sides of the line, and
    // one blended figure could not honour both.
    let consignmentCogsPerUnit = 0;
    let consignmentOpexPerUnit = 0;
    for (const t of channelTerms) {
      // `: 0` — a DELETED fallback, not a default. This arm was `: 1`, summing
      // the rates where there was nothing to apportion by. An override of 0
      // means the notebook is not sold there, so it takes no cut (2026-09-24).
      const share = totalChannelWeight > 0 ? t.weight / totalChannelWeight : 0;
      // A RATE on the selling price — retail 0.2 takes a fifth of every sale.
      const perUnit = sellingPrice * t.rate * share;
      if (t.side === "cogs") consignmentCogsPerUnit += perUnit;
      else                   consignmentOpexPerUnit += perUnit;
    }
    
    const inventoryQty = productFields
      .filter((f) => f.direction !== undefined && f.direction !== null && f.key !== SELLING_PRICE_KEY)
      .reduce((product, field) => {
        const value = getDecisionInput(decision, productId, field);
        // A zero contributes NOTHING. Must not round here: rounding
        // mid-reduction made the result depend on `productFields` ORDER.
        return value === 0 ? product : product * Math.max(0, 1 - (value * 0.01));
      }, INVENTORY_BASE) * inventoryAugmentation;

    const augmentedDynamicPrice = dynamicPrice * dynamicPriceAugment;

    const csatScore = sellingPrice > 0
    ? calcBellCurveScore(
        sellingPrice,
        sellingPriceField?.minValue ?? null,
        sellingPriceField?.maxValue ?? null,
        dynamicPrice
      )
    : 0;
    
    const productScore = sellingPrice > 0
    ? calcPricingScore(
      sellingPrice,
      augmentedDynamicPrice, // shifted center point
      sellingPriceField?.minValue ?? null,
      sellingPriceField?.maxValue ?? null,
    )
    : 0;
    
    let potentialObtained = marketFit * availableMarket * productScore;
    let customersObtained = potentialObtained > availableMarket ? availableMarket : potentialObtained;
    
    customersObtained = customersObtained * customersObtainedAugment;

    // NO CHANNEL, NO SALE. `customersObtainedAugment` starts at a non-zero base
    // (0.3) and `sales_channel` only ever MULTIPLIES it, so a per-product
    // override of 0 left the floor intact and the notebook still pulled demand
    // it had nowhere to sell — newbie's Indie Notebook, round 2: $4,002.92 of
    // revenue through no storefront. The channel weight cannot express that on
    // its own, so it is gated here instead.
    //
    // Covers BOTH ways of having no storefront, which both land on a zero total:
    // every channel's override is 0, and no channel selected at all. Owner's
    // ruling 2026-09-24 — "no place to sell and no revenue to be made".
    //
    // Demand only. COGS still lands on the full build: the team paid to make
    // notebooks it had no way to sell, and that is the lesson.
    if (totalChannelWeight === 0) customersObtained = 0;

    // ── Production, stock, and what actually sells ───────────────────────────
    // `inventoryQty` is the CEILING on production, never the amount produced.
    // Conflating the two made the produce planner inert: the model assumed
    // maximum output every round, so over-production was an unavoidable tax
    // rather than a decision.
    const producedRaw = decision?.inputs
      .find((inp) => inp.productId.equals(productId))?.produced;

    // ZERO when unstated — production is a decision the team must make. This
    // was half the ceiling, which handed out an unrequested build: the team was
    // billed COGS for units it never planned, and a standing figure in the
    // planner invited ignoring the scale entirely. The client's default matches.
    // Clamped by the ceiling: a target above capacity cannot be built.
    const produced = Math.min(producedRaw ?? 0, inventoryQty);

    const opening  = openingStock?.[String(teamId)] ?? 0;
    const sellable = opening + produced;

    const unitsSold = Math.min(customersObtained, sellable);

    // What the team carries into the next round.
    const closingStock = Math.round(Math.max(0, sellable - unitsSold));

    // COGS follows PRODUCTION, not the sale: cost is recognised when units are
    // BUILT. Carried stock was expensed in the round that produced it, so
    // selling it later adds no COGS — which is also what stops `dynamicCost`
    // from retroactively re-pricing last round's leftovers when a team hires a
    // cost-reducing candidate this round.
    const unitCOGS = produced * dynamicCost;

    // NO holding charge on `closingStock`. There is no warehouse in this
    // simulation, so a carrying cost modelled nothing the player can decide
    // about — and the penalty for overproducing is already fully expressed:
    // COGS lands on the BUILD, so an unsold unit has been paid for in the round
    // that made it and carries forward as an asset that sells later at no
    // further COGS. Removed 2026-09-17 on the owner's ruling. The lever behind
    // it (`inventory_cost`) went with it; nothing in the live config authored
    // one.

    // Consignment: the channel's cut, on units that actually SOLD. Not on units
    // built — an unsold notebook pays no storefront fee.
    const consignmentCogs = unitsSold * consignmentCogsPerUnit;
    const consignmentOpex = unitsSold * consignmentOpexPerUnit;

    // ── Cost breakdown, partitioned by declared treatment ────────────────────
    const incurredCosts: IncurredCostBreakdown[] = [];
    const globalInputCosts: GlobalInputCostBreakdown[] = [];

    incurredCosts.push({
      key:          "inventory",
      label:        "Cost of goods sold",
      category:     "inventory",
      // PRODUCED, not sold — COGS is recognised on the build.
      inputQty:     Math.round(produced),
      leftover:     0,
      costPerUnit:  dynamicCost,
      incurredCost: unitCOGS,
      treatment:    "cogs",
    });

    // One row per SIDE, and only when that side charged — the treatment is the
    // operator's, so this array must not assert one. Two rows appear only when
    // selected channels genuinely sit on opposite sides of the line.
    if (consignmentCogs !== 0) {
      incurredCosts.push({
        key:          "consignment_cogs",
        label:        "Channel consignment",
        category:     "sales_channel",
        inputQty:     unitsSold,
        leftover:     0,
        costPerUnit:  consignmentCogsPerUnit,
        incurredCost: consignmentCogs,
        treatment:    "cogs",
      });
    }
    if (consignmentOpex !== 0) {
      incurredCosts.push({
        key:          "consignment_opex",
        label:        "Channel consignment",
        category:     "sales_channel",
        inputQty:     unitsSold,
        leftover:     0,
        costPerUnit:  consignmentOpexPerUnit,
        incurredCost: consignmentOpex,
        treatment:    "opex",
      });
    }

    // Group global inputs by category. No branch and no default: the entry
    // arrives already normalised by readCostTreatment at the entry point.
    let globalInputCOGS = 0;
    let globalInputOpex = 0;

    type Contribution = GlobalInputCostBreakdown["contributors"][number];

    const categoryMap: Record<string, {
      cogs:      number;
      opex:      number;
      cogsItems: Contribution[];
      opexItems: Contribution[];
    }> = {};

    globalInputs.forEach((entry) => {
      // Slider — cost scales with the selected step; radio/checkbox — full
      // cost; never selected — nothing. All three come from the one resolver;
      // see the note at the channel loop for what the removed ternary broke.
      const m    = getGlobalInputQuantity(decision, entry);
      const cogs = entry.costTreatment.cogs * m;
      const opex = entry.costTreatment.opex * m;

      if (!categoryMap[entry.category]) {
        categoryMap[entry.category] = { cogs: 0, opex: 0, cogsItems: [], opexItems: [] };
      }
      const row = categoryMap[entry.category];
      row.cogs += cogs;
      row.opex += opex;
      // Listed per SIDE, and only when it actually charged: an item with
      // cogs 0 / opex 40 belongs to the OpEx row alone, and an unselected one
      // (step 0) belongs to neither.
      if (cogs !== 0) row.cogsItems.push({ label: entry.label, stepValue: m, incurredCost: cogs });
      if (opex !== 0) row.opexItems.push({ label: entry.label, stepValue: m, incurredCost: opex });

      globalInputCOGS += cogs;
      globalInputOpex += opex;
    });

    // One row per category, per side of the line it lands on. The category IS
    // the expense name — it names the sum, which no single item's label can.
    Object.entries(categoryMap).forEach(([category, r]) => {
      if (r.cogs !== 0) {
        globalInputCosts.push({
          category, label: category, treatment: "cogs",
          incurredCost: r.cogs, contributors: r.cogsItems,
        });
      }
      if (r.opex !== 0) {
        globalInputCosts.push({
          category, label: category, treatment: "opex",
          incurredCost: r.opex, contributors: r.opexItems,
        });
      }
    });

    // ── The sheet ────────────────────────────────────────────────────────────
    // Revenue is arithmetically identical to the old ternary: unitsSold is
    // min(customersObtained, inventoryQty), which is what that branch computed.
    const revenue           = unitsSold * sellingPrice;
    const COGS              = unitCOGS + globalInputCOGS + consignmentCogs;
    const grossProfit       = revenue - COGS;
    const operatingExpenses = consignmentOpex + globalInputOpex;
    const operatingProfit   = grossProfit - operatingExpenses;

    return {
      teamId,
      customersObtained,
      sellingPrice,
      dynamicPrice,
      productScore,
      csatScore,
      dynamicCost,
      inventoryQty,
      produced,
      closingStock,
      unitsSold,
      revenue,
      COGS,
      grossProfit,
      operatingExpenses,
      operatingProfit,
      productCostBreakdown,
      productScoreBreakdown,
      incurredCosts,
      globalInputCosts,
    };
  });

  return { results };
}