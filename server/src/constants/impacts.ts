export const SELLING_PRICE_KEY          = "selling_price";
export const PROJECTED_MARKET_SHARE_KEY = "projected_market_share";

export type ImpactTarget =
  | "inventory"
  | "sales_channel"
  | "marketing"
  | "dynamic_cost"

export interface ImpactConfig {
  target:  ImpactTarget;
  affects: "inventoryRate" | "customersObtained" | "dynamicPrice" | "dynamicCost" | "inventoryCost" | "consignment";
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
  /** Per-unit carrying cost on inventory that did NOT sell. Charged on closing
   *  stock. Dispatch is on THIS MAP KEY, on any item in any container — nothing
   *  ties it to channels, and a storefront holding your stock cost models
   *  nothing real. */
  inventory_cost: {
    target:  "inventory",
    affects: "inventoryCost",
    via:     "absolute",
  },

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