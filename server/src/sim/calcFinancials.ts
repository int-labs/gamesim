import mongoose from "mongoose";

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
  value:             number;
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
  teamId:               mongoose.Types.ObjectId;
  customersObtained:    number;
  dynamicPrice:         number;
  dynamicCost:          number;
  productCostBreakdown: ProductCostBreakdown[];
  revenue:              number;
  COGS:                 number;
  grossProfit:          number;
  incurredCosts:        IncurredCostBreakdown[];
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
  globalInputs:  GlobalInputContainer[];
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
  const fieldEntry    = productInput?.fields.find((f) => f.fieldId.equals(productField._id));
  return resolveFieldValue(fieldEntry?.value ?? null, productField);
};

const getGlobalInputQuantity = (
  decision: DecisionDocument | undefined,
  item:     GlobalInputItem
): number => {
  if (!decision) return 0;
  const entry = decision.globalInputs.find((gi) => gi.globalInputItemId.equals(item._id));
  return clamp(entry?.value ?? 0, item.minPossibleValue, item.maxPossibleValue);
};

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

export function calcFinancials(input: CalcFinancialsInput): CalcFinancialsOutput {
  const { productId, marketShares, productFields, decisions, globalInputs, baseVariables } = input;

  const availableMarket = baseVariables.availableMarket ?? 0;
  
  const results: TeamFinancials[] = marketShares.map(({ teamId, value: marketShare }) => {
    const decision = decisions.find((d) => d.teamId.equals(teamId));
    const customersObtained = marketShare * availableMarket;
    
    // ── Product-level cost breakdown ────────────────────────────────────────
    // Every field with a direction set contributes to price/cost split —
    // money: raw dollar value split by direction
    // number: count split by direction (e.g. stickers * direction → price, * (1-direction) → cost)
    // enum: option multiplier split by direction (e.g. B5=0.12 * direction → price)
    const contributingFields = productFields.filter((f) => f.direction !== undefined && f.direction !== null);

    const productCostBreakdown: ProductCostBreakdown[] = [];
    let dynamicPrice = 0;
    let dynamicCost  = 0;

    contributingFields.forEach((field) => {
      const value             = getDecisionInput(decision, productId, field);
      const priceContribution = value * field.direction;
      const costContribution  = value * (1 - field.direction);

      dynamicPrice += priceContribution;
      dynamicCost  += costContribution;

      productCostBreakdown.push({
        key:   field.key,
        label: field.label,
        value: costContribution,
      });
    });

    // ── GlobalInput-level cost breakdown ────────────────────────────────────
    const incurredCosts: IncurredCostBreakdown[] = [];

    globalInputs.forEach((container) => {
      container.inputs.forEach((item) => {
        const inputQty = getGlobalInputQuantity(decision, item);
        const leftover = inputQty - customersObtained;

        let costPerUnit:  number;
        let incurredCost: number;

        if (container.category === "inventory") {
          costPerUnit  = item.cost;
          incurredCost = leftover * costPerUnit;
        } else {
          const costFactor = calcDiminishingReturnsCostFactor(inputQty, item.minPossibleValue, item.maxPossibleValue);
          costPerUnit  = item.cost * costFactor;
          incurredCost = inputQty * costPerUnit;
        }

        incurredCosts.push({ key: item.key, label: item.label, category: container.category, inputQty, leftover, costPerUnit, incurredCost });
      });
    });

    const totalIncurredCost = incurredCosts.reduce((sum, entry) => sum + entry.incurredCost, 0);

    const revenue     = customersObtained * dynamicPrice;
    const COGS        = (customersObtained * dynamicCost) + totalIncurredCost;
    const grossProfit = revenue - COGS;

    return { teamId, customersObtained, dynamicPrice, dynamicCost, productCostBreakdown, revenue, COGS, grossProfit, incurredCosts };
  });

  return { results };
}