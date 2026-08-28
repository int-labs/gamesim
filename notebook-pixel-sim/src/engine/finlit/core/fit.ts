// VoC fit — how well a line's config + price + stickers align to a genre's
// field direction weights (backend-driven). Returns a demand MULTIPLIER around
// 1.0 — a well-targeted product sells more, a mismatched one sells less.
//
// All weights come from FIELD_CONFIG[genre][key].direction, hydrated at boot
// from the operator's productFields. No hardcoded per-genre preferences.

import {
  configOption, type GenreId, type ProductionSpec,
} from './config';
import { fieldCfg } from './config/fieldConfig';
import { normalCDF, directionOffset, bellCurveScore, diminishingReturnsFactor } from './mathUtils';

const MONEY_FIELDS = [
  'stickers', 'addons', 'page_size', 'paper_material', 'page_design', 'cover_page',
] as const;
type MoneyFieldKey = typeof MONEY_FIELDS[number];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function fieldScore(value: number, genre: string, key: string): number {
  const { direction, minValue, maxValue, tightening } = fieldCfg(genre, key);
  const avg    = (minValue + maxValue) / 2;
  const stdDev = (maxValue - minValue) / (4 * tightening);
  return directionOffset(direction) + normalCDF(value, avg, stdDev) * direction;
}

function specValues(spec: ProductionSpec, stickersSpend: number): Record<MoneyFieldKey, number> {
  return {
    stickers:       stickersSpend,
    addons:         configOption('addon',      spec.addon).cost,
    page_size:      configOption('size',       spec.size).cost,
    paper_material: configOption('paper',      spec.paper).cost,
    page_design:    configOption('pageDesign', spec.pageDesign).cost,
    cover_page:     configOption('cover',      spec.cover).cost,
  };
}

function localDynamicPrice(vals: Record<MoneyFieldKey, number>, genre: string): number {
  return MONEY_FIELDS.reduce((sum, key) => {
    const { direction, minValue, maxValue } = fieldCfg(genre, key);
    if (direction <= 0) return sum;
    const v = vals[key];
    return sum + v * diminishingReturnsFactor(v, minValue, maxValue) * direction;
  }, 0);
}

/** Attribute scores in [0,1] for each decision axis, derived from field config. */
export function attributeScores(
  spec: ProductionSpec,
  price: number,
  stickersSpend: number,
  genre: GenreId,
) {
  const vals     = specValues(spec, stickersSpend);
  const dynPrice = localDynamicPrice(vals, genre);
  const { minValue: priceMin, maxValue: priceMax } = fieldCfg(genre, 'selling_price');

  const scores: Record<string, number> = { price: clamp01(bellCurveScore(price, priceMin, priceMax, dynPrice)) };
  for (const key of MONEY_FIELDS) {
    scores[key] = clamp01(fieldScore(vals[key], genre, key));
  }
  return scores;
}

/**
 * Demand multiplier for a line. Weighted by each field's backend direction value
 * (genre-specific — each product has its own direction per field). Maps to [0.6, 1.2].
 */
export function vocFit(
  spec: ProductionSpec,
  price: number,
  stickersSpend: number,
  genre: GenreId,
): number {
  const s    = attributeScores(spec, price, stickersSpend, genre);
  const wSum = MONEY_FIELDS.reduce((sum, k) => sum + fieldCfg(genre, k).direction, 0);
  if (wSum === 0) return 1;
  const aligned = MONEY_FIELDS.reduce(
    (sum, k) => sum + fieldCfg(genre, k).direction * s[k],
    0,
  ) / wSum;
  return 0.6 + 0.6 * clamp01(aligned);
}
