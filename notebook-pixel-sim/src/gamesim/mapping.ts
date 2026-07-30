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
// Server quirks this file has to respect:
//   • A ProductField with no `coefficients` is SKIPPED by calcMarketModel, so a
//     field we fill here still contributes nothing to the competition unless the
//     operator configured coefficients for it.
//   • `selling_price` is skipped by the scoring loop outright
//     (calcMarketModel.ts:192) — it drives revenue in calcFinancials, not share.
//     So `score` is effectively the ONLY thing teams compete on today.
//   • Every non-enum value is multiplied by a diminishing-returns factor that is
//     1.0 at the midpoint of the field's [minValue, maxValue] and 2.0 at either
//     bound. For `score` that means the field's range must be wide enough that
//     the whole [0.6, 1.2] vocFit band sits on ONE side of the midpoint,
//     otherwise a weak product can outrank a mid one — see
//     scripts/provision-notebook.mjs, which configures [0, 3] for that reason.
//   • projected_market_share is a FRACTION and it SCALES the score-derived
//     share. In calcMarketModel: normalisedPms = pms / (1 / numberOfTeams), then
//     actualShare = min(rawShare × normalisedPms, 1) — so pms = 1/numberOfTeams
//     is the neutral claim, and getInput() additionally multiplies the value by a
//     diminishing-returns factor that is 1.0 at the MIDPOINT of the field's
//     [minValue, maxValue] and 2.0 at either bound. We therefore default to the
//     field's midpoint (see `defaultProjectedShareFor`), which is the neutral,
//     undistorted value when the operator sets the range to [0, 2/teams] — the
//     range scripts/provision-notebook.mjs writes. recalcProjections reads the
//     same key but clamps it to [0,1] and defaults a MISSING entry to 20 →
//     clamped to 1.0 (100%), so we always send it explicitly.

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

export interface ToDecisionInputsArgs {
  state: GameState;
  products: ProductDto[];
  /** Per-line projected market share (fraction), keyed by line id. Missing
   *  lines fall back to the paired product's neutral midpoint. */
  projectedShareByLine?: Record<string, number>;
  /** Overrides the per-product midpoint default for every line. */
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
  defaultProjectedMarketShare,
}: ToDecisionInputsArgs): DecisionProductInput[] {
  const activeProducts = products.filter((p) => p.active !== false);
  return pairLinesWithProducts(state.portfolio.productLines, activeProducts).map(({ line, product }) => {
    const share =
      projectedShareByLine[line.id] ?? defaultProjectedMarketShare ?? defaultProjectedShareFor(product);
    const values = lineDecisionValues(line, share);
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
