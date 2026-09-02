// Engine validation layer.
//
// Every engine number flows through these guards. The simulation has many
// multiplicative chains (demand, cost, capacity), so a single NaN or Infinity
// can cascade into wholesale state corruption. These helpers are the moat.
//
// Rules:
//   - finite(): coerces NaN/Infinity to a fallback (default 0)
//   - clamp01: convenience for 0..1 ranges (fits, retention, defect)
//   - safeDiv: protects every division
//   - nonNeg: floors at 0 — for counts, money receipts, demand
//   - posOr1: floors at 1 — for divisors, capacities (never zero throughput)
//
// Use these everywhere the formula touches user data, rng, or modifier mults.

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const clamp01 = (v: number): number => clamp(finite(v, 0), 0, 1);

/** Coerce NaN / Infinity / undefined to `fallback`. Default 0. */
export const finite = (v: number | undefined | null, fallback = 0): number => {
  if (v === undefined || v === null) return fallback;
  if (!Number.isFinite(v)) return fallback;
  return v;
};

/** Division that returns `fallback` when divisor is 0 / NaN / Infinity. */
export const safeDiv = (num: number, den: number, fallback = 0): number => {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return fallback;
  return num / den;
};

export const nonNeg = (v: number): number => Math.max(0, finite(v, 0));
