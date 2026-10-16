/**
 * THE SPEC-FIELD RETURNS CURVE. A true bell, centred on `max`.
 *
 *   rises from `min` to a peak at `max`, then falls away beyond it
 *
 * `max` IS THE OPTIMUM. Owner, 2026-10-16: the option ladders are built so the
 * best choice sits at the field's ceiling, and spending past it is waste that
 * must cost customers.
 *
 * ── WHAT THIS REPLACED, AND WHY ─────────────────────────────────────────────
 * It was `2 − exp(−z²/2)` about the MIDPOINT, which is the inverse of what the
 * name says: 1 at the centre rising toward 2 at the extremes. It rewarded going
 * to a bound and penalised moderation, and because it is monotonic in |z| it
 * could never punish an overshoot — further out always paid more.
 *
 * It also never saw an overshoot. `resolveFieldValue` clamped to `max` first,
 * which pinned `z` to ±2, so a field authored 0..4 scored the same at 4, 8, 12
 * and 20 while the cost path charged the raw figure. Measured on the live Anime
 * decision: five fields submitted over their ceiling, every one returning the
 * maximum 1.8647. The upper clamp was removed with this change; the LOWER one
 * stays, since a value under `min` is not a case the ladders can produce.
 *
 * The peak is `2 − exp(−2)` so a field sitting exactly at `max` keeps the value
 * it has today. Everything below it scores less than before — that is the point
 * of the optimum moving from "either bound" to "the ceiling".
 */
const PEAK = 2 - Math.exp(-2); // 1.8647 — the old curve's value at a bound

export const calcDiminishingReturnsCostFactor = (
  quantity: number,
  min:      number | null,
  max:      number | null
): number => {
  if (min === null || max === null || max <= min) return 1;

  const stdDev = (max - min) / 4;
  // CENTRED ON `max`, not on the midpoint. This is the whole change.
  const z = (quantity - max) / stdDev;

  return PEAK * Math.exp(-(z * z) / 2);
  // max → PEAK (1.8647) · midpoint → 0.2523 · one stdDev past max → 1.131
};
