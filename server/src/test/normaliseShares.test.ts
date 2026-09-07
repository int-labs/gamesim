import { normaliseShares } from "../services/roundCalculation";

/**
 * Market share = normalised `productScore` across the teams competing for one
 * product. Shares sum to 1: a team that is the only one making something takes
 * the whole market for it.
 *
 * `totalTeams` is the BASE only — the fallback when there is no score to divide
 * by. It never scales the normalised split.
 *
 * THE REGRESSION THIS SUITE EXISTS FOR: the previous model multiplied its
 * (already correct) normalised score by `projected_market_share / (1 / n)` —
 * pms × n against a pms clamped 0..100. Any pms >= 1 drove every team past 1.0
 * and the clamp pinned them ALL at 100%, so two teams competing for one product
 * each read a full market and the shares summed to n instead of 1.
 *
 * It shipped and was only caught by reading stored `scored` documents, because
 * a sole competitor's 100% is CORRECT and looked identical to the broken case.
 * So every multi-team case below asserts the TOTAL, not just the split.
 */

const shares = (scores: Record<string, number>, totalTeams?: number) =>
  normaliseShares(new Map(Object.entries(scores)), totalTeams);

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("normaliseShares", () => {
  it("gives the whole market to the only team making the product", () => {
    // Even with three teams configured: the two that ignored it are not owed a
    // slice of it.
    const s = shares({ a: 0.42 }, 3);
    expect(s.get("a")).toBeCloseTo(1);
    expect(sum(s)).toBeCloseTo(1);
  });

  it("splits equal scores evenly across the competitors", () => {
    const two = shares({ a: 0.3, b: 0.3 }, 4);
    expect(two.get("a")).toBeCloseTo(0.5);
    expect(sum(two)).toBeCloseTo(1);

    const three = shares({ a: 5, b: 5, c: 5 }, 3);
    expect(three.get("a")).toBeCloseTo(1 / 3);
    expect(sum(three)).toBeCloseTo(1);
  });

  it("splits unequal scores proportionally, still summing to 1", () => {
    // The real figures from the two rounds that exposed the bug: both teams
    // were stored with marketShare 1.
    const s = shares({ a: 0.2935539580217671, b: 0.3689673586256974 }, 2);
    expect(sum(s)).toBeCloseTo(1);
    expect(s.get("a")).toBeCloseTo(0.44306, 4);
    expect(s.get("b")).toBeCloseTo(0.55694, 4);
    expect(s.get("b")!).toBeGreaterThan(s.get("a")!);
  });

  it("is unaffected by how many teams are configured", () => {
    // totalTeams is the BASE, not a scale factor — the split is identical.
    const scores = { a: 0.2935539580217671, b: 0.3689673586256974 };
    for (const roster of [2, 4, 40]) {
      const s = shares(scores, roster);
      expect(sum(s)).toBeCloseTo(1);
      expect(s.get("a")).toBeCloseTo(0.44306, 4);
    }
  });

  it("never lets a team exceed the whole market", () => {
    for (const s of [shares({ a: 1 }, 1), shares({ a: 900, b: 1 }, 2), shares({ a: 1, b: 1, c: 1 }, 1)]) {
      expect(sum(s)).toBeLessThanOrEqual(1 + 1e-9);
      for (const v of s.values()) expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("falls back to 1/totalTeams when every score is zero", () => {
    // Nothing to normalise against. The base is the CONFIGURED roster, so two
    // competitors out of four get a quarter each — not half.
    const s = shares({ a: 0, b: 0 }, 4);
    expect(s.get("a")).toBeCloseTo(0.25);
    expect(sum(s)).toBeCloseTo(0.5);

    const all = shares({ a: 0, b: 0, c: 0 }, 3);
    expect(all.get("a")).toBeCloseTo(1 / 3);
    expect(sum(all)).toBeCloseTo(1);
  });

  it("falls back to the competing count when the roster is missing or zero", () => {
    // Never zero shares — that would silently void the round.
    for (const roster of [undefined, 0, -3]) {
      const s = shares({ a: 0, b: 0 }, roster);
      expect(s.get("a")).toBeCloseTo(0.5);
      expect(sum(s)).toBeCloseTo(1);
    }
  });

  it("treats a negative or non-finite score as no contribution", () => {
    const s = shares({ a: 1, b: -5, c: NaN }, 3);
    expect(s.get("a")).toBeCloseTo(1);
    expect(s.get("b")).toBeCloseTo(0);
    expect(s.get("c")).toBeCloseTo(0);
    expect(sum(s)).toBeCloseTo(1);
  });

  it("returns nothing when no team competes", () => {
    expect(normaliseShares(new Map(), 4).size).toBe(0);
  });
});
