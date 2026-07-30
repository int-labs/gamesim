// GLUE: notebook game state → gamesim `Decision.inputs[].fields[]`.
//
// This file is the whole "how does a pixel notebook become a competitive
// decision" translation, and it is NEW work — V3 has no such seam. Everything
// here is written to fit the server exactly as it already is (no backend
// change): the field ids come from GET /products, and the server's
// calcMarketModel/calcFinancials decide what they mean.
//
// ⚠️ PROPOSED MAPPING — needs Shafnat's confirmation before it is treated as
// final (see docs/gamesim-integration.md):
//   selling_price            ← ProductLine.price                    (uncontroversial)
//   score / quality          ← vocFit(spec, price, channels, genre)  ∈ [0.6, 1.2]
//   unit cost (money field)  ← unitCost(spec)                       (uncontroversial)
//   projected_market_share   ← local engine's share proxy — A NEW INPUT; V3 has
//                              no such decision (it used a fixed BASE_MARKET_SHARE)
//
// Two server quirks this file has to respect:
//   • A ProductField with no `coefficients` is SKIPPED by calcMarketModel, so a
//     field we fill here still contributes nothing to the competition unless the
//     operator configured coefficients for it.
//   • recalcProjections reads projected_market_share as a FRACTION and clamps to
//     [0,1] (a missing entry defaults to 20 → clamps to 1.0 = 100% share), while
//     other parts of the model treat the same key as a percentage. We always send
//     an explicit fraction so we never land on that default.

import type { GameState } from '@/state/store';
import { unitCost } from '@/data/finlit';
import { vocFit } from '@/engine/finlit';
import { toFinlitLine, type LineInput } from '@/engine/finlit/adapter';
import type { DecisionFieldEntry, DecisionProductInput, ProductDto, ProductFieldDto } from './types';

/** Field keys this glue knows how to fill. Anything else on the product is
 *  left to the operator's configuration (and simply not sent). */
export const FIELD_KEYS = {
  sellingPrice: ['selling_price', 'sellingPrice', 'price'],
  score: ['score', 'quality', 'product_score'],
  unitCost: ['unit_cost', 'unitCost', 'cost'],
  projectedMarketShare: ['projected_market_share'],
} as const;

type StoreLine = GameState['portfolio']['productLines'][number];

const findField = (product: ProductDto, keys: readonly string[]): ProductFieldDto | undefined =>
  product.fields.find((f) => keys.includes(f.key));

function lineInput(l: StoreLine): LineInput {
  return {
    id: l.id,
    name: l.name,
    price: l.price,
    genre: l.genre,
    finlitSpec: l.finlitSpec,
    channels: l.channels,
    vendor: l.vendor,
    targetPerDay: l.targetPerDay,
    finished: l.inventory.finished,
    targetSegment: l.targetSegment,
  };
}

/** The four numbers the glue derives from one product line. Exposed so the UI
 *  can show the player exactly what gets submitted. */
export interface LineDecisionValues {
  sellingPrice: number;
  /** VoC fit in [0.6, 1.2] — the quality/score put up against other teams. */
  score: number;
  unitCost: number;
  /** Fraction in [0,1]. */
  projectedMarketShare: number;
}

export function lineDecisionValues(line: StoreLine, projectedMarketShare: number): LineDecisionValues {
  const fl = toFinlitLine(lineInput(line));
  return {
    sellingPrice: round2(fl.price),
    score: round4(vocFit(fl.spec, fl.price, fl.channels, fl.genre)),
    unitCost: round2(unitCost(fl.spec)),
    projectedMarketShare: clamp01(round4(projectedMarketShare)),
  };
}

/** Field entries for one product, skipping keys the product doesn't define. */
export function toDecisionFields(product: ProductDto, values: LineDecisionValues): DecisionFieldEntry[] {
  const entries: DecisionFieldEntry[] = [];
  const push = (field: ProductFieldDto | undefined, value: number) => {
    if (field) entries.push({ fieldId: field._id, value });
  };
  push(findField(product, FIELD_KEYS.sellingPrice), values.sellingPrice);
  push(findField(product, FIELD_KEYS.score), values.score);
  push(findField(product, FIELD_KEYS.unitCost), values.unitCost);
  push(findField(product, FIELD_KEYS.projectedMarketShare), values.projectedMarketShare);
  return entries;
}

/**
 * Pairs local product lines with the operator-configured Products.
 *
 * The player invents lines locally; Products exist server-side. There is no id
 * in common, so pairing is by name (case-insensitive, punctuation-insensitive)
 * and then positionally for whatever is left, in the order both sides list
 * them. Lines with no Product left to pair with are DROPPED from the
 * submission — the server has nowhere to put them, and inventing a Product
 * client-side is not something this seam gets to do.
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

export interface ToDecisionInputsArgs {
  state: GameState;
  products: ProductDto[];
  /** Per-line projected market share (fraction), keyed by line id. Missing
   *  lines fall back to `defaultProjectedMarketShare`. */
  projectedShareByLine?: Record<string, number>;
  defaultProjectedMarketShare?: number;
}

/**
 * The submission payload's `inputs[]`. One entry per paired product line —
 * notebook is multi-product, so each line is its own Product decision.
 */
export function toDecisionInputs({
  state,
  products,
  projectedShareByLine = {},
  defaultProjectedMarketShare = 0.2,
}: ToDecisionInputsArgs): DecisionProductInput[] {
  const activeProducts = products.filter((p) => p.active !== false);
  return pairLinesWithProducts(state.portfolio.productLines, activeProducts).map(({ line, product }) => {
    const values = lineDecisionValues(line, projectedShareByLine[line.id] ?? defaultProjectedMarketShare);
    return {
      productId: product._id,
      segmentId: product.segmentId,
      productName: product.productName,
      fields: toDecisionFields(product, values),
    };
  });
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
