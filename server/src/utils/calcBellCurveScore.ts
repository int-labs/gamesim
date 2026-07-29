export const calcBellCurveScore = (
  value:  number,
  min:    number | null,
  max:    number | null,
  center: number
): number => {
  if (min === null || max === null || max <= min) return 1;

  const stdDev = (max - min) / 4;
  const z      = (value - center) / stdDev;

  return Math.exp(-(z * z) / 2);
  // returns: 1 at center, approaches 0 at extremes
  // strictly 0–1, symmetric around center
};