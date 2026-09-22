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
 * How PICKY a market is about price — the VoC weight for `selling_price`, which
 * cannot come from `direction` because that is 0 on every product.
 *
 *     weight = min / (min + max)
 *
 * How high the floor sits relative to the whole scale: a market that will not
 * accept a cheap notebook is one where price is tightly constrained. Bounded
 * [0, 0.5) for any `min < max`, which is what lets it share the VoC axis with
 * the authored `direction` weights (live 0.03..0.15) instead of towering over
 * them.
 *
 * ONE DEFINITION, TWO READERS — the market tab's label and the debrief's VoC
 * tick. They were separate, and a notebook could read "Tolerant" on one and
 * carry a high price weight on the other.
 *
 * NOT a band WIDTH. This replaced `maxValue − minValue`, which measured
 * something else: equal widths at different heights (5/25 vs 40/60) score 0.167
 * against 0.400 here. Old thresholds of 23.5/13.5 were dollars and do not
 * convert.
 */
export interface PriceSensitivity {
  /** `min / (min + max)` on the market's `selling_price` field, [0, 0.5). */
  weight: number;
  label: 'Tolerant' | 'Moderate' | 'Very picky';
}

/** Equal thirds of the [0, 0.5) the formula can reach. Owner-confirmed. */
const PICKY_BANDS = { tolerant: 0.167, moderate: 0.333 } as const;

/**
 * THE formula, from bounds alone.
 *
 * Two entry points, one implementation: `priceSensitivity(genre)` resolves the
 * bounds from the hydrated `FIELD_CONFIG`, while the round debrief already has
 * them on the wire (`GET /round-debrief` ships raw `minValue`/`maxValue` rather
 * than normalising, precisely so this stays the only definition).
 */
export const priceSensitivityFromBounds = (
  minValue: number | null | undefined,
  maxValue: number | null | undefined,
): PriceSensitivity => {
  const lo = Number(minValue) || 0;
  const hi = Number(maxValue) || 0;
  const span = lo + hi;
  // Both bounds at 0 is an unauthored field, not a tolerant market — 0 keeps it
  // off the VoC axis rather than ranking it as the most price-tolerant one.
  const weight = span > 0 ? Math.max(0, lo) / span : 0;
  return {
    // INVERTED against the old delta version: a HIGH weight is picky, where a
    // wide band used to be tolerant.
    weight,
    label:
      weight < PICKY_BANDS.tolerant ? 'Tolerant'
      : weight < PICKY_BANDS.moderate ? 'Moderate'
      : 'Very picky',
  };
};

/** By GENRE ID — not a product name. `fieldCfg` misses on a product name and
 *  returns defaults silently, which type-checks and is wrong. */
export const priceSensitivity = (genre: string): PriceSensitivity => {
  const cfg = fieldCfg(genre, 'selling_price');
  return priceSensitivityFromBounds(cfg.minValue, cfg.maxValue);
};

export const driverAxes = (genre: string): DriverAxis[] =>
  Object.entries(FIELD_CONFIG[genre] ?? {})
    .filter(([key]) => !NON_DRIVER_KEYS.has(key))
    .map(([key, cfg]) => ({ key, label: cfg.label, direction: cfg.direction }))
    .sort((a, b) => (FIELD_CONFIG[genre][a.key].order - FIELD_CONFIG[genre][b.key].order));
