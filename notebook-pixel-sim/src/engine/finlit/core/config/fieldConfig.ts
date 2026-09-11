import type { ProductDto } from '@/gamesim/types';
import { GENRES } from './genres';

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
 * Per-genre, per-field backend config. Keyed genreId → fieldKey → FieldConfig.
 * Populated at boot by hydrateFieldConfig — reads lazy, never at module scope.
 */
export const FIELD_CONFIG: Record<string, Record<string, FieldConfig>> = {};

export function hydrateFieldConfig(products: ProductDto[]): void {
  for (const product of products) {
    const nameLower = product.productName.toLowerCase();
    const genre = GENRES.find((g) => nameLower.includes(g.id.toLowerCase()));
    if (!genre) continue;
    FIELD_CONFIG[genre.id] = {};
    for (const field of product.fields) {
      FIELD_CONFIG[genre.id][field.key] = {
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
export const driverAxes = (genre: string): DriverAxis[] =>
  Object.entries(FIELD_CONFIG[genre] ?? {})
    .filter(([key]) => !NON_DRIVER_KEYS.has(key))
    .map(([key, cfg]) => ({ key, label: cfg.label, direction: cfg.direction }))
    .sort((a, b) => (FIELD_CONFIG[genre][a.key].order - FIELD_CONFIG[genre][b.key].order));
