export type ImpactTarget =
  | "inventory"
  | "sales_channel"
  | "marketing"

export interface ImpactConfig {
  target:  ImpactTarget;
  affects: "inventoryRate" | "customersObtained" | "dynamicPrice" | "dynamicCost";
  via:     "relative" | "absolute";
}

export const IMPACT_CONFIG: Record<string, ImpactConfig> = {
  inventory: {
    target:  "inventory",
    affects: "inventoryRate",
    via:     "relative",
  },
  sales_channel: {
    target:  "sales_channel",
    affects: "customersObtained",
    via:     "relative",
  },
  marketing: {
    target:  "marketing",
    affects: "customersObtained",
    via:     "relative",
  },
};