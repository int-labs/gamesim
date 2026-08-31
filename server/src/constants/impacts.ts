export const SELLING_PRICE_KEY          = "selling_price";
export const PROJECTED_MARKET_SHARE_KEY = "projected_market_share";

export type ImpactTarget =
  | "inventory"
  | "sales_channel"
  | "marketing"
  | "pnl"
  | "dynamic_cost"

export interface ImpactConfig {
  target:  ImpactTarget;
  affects: "inventoryRate" | "customersObtained" | "dynamicPrice" | "dynamicCost" | "inventoryCost" | "pnl";
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
  difficulty: {
    target:  "pnl",
    affects: "pnl",
    via:     "absolute",
  },
  dynamic_cost: {
    target:  "dynamic_cost",
    affects: "dynamicCost",
    via:     "relative",
  },
  /** Per-unit carrying cost on inventory that did NOT sell. Configured by the
   *  operator on the channel globalInput (`channels → impacts → inventory_cost`)
   *  and already consumed by both finlit engines; this entry is what lets
   *  calcFinancials — the authoritative money path — see it at all. */
  inventory_cost: {
    target:  "inventory",
    affects: "inventoryCost",
    via:     "absolute",
  },
};