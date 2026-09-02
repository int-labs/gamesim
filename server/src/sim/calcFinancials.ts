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


export interface TeamShare {
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
  /** Unsold units at close: (openingStock + produced) − unitsSold. Charged
   *  holding, and read as the next round's openingStock. */
  closingStock:        number;
  /** Units actually sold — demand clamped by opening stock plus production. */
  unitsSold:           number;
  revenue:             number;
  COGS:                number;
  grossProfit:         number;
  /** Period costs: inventory holding on the unsold remainder, plus every
   *  globalInput cost declared as opex. Sits BELOW the gross-profit line. */
  operatingExpenses:   number;
  operatingProfit:     number;
  productCostBreakdown: ProductCostBreakdown[];
  incurredCosts:       IncurredCostBreakdown[];
}

/** The metric block persisted under `projections[productId]`.
 *
 *  Both writers call this — /projections/recalc and roundCalculation — so a
 *  field added to the sheet reaches the live projection and the official round
 *  close together, or not at all. They hand-maintained near-identical literals
 *  before, and the sets had already fallen out of order.
 *
 *  `marketShare` is deliberately NOT here: recalc has no competed share to
 *  write, and inventing one would let a what-if overwrite a scored result. The
 *  round close spreads it in on top. */
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
  incurredCosts:     f.incurredCosts,
});

/** Named so storing collections can declare it honestly — two of the metrics
 *  are ARRAYS, not numbers. */
export type ProjectionMetrics = ReturnType<typeof toProjectionMetrics>;

/** The OFFICIAL block: metrics + the competed share only the round close has.
 *  Stored on `Decision.scored[productId]`. */
export type ScoredMetrics = ProjectionMetrics & { marketShare: number };

export interface CostBreakdownEntry {
  category:     string;
  key:          string;
  label:        string;
  quantity:     number;
  incurredCost: number;
}

export interface CalcFinancialsInput {
  productId:     mongoose.Types.ObjectId;
  marketShares:  TeamShare[];
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

const getGlobalInputQuantity = (
  decision: DecisionDocument | undefined,
  entry:    DecisionGlobalInputEntry
): number => {
  if (!decision) return 0;

  const match = decision.globalInputs.find((gi) =>
    gi.globalInputItemId.equals(entry.globalInputItemId)
  );

  // item not selected at all
  if (!match) return 0;

  const hasOptions = entry.options && Object.keys(entry.options).length > 0;

  if (hasOptions) {
    if (!match.selectedStepKey) return 0;
    return entry.options[match.selectedStepKey] ?? 0;
  } else {
    // radio/checkbox — binary: selected = 1
    return 1;
  }
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
  const { productId, marketShares, productFields, decisions, globalInputs, baseVariables, openingStock } = input;

  const availableMarket = baseVariables.availableMarket ?? 0;

  const sellingPriceField = productFields.find((f) => f.key === SELLING_PRICE_KEY);
  const priceFields       = productFields.filter((f) => f.type === "money" && f.direction > 0 && f.key !== SELLING_PRICE_KEY);
  const costFields        = productFields.filter((f) => f.type === "money" && f.unitCost != null);

  const results: TeamFinancials[] = marketShares.map(({ teamId, value: marketShare }) => {
    const decision = decisions.find((d) => d.teamId.equals(teamId));

    const sellingPriceEntry = sellingPriceField
      ? decision?.inputs
          .find((inp) => inp.productId.equals(productId))
          ?.fields.find((f) => f.fieldId.equals(sellingPriceField._id))
      : null;
    const sellingPrice = Number(sellingPriceEntry?.value ?? 0);

    const dynamicPrice = priceFields.reduce((sum, field) => {
      const resolved    = resolveFieldValue(
        decision?.inputs.find(inp => inp.productId.equals(productId))
          ?.fields.find(f => f.fieldId.equals(field._id))?.value ?? null,
        field
      );
      const bellFactor  = calcDiminishingReturnsCostFactor(resolved, field.minValue, field.maxValue);
      return sum + (resolved * bellFactor * field.direction);
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
    let inventoryCostPerUnit     = 0;   // currency per unsold unit, not a rate

    globalInputs.forEach((entry) => {
      const stepMultiplier = getGlobalInputQuantity(decision, entry);
      const hasOptions     = entry.options && Object.keys(entry.options).length > 0;
      const effectiveMultiplier = hasOptions ? stepMultiplier : 1;
      
      if (effectiveMultiplier === 0) return;
      
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
        }

        if (config.affects === "dynamicCost") {
          if (impact.type === "relative") {
            dynamicCost = Math.max(0, dynamicCost * (1 - impactValue * effectiveMultiplier));
          } else {
            dynamicCost = Math.max(0, dynamicCost - impactValue * effectiveMultiplier);
          }
        }

        if (config.affects === "inventoryCost") {
          if (impact.type === "relative") {
            inventoryCostPerUnit *= (1 + impactValue * effectiveMultiplier);
          } else {
            inventoryCostPerUnit += impactValue * effectiveMultiplier;
          }
        }
      });
    });
    
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
    
    let potentialObtained = marketShare * availableMarket * productScore;
    let customersObtained = potentialObtained > availableMarket ? availableMarket : potentialObtained;
    
    customersObtained = customersObtained * customersObtainedAugment;
    
    // ── Production, stock, and what actually sells ───────────────────────────
    // `inventoryQty` is the CEILING on production, never the amount produced.
    // Conflating the two made the produce planner inert: the model assumed
    // maximum output every round and billed holding on the remainder, so
    // over-production was an unavoidable tax rather than a decision.
    const producedRaw = decision?.inputs
      .find((inp) => inp.productId.equals(productId))?.produced;

    // Half the ceiling when unstated — the same default the planner displays, so
    // a team that never touched the slider is scored on the figure it was shown.
    // Clamped by the ceiling: a target above capacity cannot be built.
    const produced = Math.min(
      producedRaw != null ? producedRaw : Math.floor(inventoryQty * 0.5),
      inventoryQty,
    );

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

    // Holding: the unsold remainder at the operator's per-unit inventory cost
    // (channels → impacts → `inventory_cost`). Charged on closing stock — a
    // team that produced conservatively is not billed for units it chose not
    // to make.
    const holdingCost = closingStock * inventoryCostPerUnit;

    // ── Cost breakdown, partitioned by declared treatment ────────────────────
    const incurredCosts: IncurredCostBreakdown[] = [];

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

    incurredCosts.push({
      key:          "holding",
      label:        "Inventory holding",
      category:     "inventory",
      inputQty:     closingStock,
      leftover:     closingStock,
      costPerUnit:  inventoryCostPerUnit,
      incurredCost: holdingCost,
      treatment:    "opex",
    });

    // Group global inputs by category. No branch and no default: the entry
    // arrives already normalised by readCostTreatment at the entry point.
    let globalInputCOGS = 0;
    let globalInputOpex = 0;

    const categoryMap: Record<string, {
      cogs:        number;
      opex:        number;
      label:       string;
      stepValues:  number[];
    }> = {};

    globalInputs.forEach((entry) => {
      const stepMultiplier = getGlobalInputQuantity(decision, entry);
      const hasOptions     = entry.options && Object.keys(entry.options).length > 0;
      // slider — cost scales with the selected step; radio/checkbox — full cost
      const m    = hasOptions ? stepMultiplier : 1;
      const cogs = entry.costTreatment.cogs * m;
      const opex = entry.costTreatment.opex * m;

      if (!categoryMap[entry.category]) {
        categoryMap[entry.category] = { cogs: 0, opex: 0, label: entry.category, stepValues: [] };
      }
      categoryMap[entry.category].cogs += cogs;
      categoryMap[entry.category].opex += opex;
      categoryMap[entry.category].stepValues.push(m);

      globalInputCOGS += cogs;
      globalInputOpex += opex;
    });

    // Push one entry per category, per side of the line it lands on.
    Object.entries(categoryMap).forEach(([category, { cogs, opex, label, stepValues }]) => {
      const avgStepValue = stepValues.length > 0
        ? stepValues.reduce((a, b) => a + b, 0) / stepValues.length
        : 0;
      const divisor = stepValues.length || 1;

      if (cogs !== 0) {
        incurredCosts.push({
          key: category, label, category,
          inputQty: avgStepValue, leftover: 0,
          costPerUnit: cogs / divisor, incurredCost: cogs, treatment: "cogs",
        });
      }
      if (opex !== 0) {
        incurredCosts.push({
          key: category, label, category,
          inputQty: avgStepValue, leftover: 0,
          costPerUnit: opex / divisor, incurredCost: opex, treatment: "opex",
        });
      }
    });

    // ── The sheet ────────────────────────────────────────────────────────────
    // Revenue is arithmetically identical to the old ternary: unitsSold is
    // min(customersObtained, inventoryQty), which is what that branch computed.
    const revenue           = unitsSold * sellingPrice;
    const COGS              = unitCOGS + globalInputCOGS;
    const grossProfit       = revenue - COGS;
    const operatingExpenses = holdingCost + globalInputOpex;
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
      incurredCosts,
    };
  });

  return { results };
}