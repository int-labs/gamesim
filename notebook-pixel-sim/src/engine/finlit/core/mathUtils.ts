// Ported from server/src/utils — keep in sync with the server's scoring math.

const erf = (x: number): number => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
};

export const normalCDF = (x: number, avg: number, stdDev: number): number =>
  0.5 * (1 + erf((x - avg) / (Math.sqrt(2) * stdDev)));

export const directionOffset = (direction: number): number => (1 - direction) / 2;

export const bellCurveScore = (
  value: number,
  min: number | null,
  max: number | null,
  center: number,
): number => {
  if (min === null || max === null || max <= min) return 1;
  const stdDev = (max - min) / 4;
  const z = (value - center) / stdDev;
  return Math.exp(-(z * z) / 2);
};

/**
 * MIRRORS `server/src/utils/calcDiminishingReturnsCostFactor.ts`. A true bell
 * centred on `max` — the ceiling IS the optimum, and spending past it decays.
 *
 * Changed 2026-10-16 with the server's. It was `2 − exp(−z²/2)` about the
 * MIDPOINT, which rewarded either bound and could never punish an overshoot.
 * If one of these two moves without the other, this preview stops agreeing with
 * the score the player is actually given.
 */
const PEAK = 2 - Math.exp(-2); // 1.8647 — the old curve's value at a bound

export const diminishingReturnsFactor = (
  quantity: number,
  min: number | null,
  max: number | null,
): number => {
  if (min === null || max === null || max <= min) return 1;
  // /3 — must match the server's divisor exactly. See the note there.
  const stdDev = (max - min) / 3;
  const z = (quantity - max) / stdDev;
  return PEAK * Math.exp(-(z * z) / 2);
};
