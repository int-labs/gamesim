// How a globalInput's configured impact becomes a number — the frontend half of
// a rule the SERVER owns (`server/src/sim/calcFinancials.ts`, the impacts loop).
//
// It lives in `gamesim/` and not in `engine/` on purpose: this is a wire
// contract, not game logic. Every panel that shows the effect of a business
// decision must resolve it through here, so a figure on screen cannot disagree
// with the figure the P&L applies. Reimplementing any of this at a call site is
// how the display and the score drifted apart in the first place.
//
// The server's formula, in full:
//
//   contribution = effectiveImpactValue(impact, productId) × options[stepKey]
//
// with the per-product override resolved FIRST and the step multiplier applied
// after it.

import type { GlobalInputImpactDto, GlobalInputItemDto } from './types';

/**
 * An impact's value AS ONE PRODUCT RECEIVES IT, resolving the per-product
 * override in `impacts[k].selections[]`.
 *
 * The two impact types do NOT share one operation:
 *
 *   • relative is a RATE     → the override MULTIPLIES it (0.5 halves it,
 *                              0 cancels it, 1 is the no-op)
 *   • absolute is a QUANTITY → the override ADDS to it (0 is the no-op,
 *                              a negative value reduces it)
 *
 * An impact with no override for this product — or no `selections` at all —
 * returns its base value with NO arithmetic applied. There is deliberately no
 * "neutral override" default: absence of an override is the absence of an
 * operation, not a multiplication by one.
 *
 * Pass `productId: null` for a company-wide figure, which reads the base value.
 */
export function effectiveImpactValue(
  impact: GlobalInputImpactDto | undefined,
  productId: string | null | undefined,
): number {
  if (!impact) return 0;
  if (productId == null) return impact.value;
  const override = impact.selections?.find(
    (sel) => String(sel.productId) === String(productId),
  )?.value;
  if (override == null) return impact.value;
  return impact.type === 'relative' ? impact.value * override : impact.value + override;
}

/**
 * The step multiplier for a selection: `options[stepKey]`.
 *
 * An item with no `options` is binary and scores 1 when selected, which is how
 * `getGlobalInputQuantity` treats it server-side. A stepKey that is not a
 * configured option yields 0 — the same miss that makes the server skip every
 * impact on the entry, so a caller passing a frontend-invented key sees the
 * effect collapse rather than a plausible wrong number.
 */
export function stepMultiplier(
  item: Pick<GlobalInputItemDto, 'options'>,
  stepKey: string | null | undefined,
): number {
  const options = item.options ?? {};
  if (Object.keys(options).length === 0) return 1;
  if (stepKey == null) return 0;
  return options[stepKey] ?? 0;
}

/**
 * One impact's full contribution for a product at a step — the whole server
 * formula in one call. Use this rather than combining the two helpers by hand.
 */
export function impactFor(
  item: GlobalInputItemDto,
  impactKey: string,
  stepKey: string | null | undefined,
  productId?: string | null,
): number {
  return (
    effectiveImpactValue(item.impacts?.[impactKey], productId) *
    stepMultiplier(item, stepKey)
  );
}

/**
 * Whether this item's impacts reach `productId` at all. An empty
 * `productsImpacted` means every product; otherwise only the listed ones
 * benefit. Mirrors the server's own per-product filter in
 * `recalcProjections`/`roundCalculation`.
 */
export function impactsProduct(
  item: Pick<GlobalInputItemDto, 'productsImpacted'>,
  productId: string | null | undefined,
): boolean {
  const impacted = (item.productsImpacted ?? []).map(String);
  if (impacted.length === 0) return true;
  return productId != null && impacted.includes(String(productId));
}
