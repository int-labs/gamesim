// Core FinLit formulas — pure functions over the config tables, transcribed
// from the sheet. These are the numeric heart of the V3 engine; the live
// simulation (P1) calls them. Kept pure + side-effect-free so they can be
// unit-verified against `FinLit Calc.xlsx` directly.

import { BASERATE, BASE_MARKET_SHARE, UNIT_CONTRIBUTION, PHASE_LENGTH_DAYS } from './constants';
import { configOption, type ProductionSpec } from './production';
import { channelRow, type ChannelId } from './channels';
import { genreById, type GenreId, type GenreDef } from './genres';

/**
 * Units produced per day for a spec.
 *   prodPerDay = Π(option.rate) × BASERATE + hiringProdBonus (+ vendorProdBonus)
 * Verified: G28 config → 3.898125, +3.92 hiring = 7.818125.
 */
export function prodPerDay(spec: ProductionSpec, prodBonus = 0): number {
  const rateProduct =
    configOption('type', spec.type).rate *
    configOption('paper', spec.paper).rate *
    configOption('size', spec.size).rate *
    configOption('pageDesign', spec.pageDesign).rate *
    configOption('addon', spec.addon).rate *
    configOption('cover', spec.cover).rate;
  return rateProduct * BASERATE + prodBonus;
}

/** Per-unit production cost = Σ of the chosen options' costs (verified = 12.3). */
export function unitCost(spec: ProductionSpec): number {
  return (
    configOption('type', spec.type).cost +
    configOption('paper', spec.paper).cost +
    configOption('size', spec.size).cost +
    configOption('pageDesign', spec.pageDesign).cost +
    configOption('addon', spec.addon).cost +
    configOption('cover', spec.cover).cost
  );
}

/**
 * Customers captured over 30 days for one genre × channel.
 *   demand × (channelSellRate + sellBonus) × 30 × marketShare × split
 * `sellBonus` folds in hiring + marketing + vendor sell lifts.
 * `share` defaults to the base 8.125% slice.
 * Verified against I13: demand 17562, sell .04+.08, share .08125, split .35 → 1797.90975.
 */
export function customersPer30d(params: {
  demand: number;
  channelSellRate: number;
  sellBonus?: number;
  split: number;
  share?: number;
}): number {
  const { demand, channelSellRate, sellBonus = 0, split, share = BASE_MARKET_SHARE } = params;
  return demand * (channelSellRate + sellBonus) * PHASE_LENGTH_DAYS * share * split;
}

/** Convenience: customers/30d for a live (genre, channel, demand) tuple. */
export function customersPer30dFor(
  genre: GenreId,
  channel: ChannelId,
  demand: number,
  sellBonus = 0,
  share = BASE_MARKET_SHARE,
): number {
  const row = channelRow(genre, channel);
  return customersPer30d({ demand, channelSellRate: row.sellRate, sellBonus, split: row.split, share });
}

/** Cash earned over 30 days from a customer count (custPerDay × $16 × 30). */
export function earnPer30d(customers30d: number): number {
  return customers30d * UNIT_CONTRIBUTION;
}

/** Genre demand for a game phase (1..3) via the sheet's P1/P2/P3 columns. */
export function genreDemand(genre: GenreId | GenreDef, phaseKey: keyof GenreDef['demand']): number {
  const g = typeof genre === 'string' ? genreById(genre) : genre;
  return g.demand[phaseKey];
}
