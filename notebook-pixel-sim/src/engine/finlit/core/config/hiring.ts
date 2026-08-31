import type { GlobalInputItemDto } from '@/gamesim/types';
import { effectiveImpactValue } from '@/gamesim/impacts';

/**
 * Hiring reads STRAIGHT off the backend's globalInput items. There is no local
 * candidate table any more: `CANDIDATES` / `hydrateCandidates` / `hireLevel`
 * are gone, and with them the frontend arithmetic that used to launder the
 * operator's configuration —
 *
 *   • levels hardcoded to `[1,2,3,4]` with `options[String(lvl)] ?? 1`, which
 *     invented FULL-STRENGTH levels the operator never configured;
 *   • `cost: item.cost * 2^(level-1)`, an invented doubling curve;
 *   • `energy: item.energy * level`, an invented linear curve.
 *
 * `options` on the item IS the impact-level map: its KEYS are the levels and
 * its VALUES are the multipliers. It is the only authority for how many levels
 * exist and what each one is worth, and its keys are what must be submitted as
 * `selectedStepKey`.
 */

/** One selectable step on a hiring item. */
export interface HireStep {
  /** The value that must be submitted as `selectedStepKey`. */
  stepKey: string;
  /** `options[stepKey]` — scales every impact, and cost and energy with them. */
  multiplier: number;
  prodBonus: number;
  sellBonus: number;
  marketingBonus: number;
  /** Unit-cost reduction from the `dynamic_cost` impact. */
  costReduction: number;
  cost: number;
  energy: number;
}

/**
 * Every step configured on a hiring item, in the backend's own key order.
 * Pure — pass the live item out of `availableGlobalInputs`. Nothing is cached,
 * so there is no local copy that can drift from the server.
 *
 * The four impact keys read here are exactly the ones the server's
 * `IMPACT_CONFIG` acts on for a hiring item; reading any others would display an
 * effect the server ignores.
 *
 * Pass `productId` to see the bonuses AS THAT PRODUCT RECEIVES THEM, with the
 * per-product `selections` override applied. Omit it for the company-wide base
 * figures — which is what a roster comparing candidates wants.
 */
export const hireSteps = (
  item: GlobalInputItemDto,
  productId?: string | null,
): HireStep[] => {
  const value = (key: string) => effectiveImpactValue(item.impacts?.[key], productId);
  return Object.entries(item.options ?? {}).map(([stepKey, multiplier]) => ({
    stepKey,
    multiplier,
    prodBonus:      value('inventory')     * multiplier,
    sellBonus:      value('sales_channel') * multiplier,
    marketingBonus: value('marketing')     * multiplier,
    costReduction:  value('dynamic_cost')  * multiplier,
    // Scaled by the same multiplier as the effects, then rounded UP so a step
    // never charges less than a weaker one.
    cost:   Math.ceil(item.cost   * multiplier),
    energy: Math.ceil(item.energy * multiplier),
  }));
};

/** One step by its key, or null when that key is not configured on this item. */
export const hireStep = (
  item: GlobalInputItemDto,
  stepKey: string | null,
  productId?: string | null,
): HireStep | null =>
  stepKey == null ? null : hireSteps(item, productId).find((s) => s.stepKey === stepKey) ?? null;

/**
 * Candidate artwork, keyed by the backend item's `key`. Populated by
 * `configHydrator` from the operator's PlayerConfig (the PlayerConfigPage is
 * where an administrator sets it), which is the only place candidate images are
 * configured — the backend globalInput carries numbers, not art.
 *
 * Mutated in place and read lazily, per the container rules in CLAUDE.md: never
 * build a derived constant from it at module scope.
 */
export const CANDIDATE_IMAGE: Record<string, string> = {};

export const setCandidateImage = (id: string, url: string): void => {
  CANDIDATE_IMAGE[id] = url;
};
