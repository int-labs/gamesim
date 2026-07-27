export const calcDiminishingReturnsCostFactor = (
  quantity: number,
  min:      number | null,
  max:      number | null
): number => {
  if (min === null || max === null || max <= min) return 1;

  const meanMode = (min + max) / 2;
  const stdDev   = (max - min) / 4;

  const z                       = (quantity - meanMode) / stdDev;
  const effectivenessMultiplier = Math.exp(-(z * z) / 2); // 1 at the peak, →0 at the extremes

  return 2 - effectivenessMultiplier; // 1 (peak) → 2 (at the bounds)
};