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
      };
    }
  }
}

export const fieldCfg = (genre: string, key: string): FieldConfig =>
  FIELD_CONFIG[genre]?.[key]
  ?? { direction: 0, minValue: 0, maxValue: 100, tightening: 3, unitCost: 0 };
