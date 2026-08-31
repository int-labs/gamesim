// Supply-chain partners, read STRAIGHT off the backend's globalInput items
// (key: 'supply_chain'). Like hiring, there is no local vendor table any more —
// `VENDORS` / `hydrateVendors` / `vendorById` are gone, and with them:
//
//   • a cached copy that could drift from the server;
//   • `coveredGenres`, resolved by testing whether a product's NAME contained a
//     genre id as a substring. `productsImpacted` is a list of product ids and
//     is checked directly against the product a line is paired with.
//
// A vendor is a COMPANY-WIDE selection — that is what "global input" means.
// `productsImpacted` does not scope the selection; it gates whether the bonus
// applies to a given product, which the server already enforces when it filters
// globalInputs per product.

import type { GlobalInputItemDto } from '@/gamesim/types';
import { effectiveImpactValue, impactsProduct } from '@/gamesim/impacts';

export type VendorId = string;
export type VendorQuality = 'perfect' | 'good' | 'average' | 'none';

/** What engaging a vendor at one step costs and gives. */
export interface VendorStep {
  /** The value to submit as `selectedStepKey`; null when the item is binary. */
  stepKey: string | null;
  /** `options[stepKey]`, or 1 for a binary item with no configured steps. */
  multiplier: number;
  /** Production-rate augment — the `inventory` impact, scaled by the step. */
  prodBonus: number;
  cost: number;
  energy: number;
}

/**
 * A LABEL over the backend's own number, not a number of its own. The
 * thresholds are presentation: they bucket `prodBonus` so a card can say
 * "good" instead of "0.62".
 */
export function vendorQuality(prodBonus: number): VendorQuality {
  if (prodBonus > 0.75) return 'perfect';
  if (prodBonus > 0.60) return 'good';
  if (prodBonus > 0.35) return 'average';
  return 'none';
}

/* Impact resolution lives in `@/gamesim/impacts` — it is a wire contract shared
   with hiring, marketing and channels, not a vendor concern. */

/**
 * Every step configured on a vendor item. An item with no `options` is binary —
 * selected or not — and yields exactly one step with a null key and a
 * multiplier of 1, which is how the server scores an optionless entry.
 *
 * Pass `productId` to see the bonus AS THAT PRODUCT WILL RECEIVE IT, with the
 * per-product override applied. Omit it for the unscoped base figure.
 */
export function vendorSteps(
  item: GlobalInputItemDto,
  productId?: string | null,
): VendorStep[] {
  const prodImpact = effectiveImpactValue(item.impacts?.['inventory'], productId);
  const build = (stepKey: string | null, multiplier: number): VendorStep => ({
    stepKey,
    multiplier,
    prodBonus: prodImpact * multiplier,
    cost: Math.ceil(item.cost * multiplier),
    energy: Math.ceil(item.energy * multiplier),
  });
  const entries = Object.entries(item.options ?? {});
  return entries.length === 0
    ? [build(null, 1)]
    : entries.map(([stepKey, multiplier]) => build(stepKey, multiplier));
}

/** One step by key, or the binary step when the item has no options. */
export function vendorStep(
  item: GlobalInputItemDto,
  stepKey: string | null,
  productId?: string | null,
): VendorStep | null {
  const steps = vendorSteps(item, productId);
  return steps.find((s) => s.stepKey === stepKey) ?? steps[0] ?? null;
}

/**
 * Is this vendor's bonus available to `productId`? An empty `productsImpacted`
 * means every product; otherwise only the listed ones benefit. Mirrors the
 * server's own per-product filter.
 */
export const vendorCoversProduct = (
  item: GlobalInputItemDto,
  productId: string | null | undefined,
): boolean => impactsProduct(item, productId);

/**
 * Vendor artwork, keyed by the backend item's `key`. Populated by
 * `configHydrator` from the operator's PlayerConfig — the globalInput carries
 * numbers, not art. Mutated in place and read lazily.
 */
export const VENDOR_IMAGE: Record<string, string> = {};

export const setVendorImage = (id: string, url: string): void => {
  VENDOR_IMAGE[id] = url;
};
