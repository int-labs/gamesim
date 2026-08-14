// GLUE: notebook game state → gamesim `Decision.inputs[].fields[]` and `globalInputs[]`.
//
// Translation seam between local game state and the server's Decision schema.
// Each spec axis is submitted as its own ProductField value; channel selections
// are submitted as GlobalInput snapshots. No client-side scoring or cost
// aggregation — calcMarketModel and calcFinancials handle that from the
// individual field values and operator-configured coefficients.

import type { GameState } from '@/state/store';
import { configOption, type ConfigAxis } from '@/engine/finlit/core/config/production';
import type {
  DecisionFieldEntry,
  DecisionGlobalInputDto,
  DecisionProductInput,
  GlobalInputDto,
  ProductDto,
  ProductFieldDto,
} from './types';

/** Canonical field keys this glue submits. One string per axis — no aliases. */
export const FIELD_KEYS = {
  sellingPrice:         'selling_price',
  paper:                'paper',
  size:                 'size',
  pageDesign:           'page_design',
  addon:                'addon',
  cover:                'cover',
  projectedMarketShare: 'projected_market_share',
} as const;

type StoreLine = GameState['portfolio']['productLines'][number];

const findField = (product: ProductDto, key: string): ProductFieldDto | undefined =>
  product.fields.find((f) => f.key === key);

const specCost = (axis: ConfigAxis, id: string | undefined): number =>
  id ? configOption(axis, id).cost : 0;

/** The values derived from one product line for server submission. */
export interface LineDecisionValues {
  sellingPrice:         number;
  paper:                number;
  size:                 number;
  pageDesign:           number;
  addon:                number;
  cover:                number;
  projectedMarketShare: number;
}

export function lineDecisionValues(line: StoreLine, projectedMarketShare: number): LineDecisionValues {
  const spec = line.finlitSpec ?? {};
  return {
    sellingPrice:         round2(line.price),
    paper:                specCost('paper',      spec.paper),
    size:                 specCost('size',        spec.size),
    pageDesign:           specCost('pageDesign',  spec.pageDesign),
    addon:                specCost('addon',       spec.addon),
    cover:                specCost('cover',       spec.cover),
    projectedMarketShare: clamp01(round4(projectedMarketShare)),
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
      fields:      toDecisionFields(product, lineDecisionValues(line, share)),
    };
  });

  const selectionMap = new Map(
    (state.globalInputSelections ?? []).map((sel) => [sel.key, sel.selectedStepKey]),
  );
  const globalInputs: DecisionGlobalInputDto[] = [];
  for (const container of availableGlobalInputs) {
    for (const item of container.inputs) {
      if (!selectionMap.has(item.key)) continue;
      globalInputs.push({
        globalInputItemId: item._id,
        category:          container.category,
        key:               item.key,
        label:             item.label,
        description:       item.description ?? null,
        selectedStepKey:   selectionMap.get(item.key) ?? null,
        cost:              item.cost,
        energy:            item.energy,
        productsImpacted:  item.productsImpacted,
        impacts:           item.impacts,
        impactLevel:       item.impactLevel ?? null,
        options:           item.options,
      });
    }
  }

  return { inputs, globalInputs };
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const clamp01   = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const round2    = (v: number) => Math.round(v * 100) / 100;
const round4    = (v: number) => Math.round(v * 10000) / 10000;
