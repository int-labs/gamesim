// GLUE: notebook game state → gamesim `Decision.inputs[].fields[]` and `globalInputs[]`.
//
// Translation seam between local game state and the server's Decision schema.
// Each spec axis is submitted as its own ProductField value; channel selections
// are submitted as GlobalInput snapshots. No client-side scoring or cost
// aggregation — calcMarketModel and calcFinancials handle that from the
// individual field values and operator-configured coefficients.

import type { GameState } from '@/state/store';
import {
  CONFIG_TABLES,
  optionScore,
  type ConfigAxis,
} from '@/engine/finlit/core/config/production';
import type {
  DecisionFieldEntry,
  DecisionGlobalInputDto,
  DecisionProductInput,
  GlobalInputDto,
  GlobalInputItemDto,
  ProductDto,
  ProductFieldDto,
} from './types';

/**
 * Field keys this glue submits. The SPEC half is DERIVED from `CONFIG_TABLES`
 * so the axis/field mapping exists in ONE place. The three below are not spec
 * axes (a price, a canvas-derived spend, a share claim), so they stay by hand.
 */
const SPEC_FIELD_KEYS = Object.fromEntries(
  (Object.entries(CONFIG_TABLES) as [ConfigAxis, { fieldKey: string | null }][])
    .filter((entry): entry is [ConfigAxis, { fieldKey: string }] => entry[1].fieldKey !== null)
    .map(([axis, table]) => [axis, table.fieldKey]),
) as Record<Exclude<ConfigAxis, 'type'>, string>;

export const FIELD_KEYS = {
  sellingPrice:         'selling_price',
  stickers:             'stickers',
  projectedMarketShare: 'projected_market_share',
  ...SPEC_FIELD_KEYS,
} as const;

type StoreLine = GameState['portfolio']['productLines'][number];

const findField = (product: ProductDto, key: string): ProductFieldDto | undefined =>
  product.fields.find((f) => f.key === key);

/** The values derived from one product line for server submission. */
export type LineDecisionValues = Record<keyof typeof FIELD_KEYS, number>;

export function lineDecisionValues(line: StoreLine, projectedMarketShare: number): LineDecisionValues {
  const spec      = line.finlitSpec ?? {};
  const instances = line.addOnsByArchetype?.[line.archetype] ?? [];
  const stickersSpend = Math.min(instances.length * 0.15, 100);

  // SCORES (0-100), not dollars — the server multiplies by the field's own
  // `unitCost`. See ../../../server/README.md#score
  const specValues = {} as Record<Exclude<ConfigAxis, 'type'>, number>;
  for (const axis of Object.keys(SPEC_FIELD_KEYS) as Exclude<ConfigAxis, 'type'>[]) {
    specValues[axis] = optionScore(axis, spec[axis]);
  }

  return {
    sellingPrice:         round2(line.price),
    stickers:             stickersSpend,
    projectedMarketShare: clamp01(round4(projectedMarketShare)),
    ...specValues,
  };
}

/** Field entries for one product — FIELD_KEYS drives the loop. */
export function toDecisionFields(product: ProductDto, values: LineDecisionValues): DecisionFieldEntry[] {
  return (Object.entries(FIELD_KEYS) as [keyof LineDecisionValues, string][])
    .flatMap(([valueKey, fieldKey]) => {
      const field = findField(product, fieldKey);
      if (!field) return [];
      return [{ fieldId: field._id, value: values[valueKey] }];
    });
}

/**
 * Pairs local product lines with the operator-configured Products.
 *
 * The player invents lines locally; Products exist server-side. There is no id
 * in common, so pairing is by name (case-insensitive, punctuation-insensitive)
 * and then positionally for whatever is left, in the order both sides list
 * them. Lines with no Product left to pair with are DROPPED from the
 * submission — the server has nowhere to put them.
 */
export function pairLinesWithProducts(
  lines: StoreLine[],
  products: ProductDto[],
): Array<{ line: StoreLine; product: ProductDto }> {
  const remaining = [...products];
  const pairs: Array<{ line: StoreLine; product: ProductDto }> = [];
  const unmatched: StoreLine[] = [];

  for (const line of lines) {
    const idx = remaining.findIndex((p) => normalize(p.productName) === normalize(line.name));
    if (idx >= 0) pairs.push({ line, product: remaining.splice(idx, 1)[0] });
    else unmatched.push(line);
  }
  for (const line of unmatched) {
    const product = remaining.shift();
    if (product) pairs.push({ line, product });
  }
  return pairs;
}

/**
 * The neutral projected-market-share claim for a product: the midpoint of the
 * field's configured range, where the server's diminishing-returns factor is
 * exactly 1.0. Falls back to 0.2 when the product has no range configured.
 */
export function defaultProjectedShareFor(product: ProductDto): number {
  const field = findField(product, FIELD_KEYS.projectedMarketShare);
  const min = field?.minValue ?? null;
  const max = field?.maxValue ?? null;
  if (min === null || max === null || max <= min) return 0.2;
  return (min + max) / 2;
}

/** Both halves of a Decision submission. */
export interface DecisionPayload {
  inputs:       DecisionProductInput[];
  globalInputs: DecisionGlobalInputDto[];
}

export interface ToDecisionInputsArgs {
  state:                        GameState;
  products:                     ProductDto[];
  availableGlobalInputs:        GlobalInputDto[];
  projectedShareByLine?:        Record<string, number>;
  defaultProjectedMarketShare?: number;
}

/**
 * The full Decision submission payload. `inputs[]` maps each paired product
 * line to its field entries; `globalInputs[]` snapshots selected channel items
 * from the operator's GlobalInput configuration.
 */
export function toDecisionInputs({
  state,
  products,
  availableGlobalInputs,
  projectedShareByLine = {},
  defaultProjectedMarketShare,
}: ToDecisionInputsArgs): DecisionPayload {
  const activeProducts = products.filter((p) => p.active !== false);
  const pairs = pairLinesWithProducts(state.portfolio.productLines, activeProducts);

  const inputs: DecisionProductInput[] = pairs.map(({ line, product }) => {
    const share = projectedShareByLine[line.id] ?? defaultProjectedMarketShare ?? defaultProjectedShareFor(product);
    return {
      productId:   product._id,
      segmentId:   product.segmentId,
      productName: product.productName,
      // null when the player never set one — the server then applies half the
      // ceiling, which is exactly what the planner shows for an untouched line.
      produced:    line.targetPerPhase ?? null,
      fields:      toDecisionFields(product, lineDecisionValues(line, share)),
    };
  });

  // ── Selections → globalInput snapshots, resolved BY BACKEND ID ───────────
  //
  // This used to build `new Map(selections.map(sel => [sel.key, ...]))` and then
  // match each backend item's `key` against it. Two defects, both silent:
  //
  //   1. `Map` dedupes by key, and `globalInputSelections` is a FLAT array in
  //      which several entries legitimately share one key — that is what
  //      `maxSelections` exists for. Two hires, two vendors or three channels
  //      collapsed to whichever was written last; the rest never left the
  //      browser. The emit loop compounded it by pushing at most one entry per
  //      item, so the payload could not represent more than one either.
  //
  //   2. The join was a frontend-authored string. The backend's `_id` is the
  //      only identifier both sides agree on, and the server looks entries up
  //      by `globalInputItemId` — so id is what the payload must be built from.
  //
  // Every field below is copied from the backend item. Nothing frontend-side
  // enters the snapshot except WHICH item was selected and which of that item's
  // own option keys was chosen.
  const itemsById = new Map<string, { item: GlobalInputItemDto; category: string }>();
  for (const container of availableGlobalInputs) {
    for (const item of container.inputs) {
      itemsById.set(String(item._id), { item, category: container.category });
    }
  }

  const globalInputs: DecisionGlobalInputDto[] = [];
  for (const sel of state.globalInputSelections ?? []) {
    const found = sel.inputId ? itemsById.get(String(sel.inputId)) : undefined;
    if (!found) {
      // Not sendable: the server resolves the entry by `globalInputItemId`, so
      // an unresolvable selection would be scored as unselected (quantity 0),
      // and `calcFinancials` skips EVERY impact on a zero-quantity entry. Left
      // out loudly rather than submitted as a snapshot the server will discard.
      console.warn(
        '[gamesim] a global input selection carries no backend inputId and was not submitted',
        sel,
      );
      continue;
    }
    const { item, category } = found;
    globalInputs.push({
      globalInputItemId: item._id,
      category,
      key:               item.key,
      label:             item.label,
      description:       item.description ?? null,
      selectedStepKey:   sel.selectedStepKey,
      cost:              item.cost,
      energy:            item.energy,
      productsImpacted:  item.productsImpacted,
      impacts:           item.impacts,
      impactLevel:       item.impactLevel ?? null,
      options:           item.options,
    });
  }

  return { inputs, globalInputs };
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const clamp01   = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const round2    = (v: number) => Math.round(v * 100) / 100;
const round4    = (v: number) => Math.round(v * 10000) / 10000;
