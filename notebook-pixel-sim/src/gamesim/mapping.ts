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
  type ProductionSpec,
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
 * so the axis/field mapping exists in ONE place. The two below are not spec
 * axes (a price and a share claim), so they stay by hand.
 *
 * `stickers` USED TO BE hand-written here, submitting
 * `min(instances.length * 0.15, 100)` from the canvas. That 0.15 was the
 * server's own `unitCost` for the field (verified live), so the multiplier was
 * applied twice — the submission is a SCORE and the server converts it. It is a
 * normal `CONFIG_TABLES` axis now, like `charms`, `ribbons` and `functional`.
 */
const SPEC_FIELD_KEYS = Object.fromEntries(
  (Object.entries(CONFIG_TABLES) as [ConfigAxis, { fieldKey: string | null }][])
    .filter((entry): entry is [ConfigAxis, { fieldKey: string }] => entry[1].fieldKey !== null)
    .map(([axis, table]) => [axis, table.fieldKey]),
) as Record<Exclude<ConfigAxis, 'type'>, string>;

export const FIELD_KEYS = {
  sellingPrice:         'selling_price',
  projectedMarketShare: 'projected_market_share',
  ...SPEC_FIELD_KEYS,
} as const;

type StoreLine = GameState['portfolio']['productLines'][number];

const findField = (product: ProductDto, key: string): ProductFieldDto | undefined =>
  product.fields.find((f) => f.key === key);

/** The values derived from one product line for server submission. */
export type LineDecisionValues = Record<keyof typeof FIELD_KEYS, number>;

export function lineDecisionValues(line: StoreLine, projectedMarketShare: number): LineDecisionValues {
  const spec = line.finlitSpec ?? {};

  // SCORES (0-100), not dollars — the server multiplies by the field's own
  // `unitCost`. See ../../../server/README.md#score
  //
  // Every axis goes through this ONE loop, including the four canvas axes. An
  // axis the notebook has not chosen scores 0, which is why they are optional
  // on `ProductionSpec` rather than defaulted.
  const specValues = {} as Record<Exclude<ConfigAxis, 'type'>, number>;
  for (const axis of Object.keys(SPEC_FIELD_KEYS) as Exclude<ConfigAxis, 'type'>[]) {
    specValues[axis] = optionScore(axis, spec[axis]);
  }

  return {
    sellingPrice:         round2(line.price),
    projectedMarketShare: clamp01(round4(projectedMarketShare)),
    ...specValues,
  };
}

/**
 * Field entries for one product — FIELD_KEYS drives the loop.
 *
 * `name` rides along for the SPEC AXES only: it is the chosen option's display
 * name, which is what the reports print instead of the score. A price or a
 * share claim has no option table and carries none — the reports format those
 * from `value`.
 */
export function toDecisionFields(
  product: ProductDto,
  values: LineDecisionValues,
  spec: Partial<ProductionSpec> = {},
): DecisionFieldEntry[] {
  return (Object.entries(FIELD_KEYS) as [keyof LineDecisionValues, string][])
    .flatMap(([valueKey, fieldKey]) => {
      const field = findField(product, fieldKey);
      if (!field) return [];
      // `valueKey` is the AXIS name for every spec field, which is exactly the
      // key `CONFIG_TABLES` and the spec are both keyed by.
      const axis = valueKey as ConfigAxis;
      const chosen = axis in CONFIG_TABLES ? spec[axis] : undefined;
      const name = chosen ? CONFIG_TABLES[axis].options.find((o) => o.id === chosen)?.name : undefined;
      return [{ fieldId: field._id, value: values[valueKey], ...(name ? { name } : {}) }];
    });
}

// `pairLinesWithProducts` was DELETED on 2026-09-14. Its premise — "there is no
// id in common" — stopped being true when `ProductLine.productId` became the
// line's identity. It paired on the player's renameable `line.name` and then
// positionally, so a rename silently re-pointed a notebook's whole submission
// at a different Product. `toDecisionInputs` resolves by id now.

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
  const byId = new Map(activeProducts.map((p) => [String(p._id), p]));

  // Resolved BY ID. This used to call `pairLinesWithProducts`, which matched the
  // player's COSMETIC, renameable `line.name` against `productName` and then
  // filled the remainder positionally — so renaming a notebook re-paired it
  // against a different Product, on the submission path. A line whose product
  // is gone is dropped rather than silently paired with whatever is left over.
  const inputs: DecisionProductInput[] = [];
  for (const line of state.portfolio.productLines) {
    const product = byId.get(String(line.productId));
    if (!product) {
      console.warn(
        '[gamesim] a product line references a product that is not active and was not submitted',
        { lineId: line.id, productId: line.productId },
      );
      continue;
    }
    const share = projectedShareByLine[line.id] ?? defaultProjectedMarketShare ?? defaultProjectedShareFor(product);
    inputs.push({
      productId:   product._id,
      segmentId:   product.segmentId,
      productName: product.productName,
      // null when the player never set one — the server then applies half the
      // ceiling, which is exactly what the planner shows for an untouched line.
      produced:    line.targetPerPhase ?? null,
      // `finlitSpec` carries the chosen option IDS; `toDecisionFields` resolves
      // each to its display name so the reports can print it.
      fields:      toDecisionFields(product, lineDecisionValues(line, share), line.finlitSpec ?? {}),
    });
  }

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
      // The whole cost lands on ONE side of the Gross Profit line, per the
      // operator's enum. Spread so an item with no `costTreatment` omits the
      // key entirely rather than sending zeros — the server reads absence as
      // "book `cost` as a period cost", and a `{0,0}` would charge neither.
      // The step multiplier is NOT applied here; `calcFinancials` scales the
      // split by the selected step, and doing it twice would square it.
      ...(item.costTreatment
        ? {
            costTreatment: item.costTreatment === 'cogs'
              ? { cogs: item.cost, opex: 0 }
              : { cogs: 0, opex: item.cost },
          }
        : {}),
      energy:            item.energy,
      productsImpacted:  item.productsImpacted,
      impacts:           item.impacts,
      impactLevel:       item.impactLevel ?? null,
      options:           item.options,
    });
  }

  return { inputs, globalInputs };
}

// `normalize` went with `pairLinesWithProducts` — it existed only to fuzzy-match
// a product name against a player-chosen line name.
const clamp01   = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const round2    = (v: number) => Math.round(v * 100) / 100;
const round4    = (v: number) => Math.round(v * 10000) / 10000;
