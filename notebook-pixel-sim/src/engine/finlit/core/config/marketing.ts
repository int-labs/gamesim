// Marketing presentation only. The numbers — cost, energy, steps and the demand
// impact — live on the `marketing` globalInput and are read straight off it.

/**
 * Marketing artwork, keyed by the BACKEND item's `key` — the same contract as
 * `CANDIDATE_IMAGE` / `VENDOR_IMAGE`. Populated by `configHydrator` from the
 * operator's PlayerConfig, which is the only place it is configured.
 *
 * Mutated in place and read lazily, per the container rules in CLAUDE.md: never
 * build a derived constant from it at module scope.
 */
export const MARKETING_IMAGE: Record<string, string> = {};

export const setMarketingImage = (id: string, url: string): void => {
  MARKETING_IMAGE[id] = url;
};
