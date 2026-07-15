import mongoose from "mongoose";
import { IMPACT_CONFIG } from "../constants/impacts";

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
  fields:    DecisionField[];
}

// Decision.globalInputs is still an evolving part of the real schema —
// this is the minimal shape this function needs from it.
export interface DecisionGlobalInputEntry {
  globalInputItemId: mongoose.Types.ObjectId;
  key:               string;
  label:             string;
  selectedStepKey:   string | null;
  options:           Record<string, number>;
  impacts:           Record<string, { type: "relative" | "absolute"; value: number }>;
  impactLevel:       string | null;
  cost:              number;
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

export interface DecisionGlobalInputEntry {
  globalInputItemId: mongoose.Types.ObjectId;
  category:          string;
  key:               string;
  label:             string;
  selectedStepKey:   string | null;
  options:           Record<string, number>;
  impacts:           Record<string, { type: "relative" | "absolute"; value: number }>;
  impactLevel:       string | null;
  cost:              number;
  energy:            number;
  productsImpacted:  mongoose.Types.ObjectId[];
}

export interface IncurredCostBreakdown {
  key:          string;
  label:        string;
  category:     string;
  inputQty:     number;
  leftover:     number;
  costPerUnit:  number;
  incurredCost: number;
}

export interface TeamFinancials {
  teamId:              mongoose.Types.ObjectId;
  customersObtained:   number;
  sellingPrice:        number;
  dynamicPrice:        number;
  productScore:        number;
  dynamicCost:         number;
  revenue:             number;
  COGS:                number;
  grossProfit:         number;
  productCostBreakdown: ProductCostBreakdown[];
  incurredCosts:       IncurredCostBreakdown[];
}

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
    // raw is an option key string — look up its multiplier
    const key = String(raw ?? "");
    return field.options?.[key] ?? 0;
  }
  // number/money/percentage/currency — clamp the numeric value
  const numeric = Number(raw ?? 0);
  return clamp(numeric, field.minValue, field.maxValue);
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

const calcDiminishingReturnsCostFactor = (
  quantity: number,
  min:      number | null,
  max:      number | null
): number => {
  if (min === null || max === null || max <= min) return 1;

  const meanMode = (min + max) / 2;
  const stdDev   = (max - min) / 4;

  const z                       = (quantity - meanMode) / stdDev;
  const effectivenessMultiplier = Math.exp(-(z * z) / 2); // 1 at the peak, →0 at the extremes

  return 2 - effectivenessMultiplier; // 1 (peak) → 2 (at the bounds)
};

const SELLING_PRICE_KEY = "selling_price";

export function calcFinancials(input: CalcFinancialsInput): CalcFinancialsOutput {
  const { productId, marketShares, productFields, decisions, globalInputs, baseVariables } = input;

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

    const productScore = sellingPrice > 0 ? dynamicPrice / sellingPrice : 0;

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

    let customersObtained = marketShare * availableMarket * productScore;
    
    let inventoryAugmentation = 1;
    let customersObtainedAugment = 1;

    globalInputs.forEach((entry) => {
      const stepMultiplier = getGlobalInputQuantity(decision, entry);
      const hasOptions     = entry.options && Object.keys(entry.options).length > 0;
      const effectiveMultiplier = hasOptions ? stepMultiplier : 1;

      if (effectiveMultiplier === 0) return;

      Object.entries(entry.impacts).forEach(([metricKey, impact]) => {
        const config = IMPACT_CONFIG[metricKey];
        if (!config) return;

        if (config.affects === "inventoryRate") {
          if (impact.type === "relative") {
            inventoryAugmentation *= (1 + impact.value * effectiveMultiplier);
          } else {
            inventoryAugmentation += (impact.value * effectiveMultiplier);
          }
        }

        if (config.affects === "customersObtained") {
          if (impact.type === "relative") {
            customersObtainedAugment *= (1 + impact.value * effectiveMultiplier);
          } else {
            customersObtainedAugment += (impact.value * effectiveMultiplier);
          }
        }
      });
    });

    customersObtained = customersObtained * customersObtainedAugment;

    const inventoryQty = productFields
      .filter((f) => f.direction !== undefined && f.direction !== null && f.key !== SELLING_PRICE_KEY)
      .reduce((product, field) => {
        const value = getDecisionInput(decision, productId, field);
        return value !== 0 ? product * Math.max(0, 1 - (value * 0.01)) : product;
      }, INVENTORY_BASE) * inventoryAugmentation;

    const leftover      = Math.max(0, inventoryQty - customersObtained);
    const inventoryCost = leftover * dynamicCost;

    // ── GlobalInput-level cost breakdown (flat iteration) ─────────────────
    // ── GlobalInput cost breakdown (aggregated by category) ───────────────────
    const incurredCosts: IncurredCostBreakdown[] = [];

    // Inventory entry — always first
    incurredCosts.push({
      key:          "inventory",
      label:        "Inventory",
      category:     "inventory",
      inputQty:     inventoryQty,
      leftover,
      costPerUnit:  dynamicCost,
      incurredCost: inventoryCost,
    });

    // Group global inputs by category, aggregate cost within each group
    const categoryMap: Record<string, {
      totalCost:   number;
      label:       string;
      stepValues:  number[];
    }> = {};

    globalInputs.forEach((entry) => {
      const stepMultiplier = getGlobalInputQuantity(decision, entry);
      const hasOptions     = entry.options && Object.keys(entry.options).length > 0;

      if (!categoryMap[entry.category]) {
        categoryMap[entry.category] = { totalCost: 0, label: entry.category, stepValues: [] };
      }

      if (hasOptions) {
        // slider — cost scales with selected step multiplier
        categoryMap[entry.category].totalCost  += entry.cost * stepMultiplier;
        categoryMap[entry.category].stepValues.push(stepMultiplier);
      } else {
        // radio/checkbox — binary selection, full cost applies, no multiplier
        categoryMap[entry.category].totalCost  += entry.cost;
        categoryMap[entry.category].stepValues.push(1);
      }
    });

    // Push one entry per category
    Object.entries(categoryMap).forEach(([category, { totalCost, label, stepValues }]) => {
      const avgStepValue = stepValues.length > 0
        ? stepValues.reduce((a, b) => a + b, 0) / stepValues.length
        : 0;

      incurredCosts.push({
        key:          category,
        label:        label,
        category:     category,
        inputQty:     avgStepValue,
        leftover:     0,
        costPerUnit:  totalCost / (stepValues.length || 1),
        incurredCost: totalCost,
      });
    });

    const totalIncurredCost = incurredCosts.reduce((sum, e) => sum + e.incurredCost, 0);

    const revenue     = customersObtained * dynamicPrice;
    const COGS        = (customersObtained * dynamicCost) + totalIncurredCost;
    const grossProfit = revenue - COGS;

    return {
      teamId,
      customersObtained,
      sellingPrice,
      dynamicPrice,
      productScore,
      dynamicCost,
      revenue,
      COGS,
      grossProfit,
      productCostBreakdown,
      incurredCosts,
    };
  });

  console.log(results);

  return { results };
}