// Line lookup, add-ons, and the one price helper that survives.
//
// This file used to be the local cost engine — unit cost, raw-purchase price,
// unit time, daily opex, portfolio average cost. All of it is gone: the SERVER
// owns every monetary figure (`calcFinancials`), and the UI reads
// `ProductProjectionDto.dynamicCost` through `useLiveProjection`. The local
// versions had no rendered consumer left; their last two were `PricingPanel`
// and `ProductConfigPanel`, neither of which anything mounted.
//
// What remains is not cost at all — it is line resolution plus one modifier
// application. The filename is now a lie and is worth changing, but a rename
// touches every importer, so it is left as a separate decision.

import type { GameState } from '@/state/store';
import type { ProductLine } from '@/types';
import { aggregateActive } from './modifiers';
import { finite, nonNeg } from './validation';

// ---- Line lookup ----------------------------------------------------

export const getLineOrThrow = (s: GameState, lineId: string): ProductLine => {
  const line = s.portfolio.productLines.find((l) => l.id === lineId);
  if (!line) {
    throw new Error(`ProductLine not found: ${lineId}`);
  }
  return line;
};

export const getActiveLine = (s: GameState): ProductLine =>
  getLineOrThrow(s, s.portfolio.activeLineId);

/** Add-ons currently active on a line (only the line's CURRENT archetype). */
export const currentAddOnsForLine = (line: ProductLine) =>
  line.addOnsByArchetype[line.archetype] ?? [];

/** Backwards-compat: active line's add-ons. */
export const currentAddOns = (s: GameState) => currentAddOnsForLine(getActiveLine(s));

/** Sticker price after the global event priceMult, for a specific line. */
export const calcEffectivePriceForLine = (s: GameState, line: ProductLine): number => {
  const mods = aggregateActive(s.activeModifiers);
  return nonNeg(line.price * finite(mods.priceMult, 1));
};
