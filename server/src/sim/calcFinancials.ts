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
  direction:    number;   // 1 = higher is better, -1 = lower is better
  tightening:   number;
  coefficients: Record<string, number>;
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

export interface TeamFinancials {
  teamId:            mongoose.Types.ObjectId;
  customersObtained: number;
  dynamicPrice:      number;
  dynamicCost:       number;
  revenue:           number;
  COGS:              number;
  grossProfit:       number;
}

export interface CalcFinancialsInput {
  productId:            mongoose.Types.ObjectId;
  marketShares:         TeamShare[];
  productFields:        ProductField[];
  decisions:            DecisionDocument[];
  inventoryGlobalInput: GlobalInputContainer | null;
  baseVariables:        BaseVariables;
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

// Decision fields are keyed by fieldId (ProductField._id), not by string key.
const getDecisionInput = (
  decision:     DecisionDocument | undefined,
  productId:    mongoose.Types.ObjectId,
  productField: ProductField
): number => {
  if (!decision) return 0;
  const productInput = decision.inputs.find((inp) => inp.productId.equals(productId));
  const fieldEntry    = productInput?.fields.find((f) => f.fieldId.equals(productField._id));
  const raw           = Number(fieldEntry?.value ?? 0);
  return clamp(raw, productField.minValue, productField.maxValue);
};

const getInventoryQuantity = (
  decision:      DecisionDocument | undefined,
  inventoryItem: GlobalInputItem
): number => {
  if (!decision) return 0;
  const entry = decision.globalInputs.find((gi) => gi.globalInputItemId.equals(inventoryItem._id));
  return clamp(entry?.value ?? 0, inventoryItem.minPossibleValue, inventoryItem.maxPossibleValue);
};

// ─── Core Calculation ────────────────────────────────────────────────────────

export function calcFinancials(input: CalcFinancialsInput): CalcFinancialsOutput {
  const { productId, marketShares, productFields, decisions, inventoryGlobalInput, baseVariables } = input;

  // Static config (cost per unit) comes from the GlobalInput container;
  // the team's chosen quantity for this round comes from their own Decision.
  const inventoryItem = inventoryGlobalInput?.inputs.find((i) => i.key === "inventory") ?? null;
  const costPerUnit    = inventoryItem?.cost ?? 0;

  const availableMarket = baseVariables.availableMarket ?? 0;

  const priceFields = productFields.filter((f) => f.type === "money" && f.direction === 1);
  const costFields  = productFields.filter((f) => f.type === "money" && f.direction === -1);

  const results: TeamFinancials[] = marketShares.map(({ teamId, value: marketShare }) => {
    const decision = decisions.find((d) => d.teamId.equals(teamId));

    const customersObtained = marketShare * availableMarket;

    const dynamicPrice = priceFields.reduce(
      (sum, field) => sum + getDecisionInput(decision, productId, field),
      0
    );
    const dynamicCost = costFields.reduce(
      (sum, field) => sum + getDecisionInput(decision, productId, field),
      0
    );

    const inventoryQty  = inventoryItem ? getInventoryQuantity(decision, inventoryItem) : 0;
    const leftover       = inventoryQty - customersObtained;
    const incurredCost   = leftover * costPerUnit;

    const revenue     = customersObtained * dynamicPrice;
    const COGS        = (customersObtained * dynamicCost) + incurredCost;
    const grossProfit = revenue - COGS;

    return { teamId, customersObtained, dynamicPrice, dynamicCost, revenue, COGS, grossProfit };
  });

  return { results };
}