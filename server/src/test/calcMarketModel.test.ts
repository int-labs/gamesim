/**
 * Unit tests for the competitive scorer — the half of the engine that decides
 * who wins a round.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * It replaces `calculateScoresForAllTeams.test.ts`, which was the entire server
 * test suite and tested nothing at all: eight cases that built elaborate
 * fixtures, never imported or called any production code, and then asserted
 * `expect(expectedScores[0].totalScore).toBe(100)` against a literal defined
 * three lines above. The function it named does not exist anywhere in the
 * repo. It passed on every run and would have kept passing if `src/sim/` were
 * deleted.
 *
 * These tests call the real `calcMarketModel` and pin the behaviours that are
 * easy to "fix" by accident — most of all the market-share quirk, which looks
 * like a bug and is load-bearing.
 */
import mongoose from "mongoose";
import {
  calcMarketModel,
  type DecisionDocument,
  type MarketModelField,
  type MarketModelProduct,
  type ProductField,
} from "../sim/calcMarketModel";

const oid = () => new mongoose.Types.ObjectId();

const YEAR = 2024;
const YEAR_KEY = String(YEAR);

/** A numeric product field with sane defaults; override what a test cares about. */
function productField(over: Partial<ProductField> & { key: string }): ProductField {
  return {
    _id: oid(),
    label: over.key,
    type: "number",
    order: 0,
    required: false,
    minValue: null,
    maxValue: null,
    direction: 1,
    tightening: 3,
    coefficients: { [YEAR_KEY]: 1 },
    options: {},
    unitCost: null,
    ...over,
  };
}

/** The market-model side declares which fields compete; keys must match. */
function marketField(key: string, over: Partial<MarketModelField> = {}): MarketModelField {
  return { key, label: key, direction: 1, tightening: 3, coefficients: {}, ...over };
}

function mmProduct(
  productId: mongoose.Types.ObjectId,
  fields: MarketModelField[],
  over: Partial<MarketModelProduct> = {}
): MarketModelProduct {
  return { productId, fields, segmentFields: [], globalFields: [], ...over };
}

/** One team's submission: a value per field, keyed by the field's own _id. */
function decision(
  teamId: mongoose.Types.ObjectId,
  productId: mongoose.Types.ObjectId,
  values: Array<[ProductField, number | string | null]>
): DecisionDocument {
  return {
    teamId,
    inputs: [{ productId, fields: values.map(([f, value]) => ({ fieldId: f._id, value })) }],
  };
}

describe("calcMarketModel", () => {
  describe("when there is nothing to score", () => {
    it("returns empty output if no team submitted for this product", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("quality")]),
        productFields: [quality],
        // A decision exists, but for a different product.
        decisions: [decision(oid(), oid(), [[quality, 5]])],
        year: YEAR,
      });

      expect(out.weightedScores).toEqual([]);
      expect(out.sharesNormalCDF).toEqual([]);
    });

    it("skips a field whose coefficient for this year is zero or absent", () => {
      const productId = oid();
      const zeroed = productField({ key: "zeroed", coefficients: { [YEAR_KEY]: 0 } });
      const otherYear = productField({ key: "other_year", coefficients: { "2099": 1 } });
      const a = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [
          marketField("zeroed"),
          marketField("other_year"),
        ]),
        productFields: [zeroed, otherYear],
        decisions: [decision(a, productId, [[zeroed, 5], [otherYear, 5]])],
        year: YEAR,
      });

      expect(out.weightedScores).toEqual([]);
    });
  });

  describe("fields the scorer deliberately ignores", () => {
    // Documented in CLAUDE.md: these two are excluded from the scoring loop.
    // `selling_price` is priced by calcFinancials instead, and
    // `projected_market_share` is applied later as a multiplier, so scoring it
    // here would count it twice.
    it("never scores selling_price or projected_market_share", () => {
      const productId = oid();
      const price = productField({ key: "selling_price", type: "money" });
      const pms = productField({ key: "projected_market_share" });
      const quality = productField({ key: "quality" });
      const a = oid();
      const b = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [
          marketField("selling_price"),
          marketField("projected_market_share"),
          marketField("quality"),
        ]),
        productFields: [price, pms, quality],
        decisions: [
          decision(a, productId, [[price, 10], [pms, 0.5], [quality, 8]]),
          decision(b, productId, [[price, 90], [pms, 0.5], [quality, 2]]),
        ],
        year: YEAR,
      });

      expect(out.weightedScores.map((w) => w.fieldKey)).toEqual(["quality"]);
    });
  });

  describe("scoring", () => {
    it("ranks a higher value above a lower one when direction is 1", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });
      const better = oid();
      const worse = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("quality")]),
        productFields: [quality],
        decisions: [
          decision(better, productId, [[quality, 9]]),
          decision(worse, productId, [[quality, 1]]),
        ],
        year: YEAR,
      });

      const [contribution] = out.weightedScores;
      const scoreOf = (id: mongoose.Types.ObjectId) =>
        contribution.teamValues.find((t) => t.teamId.equals(id))!.score;

      expect(scoreOf(better)).toBeGreaterThan(scoreOf(worse));
    });

    // `direction` reads like "higher is better vs lower is better", but the
    // arithmetic is `directionOffset(d) + CDF * d`: at d = 0 that collapses to
    // a flat 0.5 for everyone, so the field stops discriminating entirely
    // rather than inverting. The console calls it "competitive weight".
    it("makes a field score identically for every team when direction is 0", () => {
      const productId = oid();
      const flat = productField({ key: "flat", direction: 0, coefficients: { [YEAR_KEY]: 4 } });
      const a = oid();
      const b = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("flat")]),
        productFields: [flat],
        decisions: [
          decision(a, productId, [[flat, 100]]),
          decision(b, productId, [[flat, 1]]),
        ],
        year: YEAR,
      });

      const scores = out.weightedScores[0].teamValues.map((t) => t.score);
      expect(scores[0]).toBeCloseTo(2, 10); // 0.5 offset × coefficient 4
      expect(scores[0]).toBe(scores[1]);
    });

    it("resolves an enum through its options map rather than the raw string", () => {
      const productId = oid();
      const tier = productField({
        key: "tier",
        type: "enum",
        options: { Standard: 1, Premium: 5 },
      });
      const premium = oid();
      const standard = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("tier")]),
        productFields: [tier],
        decisions: [
          decision(premium, productId, [[tier, "Premium"]]),
          decision(standard, productId, [[tier, "Standard"]]),
        ],
        year: YEAR,
      });

      const values = out.weightedScores[0].teamValues;
      const valueOf = (id: mongoose.Types.ObjectId) =>
        values.find((t) => t.teamId.equals(id))!.originalDecisionValue;

      expect(valueOf(premium)).toBe(5);
      expect(valueOf(standard)).toBe(1);
    });

    it("treats an unknown enum choice as zero rather than NaN", () => {
      const productId = oid();
      const tier = productField({ key: "tier", type: "enum", options: { Standard: 1 } });
      const a = oid();
      const b = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("tier")]),
        productFields: [tier],
        decisions: [
          decision(a, productId, [[tier, "Nonexistent"]]),
          decision(b, productId, [[tier, "Standard"]]),
        ],
        year: YEAR,
      });

      for (const t of out.weightedScores[0].teamValues) {
        expect(Number.isNaN(t.score)).toBe(false);
        expect(Number.isNaN(t.originalDecisionValue)).toBe(false);
      }
    });

    it("clamps a decision to the field's min and max instead of rejecting it", () => {
      const productId = oid();
      const bounded = productField({ key: "bounded", minValue: 10, maxValue: 20 });
      const tooLow = oid();
      const tooHigh = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("bounded")]),
        productFields: [bounded],
        decisions: [
          decision(tooLow, productId, [[bounded, -999]]),
          decision(tooHigh, productId, [[bounded, 999]]),
        ],
        year: YEAR,
      });

      const values = out.weightedScores[0].teamValues;
      const raw = (id: mongoose.Types.ObjectId) =>
        values.find((t) => t.teamId.equals(id))!.originalDecisionValue;

      // Clamped to 10 and 20, then scaled by the diminishing-returns factor.
      // That factor is `2 - exp(-z²/2)` against a mean of 15 and a σ of 2.5,
      // so both bounds sit at z = ±2 and share a factor of 2 - e⁻² ≈ 1.8647.
      const boundFactor = 2 - Math.exp(-2);
      expect(raw(tooLow)).toBeCloseTo(10 * boundFactor, 10);
      expect(raw(tooHigh)).toBeCloseTo(20 * boundFactor, 10);
    });

    it("gives every team the same flat coefficient for segment and global fields", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });
      const a = oid();
      const b = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("quality")], {
          segmentFields: [marketField("seg_bonus", { coefficients: { [YEAR_KEY]: 3 } })],
          globalFields: [marketField("glob_bonus", { coefficients: { [YEAR_KEY]: 7 } })],
        }),
        productFields: [quality],
        decisions: [
          decision(a, productId, [[quality, 9]]),
          decision(b, productId, [[quality, 1]]),
        ],
        year: YEAR,
      });

      const seg = out.weightedScores.find((w) => w.fieldKey === "seg_bonus")!;
      const glob = out.weightedScores.find((w) => w.fieldKey === "glob_bonus")!;

      expect(seg.teamValues.map((t) => t.score)).toEqual([3, 3]);
      expect(glob.teamValues.map((t) => t.score)).toEqual([7, 7]);
    });
  });

  describe("market share", () => {
    /**
     * ── THE ONE THAT LOOKS LIKE A BUG ───────────────────────────────────────
     * `sharesNormalCDF` is NOT a partition of the market. The competed share
     * (weightedScore / totalScore) does sum to 1, but it is then multiplied by
     * each team's own `projected_market_share`, itself normalised against an
     * equal slice AND passed through the diminishing-returns factor. Twelve
     * teams each declaring 1/12 of a 0–1 field come out summing to ~175%.
     *
     * The values still rank teams correctly, which is all the standings need —
     * but anyone "fixing" this to sum to 1 changes every historical result, and
     * anyone labelling it "% of the market" in the UI misleads a whole room.
     * The console calls the column "Strength" for exactly this reason.
     */
    it("sums to roughly 175% for twelve teams each declaring an equal slice", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });
      // The bounds are what make this bite: `getInput` runs every non-enum
      // field through the diminishing-returns factor, which is 1 only when a
      // field is unbounded. A declaration far from the midpoint of its range
      // therefore comes back inflated, and 1/12 is very far from 0.5.
      const pms = productField({
        key: "projected_market_share",
        minValue: 0,
        maxValue: 1,
      });
      // The model is calibrated for twelve teams — BASE_MARKET_SHARE is
      // 8.125%, noted in the design sheet as "divided by 12 teams".
      const teams = Array.from({ length: 12 }, () => oid());

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [
          marketField("quality"),
          marketField("projected_market_share"),
        ]),
        productFields: [quality, pms],
        decisions: teams.map((t, i) =>
          // Everyone declares an equal slice — the most "reasonable" input there is.
          decision(t, productId, [[quality, 5 + i], [pms, 1 / teams.length]])
        ),
        year: YEAR,
      });

      const total = out.sharesNormalCDF.reduce((sum, s) => sum + s.value, 0);
      expect(total).toBeGreaterThan(1.7);
      expect(total).toBeLessThan(1.8);
    });

    it("sums to exactly 1 only when projected_market_share is unbounded", () => {
      // The contrast case for the test above: with no min/max the
      // diminishing-returns factor is 1, the normalisation cancels out, and
      // the competed share passes through untouched. Which is why the quirk
      // reads as a data-shape property, not an arithmetic mistake.
      const productId = oid();
      const quality = productField({ key: "quality" });
      const pms = productField({ key: "projected_market_share" });
      const teams = [oid(), oid(), oid(), oid()];

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [
          marketField("quality"),
          marketField("projected_market_share"),
        ]),
        productFields: [quality, pms],
        decisions: teams.map((t, i) =>
          decision(t, productId, [[quality, 5 + i], [pms, 1 / teams.length]])
        ),
        year: YEAR,
      });

      const total = out.sharesNormalCDF.reduce((sum, s) => sum + s.value, 0);
      expect(total).toBeCloseTo(1, 10);
    });

    it("still orders teams the way their scores do", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });
      const pms = productField({ key: "projected_market_share" });
      const strong = oid();
      const weak = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [
          marketField("quality"),
          marketField("projected_market_share"),
        ]),
        productFields: [quality, pms],
        decisions: [
          decision(strong, productId, [[quality, 9], [pms, 0.5]]),
          decision(weak, productId, [[quality, 1], [pms, 0.5]]),
        ],
        year: YEAR,
      });

      const shareOf = (id: mongoose.Types.ObjectId) =>
        out.sharesNormalCDF.find((s) => s.teamId.equals(id))!.value;

      expect(shareOf(strong)).toBeGreaterThan(shareOf(weak));
    });

    it("caps a single team's share at 1 however large the declaration", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });
      const pms = productField({ key: "projected_market_share" });
      const greedy = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [
          marketField("quality"),
          marketField("projected_market_share"),
        ]),
        productFields: [quality, pms],
        decisions: [
          decision(greedy, productId, [[quality, 5], [pms, 100]]),
          decision(oid(), productId, [[quality, 5], [pms, 0]]),
        ],
        year: YEAR,
      });

      for (const s of out.sharesNormalCDF) {
        expect(s.value).toBeLessThanOrEqual(1);
        expect(s.value).toBeGreaterThanOrEqual(0);
      }
    });

    it("returns zero shares rather than NaN when every score cancels to zero", () => {
      const productId = oid();
      // direction 0 with coefficient 0 means nothing contributes any score.
      const inert = productField({ key: "inert", coefficients: { [YEAR_KEY]: 0 } });
      const a = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("inert")]),
        productFields: [inert],
        decisions: [decision(a, productId, [[inert, 5]])],
        year: YEAR,
      });

      expect(out.sharesNormalCDF).toHaveLength(1);
      expect(Number.isNaN(out.sharesNormalCDF[0].value)).toBe(false);
      expect(out.sharesNormalCDF[0].value).toBe(0);
    });
  });

  describe("robustness", () => {
    it("scores a team that omitted a field instead of throwing", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });
      const submitted = oid();
      const omitted = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [marketField("quality")]),
        productFields: [quality],
        decisions: [
          decision(submitted, productId, [[quality, 7]]),
          decision(omitted, productId, []), // submitted nothing for this field
        ],
        year: YEAR,
      });

      const values = out.weightedScores[0].teamValues;
      expect(values).toHaveLength(2);
      expect(values.every((t) => !Number.isNaN(t.score))).toBe(true);
    });

    it("ignores a market-model field with no matching product field", () => {
      const productId = oid();
      const quality = productField({ key: "quality" });
      const a = oid();

      const out = calcMarketModel({
        marketModelProduct: mmProduct(productId, [
          marketField("quality"),
          marketField("field_that_was_deleted"),
        ]),
        productFields: [quality],
        decisions: [decision(a, productId, [[quality, 5]])],
        year: YEAR,
      });

      expect(out.weightedScores.map((w) => w.fieldKey)).toEqual(["quality"]);
    });
  });
});
