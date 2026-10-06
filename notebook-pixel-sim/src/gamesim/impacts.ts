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

/* ── How an impact READS ──────────────────────────────────────────────────
 *
 * The display half of `IMPACT_CONFIG` (`server/src/constants/impacts.ts`).
 * Keyed by IMPACT, never by item key: `hiring`'s two items are the same shape
 * and differ only in which impact they carry, so a UI that branches on
 * `chewie` / `beta` is branching on operator data. Rename an item, add a third
 * team, or re-point one at another impact and that branch breaks silently —
 * whereas a registry entry is found or it is not.
 *
 * SIGN AND TONE ARE SEPARATE, which is the trap here. `dynamic_cost` is
 * applied by the server as `dynamicCost *= (1 - v*m)`, so a contribution of
 * 0.15 is a 15% CUT: it must READ as "-15%" and be TONED as good. Deriving the
 * tone from the sign would paint R&D's whole benefit red.
 */
export type ImpactTone = 'good' | 'bad';

export interface ImpactPresentation {
  /** What the chip is called. */
  label: string;
  /** The contribution as the player should read it, sign included. */
  format: (contribution: number) => string;
  /**
   * Which direction of `contribution` is good for the player. NOT the sign of
   * the rendered figure — see the note above.
   */
  betterWhen: 'higher' | 'lower';
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export const IMPACT_PRESENTATION: Record<string, ImpactPresentation> = {
  // `inventoryAugmentation *= (1 + v*m)` — raises the production ceiling.
  inventory: {
    label: 'Capacity',
    format: (v) => `+${pct(v)}`,
    betterWhen: 'higher',
  },
  // `dynamicCost *= (1 - v*m)` — a bigger contribution is a BIGGER CUT. The
  // owner's framing: higher investment in cost reduction is better.
  dynamic_cost: {
    label: 'Unit cost',
    format: (v) => `-${pct(v)}`,
    betterWhen: 'higher',
  },
  // `customersObtainedAugment *= (1 + v*m)`.
  marketing: {
    label: 'Reach',
    format: (v) => `+${pct(v)}`,
    betterWhen: 'higher',
  },
  sales_channel: {
    label: 'Sell-through',
    format: (v) => `+${pct(v)}`,
    betterWhen: 'higher',
  },
  // `entryRate += v` — the channel's cut of each sale. The one impact where
  // more is WORSE.
  consignment: {
    label: 'Channel cut',
    format: (v) => pct(v),
    betterWhen: 'lower',
  },
};

/** One impact's contribution at a step, ready to render. */
export interface ImpactEffect {
  key: string;
  /** `effectiveImpactValue × stepMultiplier` — the server's own expression. */
  contribution: number;
  presentation: ImpactPresentation;
  /** `good` unless the figure moves the wrong way for this impact. */
  tone: ImpactTone;
}

/**
 * EVERY impact an item actually carries, at a given step — not a fixed set of
 * named fields with the absent ones zeroed.
 *
 * This is what lets one card render both hires: Production carries
 * `inventory`, R&D carries `dynamic_cost`, and each gets exactly the chips its
 * own configuration earns. An item pointed at an impact with no registry entry
 * is SKIPPED rather than guessed at — the server's `IMPACT_CONFIG` is a closed
 * set, so an unknown key is a config error, not a label to invent.
 */
export function impactEffects(
  item: GlobalInputItemDto,
  stepKey: string | null | undefined,
  productId?: string | null,
): ImpactEffect[] {
  const multiplier = stepMultiplier(item, stepKey);
  return Object.keys(item.impacts ?? {})
    .filter((key) => key in IMPACT_PRESENTATION)
    .map((key) => {
      const presentation = IMPACT_PRESENTATION[key];
      const contribution = effectiveImpactValue(item.impacts?.[key], productId) * multiplier;
      const helps =
        presentation.betterWhen === 'higher' ? contribution >= 0 : contribution <= 0;
      return { key, contribution, presentation, tone: helps ? 'good' as const : 'bad' as const };
    });
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
