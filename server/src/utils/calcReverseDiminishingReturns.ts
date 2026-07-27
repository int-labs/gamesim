export const calcReverseDiminishingReturns = (
  value:  number,
  min:    number | null,
  max:    number | null,
): number => {
  if (min === null || max === null || max <= min) return 1;

  const range  = max - min;
  const stdDev = range / 4;

  // normalize value relative to min so curve always starts at 1 when value === min
  const z = (value - min) / stdDev;

  return Math.exp(-(z * z) / 2);
  // returns: 1 at min, falls toward 0 as value increases toward max
  // strictly 0–1
};