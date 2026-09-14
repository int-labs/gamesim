import type { ProductDto } from '@/gamesim/types';
import {
  CONFIG_TABLES,
  optionScore,
  priceAnchorSpec,
  type ConfigAxis,
  type ProductionSpec,
} from './production';

export interface FieldConfig {
  direction:  number;
  minValue:   number;
  maxValue:   number;
  tightening: number;
  /** Dollars per score point, from the operator's ProductField.
   *  0 = the field contributes no cost (same reading the server takes). */
  unitCost:   number;
  /** The operator's own `ProductField.label` and `order`. Carried so a surface
   *  can LIST the fields a product actually has instead of a hardcoded set —
   *  see `driverAxes`. */
  label:      string;
  order:      number;
}

/**
 * Per-product, per-field backend config. Keyed `Product._id` → fieldKey →
 * FieldConfig. Populated at boot by hydrateFieldConfig — reads lazy, never at
 * module scope.
 */
export const FIELD_CONFIG: Record<string, Record<string, FieldConfig>> = {};

/**
 * Fill the table from the wire, keyed by the Product's own `_id`.
 *
 * This used to bind each product to a bundled genre slug by substring —
 * `productName.toLowerCase().includes(genreId)` — which worked only by luck of
 * naming (`"cutesy notebook".includes("cute")`), bound to whichever genre came
 * first when a name matched two, and silently DROPPED any product that matched
 * none. The Product's id is the operator's own key; nothing needs guessing.
 */
export function hydrateFieldConfig(products: ProductDto[]): void {
  for (const key of Object.keys(FIELD_CONFIG)) delete FIELD_CONFIG[key];
  for (const product of products) {
    if (product.active === false) continue;
    const productId = String(product._id);
    FIELD_CONFIG[productId] = {};
    for (const field of product.fields) {
      FIELD_CONFIG[productId][field.key] = {
        direction:  field.direction  ?? 0,
        minValue:   field.minValue   ?? 0,
        maxValue:   field.maxValue   ?? 100,
        tightening: field.tightening ?? 3,
        unitCost:   field.unitCost   ?? 0,
        label:      field.label || field.key,
        order:      field.order ?? 0,
      };
    }
  }
}

export const fieldCfg = (genre: string, key: string): FieldConfig =>
  FIELD_CONFIG[genre]?.[key]
  ?? { direction: 0, minValue: 0, maxValue: 100, tightening: 3, unitCost: 0, label: key, order: 0 };

/**
 * Fields that are NOT customer drivers, excluded by key rather than by any
 * property of the data.
 *
 * `selling_price` carries direction 0, so a `direction > 0` filter would drop it
 * anyway — but `projected_market_share` carries 0.5 and would be INCLUDED by
 * such a filter. It is the team's own share claim, not something a buyer weighs,
 * so no numeric rule separates these two from the design axes. The operator
 * adding a seventh design field needs no change here; adding another
 * non-driver field does.
 */
const NON_DRIVER_KEYS = new Set(['selling_price', 'projected_market_share']);

export interface DriverAxis {
  key:       string;
  label:     string;
  direction: number;
}

/**
 * The customer-driver axes for one genre, IN THE OPERATOR'S OWN `order`, derived
 * from the product's real fields.
 *
 * This replaced a hardcoded six-entry list. That list could not show a field the
 * operator added, kept showing one they deleted (as an empty bar, which reads as
 * "buyers don't care" rather than "this does not exist"), and — worst — was the
 * DENOMINATOR for every share on the card, so a seventh field's weight was
 * silently excluded and all six shares were computed against an incomplete
 * total while still summing to 100%.
 */
/**
 * The FLOOR a notebook costs per unit the moment it is created, before a single
 * design choice: `Σ over every cost field of minValue × unitCost`.
 *
 * This is where the notebook TYPE is charged. `page_design` carries
 * `minValue: 15` — the same 15 as `TYPE_OPTIONS.score` — and it is the only
 * field with a non-zero floor, so the type's cost and this baseline are one
 * number, not two. The type has no server field of its own and needs none.
 *
 * DELIBERATELY NOT the cost of the starting spec. Quoting that would not
 * reconcile with the design drawer, which shows each option as a DELTA on top
 * of this floor — a player adding the drawer's figures up would never reach it,
 * and a total that cannot be re-derived from the screens that feed it reads as
 * a lie rather than a summary.
 *
 * Iterates the HYDRATED fields rather than the frontend's axes, so a cost field
 * the operator added that no axis maps to (`charms`, `ribbons`, `functional`)
 * still contributes its floor instead of being silently priced at zero.
 */
export const typeBaseCost = (genre: string): number =>
  Object.values(FIELD_CONFIG[genre] ?? {}).reduce(
    (sum, cfg) => (cfg.unitCost ? sum + cfg.minValue * cfg.unitCost : sum),
    0,
  );

/**
 * What one unit of a given spec costs to build, mirroring `calcFinancials`:
 *
 *     Σ over every cost field of (minValue + submitted) × unitCost
 *
 * The `minValue` term is NOT optional — the server charges it as a baseline on
 * every field (`effectiveValue = (field.minValue ?? 0) + raw`), so pricing only
 * `score × unitCost` quotes low on every notebook.
 *
 * Used for the PRICE ANCHOR: the cost of `PRICE_ANCHOR`, the reference build.
 * It is a cost, not a suggested price — what the notebook must clear before it
 * earns anything, which is the number a player needs to price against.
 */
export const specUnitCost = (genre: string, spec: ProductionSpec): number => {
  // Spec axes collapsed onto the server field each one submits to.
  const submitted: Record<string, number> = {};
  for (const axis of Object.keys(CONFIG_TABLES) as ConfigAxis[]) {
    const fieldKey = CONFIG_TABLES[axis].fieldKey;
    if (!fieldKey) continue;
    submitted[fieldKey] = (submitted[fieldKey] ?? 0) + optionScore(axis, spec[axis]);
  }

  return Object.entries(FIELD_CONFIG[genre] ?? {}).reduce((sum, [fieldKey, cfg]) => {
    if (!cfg.unitCost) return sum;
    return sum + (cfg.minValue + (submitted[fieldKey] ?? 0)) * cfg.unitCost;
  }, 0);
};

/** The price anchor for a market: what the reference build of it costs. */
export const priceAnchorCost = (genre: string): number =>
  specUnitCost(genre, priceAnchorSpec(genre));

/**
 * How PICKY a market is about price, from the WIDTH of its `selling_price`
 * band — not from `direction`, which is 0 on every product.
 *
 * The server's price score is a two-sided curve around `dynamicPrice`, and both
 * halves take `stdDev = range / 4` (`calcBellCurveScore` under, and
 * `calcReverseDiminishingReturns` over). A narrower band is a smaller stdDev, so
 * the score falls away faster for the same dollar off the ideal price. Narrow
 * band = picky buyers, and nothing else has to be asserted for that to be true.
 *
 * Thresholds sit at the MIDPOINTS of the operator's anchors (30 / 17 / 10) on
 * the 1-30 scale the price slider offers.
 *
 * A LABEL only, no figure. Whether a market tolerates a price move is the
 * decision; a derived "±$X" would invite arithmetic against a curve the player
 * cannot see, since it pivots on a server-computed `dynamicPrice`.
 */
export interface PriceSensitivity {
  /** `maxValue − minValue` on the market's `selling_price` field. */
  delta: number;
  label: 'Tolerant' | 'Moderate' | 'Very picky';
}

export const priceSensitivity = (genre: string): PriceSensitivity => {
  const cfg = fieldCfg(genre, 'selling_price');
  const delta = Math.max(0, cfg.maxValue - cfg.minValue);
  return {
    delta,
    label: delta >= 23.5 ? 'Tolerant' : delta >= 13.5 ? 'Moderate' : 'Very picky',
  };
};

export const driverAxes = (genre: string): DriverAxis[] =>
  Object.entries(FIELD_CONFIG[genre] ?? {})
    .filter(([key]) => !NON_DRIVER_KEYS.has(key))
    .map(([key, cfg]) => ({ key, label: cfg.label, direction: cfg.direction }))
    .sort((a, b) => (FIELD_CONFIG[genre][a.key].order - FIELD_CONFIG[genre][b.key].order));
