import { evenTicks, niceTicks } from "./ticks";

describe("evenTicks", () => {
  it("counts from zero in the smallest round step that reaches the largest value, in four steps", () => {
    expect(evenTicks(28.5)).toEqual([0, 8, 16, 24, 32]);
    expect(evenTicks(32)).toEqual([0, 8, 16, 24, 32]);
    expect(evenTicks(12_500)).toEqual([0, 4000, 8000, 12_000, 16_000]);
    expect(evenTicks(10_000)).toEqual([0, 2500, 5000, 7500, 10_000]);
    expect(evenTicks(11)).toEqual([0, 3, 6, 9, 12]);
  });

  it("takes another number of steps when asked", () => {
    expect(evenTicks(100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(evenTicks(1, 2)).toEqual([0, 0.5, 1]);
  });

  it("writes fractions without floating-point noise", () => {
    expect(evenTicks(0.9)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(evenTicks(0.07)).toEqual([0, 0.02, 0.04, 0.06, 0.08]);
  });

  it("counts in ones when there is nothing to scale", () => {
    expect(evenTicks(0)).toEqual([0, 1, 2, 3, 4]);
    expect(evenTicks(-5)).toEqual([0, 1, 2, 3, 4]);
    expect(evenTicks(Number.NaN)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("niceTicks", () => {
  it("counts in round steps from zero past the largest value", () => {
    expect(niceTicks(1_550_000_000, 3_000_000_000)).toEqual([0, 1e9, 2e9, 3e9]);
    expect(niceTicks(1_550_000_000, 2_260_000_000)).toEqual([0, 5e8, 1e9, 1.5e9, 2e9, 2.5e9]);
    expect(niceTicks(12, 97)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it("reaches below zero when a value is negative, with zero among the ticks", () => {
    const ticks = niceTicks(-420_000_000, 2_600_000_000);
    expect(ticks[0]).toBeLessThanOrEqual(-420_000_000);
    expect(ticks).toContain(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(2_600_000_000);
    expect(niceTicks(-80, -5)).toEqual([-80, -60, -40, -20, 0]);
  });

  it("writes fractions without floating-point noise", () => {
    expect(niceTicks(0.12, 0.87)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(0.001, 0.0034)).toEqual([0, 0.001, 0.002, 0.003, 0.004]);
    const symmetric = niceTicks(-0.5, 0.5);
    expect(symmetric).toEqual([-0.5, 0, 0.5]);
    // Zero is +0, which prints as "0", never "-0".
    expect(Object.is(symmetric[1], 0)).toBe(true);
    expect(niceTicks(-3, -1).every((tick) => !Object.is(tick, -0))).toBe(true);
  });

  it("gives a lone zero when there is nothing to scale", () => {
    expect(niceTicks(0, 0)).toEqual([0]);
    expect(niceTicks(Number.NaN, 4)).toEqual([0]);
  });

  it("keeps close to the asked count", () => {
    for (const [min, max] of [
      [0, 1],
      [0, 7],
      [3, 1234],
      [-17, 23],
      [0, 9_999_999],
    ] as const) {
      const ticks = niceTicks(min, max);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(7);
      const step = (ticks[1] ?? 0) - (ticks[0] ?? 0);
      ticks.forEach((tick, index) => expect(tick).toBeCloseTo((ticks[0] ?? 0) + index * step, 9));
    }
  });
});
