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

export const diminishingReturnsFactor = (
  quantity: number,
  min: number | null,
  max: number | null,
): number => {
  if (min === null || max === null || max <= min) return 1;
  const meanMode = (min + max) / 2;
  const stdDev = (max - min) / 4;
  const z = (quantity - meanMode) / stdDev;
  return 2 - Math.exp(-(z * z) / 2);
};
