export const SELLING_PRICE_KEY          = "selling_price";
export const PROJECTED_MARKET_SHARE_KEY = "projected_market_share";

export type ImpactTarget =
  | "inventory"
  | "sales_channel"
  | "marketing"
  | "dynamic_cost"

export interface ImpactConfig {
  target:  ImpactTarget;
  affects: "inventoryRate" | "customersObtained" | "dynamicPrice" | "dynamicCost" | "consignment";
  /** DECLARATIVE ONLY — nothing reads it. Every branch in calcFinancials
   *  dispatches on the DOCUMENT's own `impact.type`, so this cannot constrain
   *  how an operator authors the impact. */
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
  dynamic_cost: {
    target:  "dynamic_cost",
    affects: "dynamicCost",
    via:     "relative",
  },
  // NO `inventory_cost`. It charged a per-unit carrying cost on unsold stock,
  // which models nothing here: there is no warehouse, and COGS already lands on
  // the BUILD, so overproduction is paid for in the round that produced it.
  // Removed 2026-09-17; no channel in the live config authored one.

  /** A channel's cut, as a RATE on the selling price — retail 0.2 is 20% of
   *  every sale through retail, NOT $0.20. Charged on units SOLD, not units
   *  built, and weighted by that channel's share of demand; see
   *  `consignmentPerUnit` in calcFinancials. Books to OpEx: a cost of selling,
   *  not of making. */
  consignment: {
    target:  "sales_channel",
    affects: "consignment",
    via:     "relative",
  },
};