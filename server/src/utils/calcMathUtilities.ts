export const erf = (x: number): number => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p  = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t    = 1 / (1 + p * absX);
  const y    =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);

  return sign * y;
};

export const mean = (arr: number[]): number =>
  arr.reduce((a, b) => a + b, 0) / arr.length;

export const calcStdDev = (data: number[], tightening: number): number => {
  const values = data.filter((v) => v !== null && v !== undefined);
  if (values.length === 0) return 1;

  const avg      = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev   = Math.sqrt(variance);

  return stdDev === 0 ? 1 : stdDev * tightening;
};

export const directionOffset = (direction: number): number =>
  (1 - direction) / 2;

export const normalCDF = (x: number, avg: number, stdDev: number): number => {
  const z = (x - avg) / (Math.sqrt(2) * stdDev);
  return 0.5 * (1 + erf(z));
};

export const DEFAULT_TIGHTENING = 3;
