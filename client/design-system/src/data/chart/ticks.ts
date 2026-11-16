/** Steps an axis counts in: 1, 2 or 5 times a power of ten. */
const STEP_FACTORS = [1, 2, 5];
/** Steps an axis with a fixed number of them counts in, times a power of ten: finer, so its top leaves less room. */
const EVEN_STEP_FACTORS = [1, 2, 2.5, 3, 4, 5, 6, 8, 10];
/** Room for floating-point error when a value sits on a step. */
const EPSILON = 1e-9;

/** Decimal places that write a multiple of `step` without floating-point noise (0.6, not 0.6000000000000001). */
function decimalsOf(step: number) {
  return Math.max(0, -Math.floor(Math.log10(step)) + 1);
}

/**
 * Round, evenly spaced values for a value axis from `min` to `max`, always including zero, about
 * `count` of them: 0, 500M, 1B, 1.5B, 2B, 2.5B for values up to 2.26B; -1B to 3B when one is
 * negative. Of the steps that give a count nearest `count`, the one leaving the least room above
 * and below the values wins.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const low = Math.min(0, min);
  const high = Math.max(0, max);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high === low) return [0];
  const span = high - low;
  const magnitude = 10 ** Math.floor(Math.log10(span / count));
  let best: { step: number; first: number; last: number; score: number; slack: number } | undefined;
  for (const power of [magnitude / 10, magnitude, magnitude * 10]) {
    for (const factor of STEP_FACTORS) {
      const step = factor * power;
      const first = Math.floor(low / step + EPSILON);
      const last = Math.ceil(high / step - EPSILON);
      const score = Math.abs(last - first + 1 - count);
      const slack = (last - first) * step - span;
      if (!best || score < best.score || (score === best.score && slack < best.slack)) best = { step, first, last, score, slack };
    }
  }
  if (!best) return [0];
  const decimals = decimalsOf(best.step);
  const ticks: number[] = [];
  for (let index = best.first; index <= best.last; index += 1) {
    const value = Number((index * best.step).toFixed(decimals));
    // No negative zero: it would print as "-0".
    ticks.push(value === 0 ? 0 : value);
  }
  return ticks;
}

/**
 * `steps` + 1 evenly spaced values from zero up to `max` or just past it, for an axis that shares
 * its grid lines with another (a combo chart's two sides): the smallest round step that reaches
 * `max`. 0, 8%, 16%, 24%, 32% for rates up to 28.5%; 0 to 16,000 by 4,000 for counts up to
 * 12,500. A `max` of zero or less counts in ones.
 */
export function evenTicks(max: number, steps = 4): number[] {
  let step = 1;
  if (Number.isFinite(max) && max > 0) {
    const rough = max / steps;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const factor = EVEN_STEP_FACTORS.find((candidate) => candidate * magnitude >= rough * (1 - EPSILON)) ?? 10;
    step = factor * magnitude;
  }
  const decimals = decimalsOf(step);
  return Array.from({ length: steps + 1 }, (_, index) => Number((index * step).toFixed(decimals)));
}
