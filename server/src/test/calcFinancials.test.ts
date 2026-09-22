/**
 * Unit tests for `calcFinancials` — the authoritative money path.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * calcFinancials had no coverage at all while it was rewritten to produce a
 * correct P&L (COGS on units SOLD rather than on the whole inventory build,
 * period costs moved below the gross-profit line, the holding charge removed
 * from the channel globalInput). Typecheck was the only verification.
 *
 * The suite is deliberately in two layers, because the first one alone is
 * worthless:
 *
 *   Layer A — INVARIANTS. Identities and bucket completeness. These are
 *     tautological: they pass even if the model yields three cents of revenue
 *     or if no strategy on earth turns a profit. They exist to catch a cost
 *     silently landing in neither bucket, which is exactly how the original
 *     bug hid.
 *
 *   Layer B — RESULTS. Whether the thing actually works as a game: does every
 *     lever move its number the direction the UI promises, is a well-played
 *     round at or above breakeven, and do the degenerate cases behave.
 *
 * Assertions are RELATIONAL wherever possible (`COGS === unitsSold * cost`)
 * rather than pinned to literals, so retuning the operator's config does not
 * turn the suite red for no reason. Monotonicity tests compare two runs that
 * differ in exactly one input, so they carry no magnitude expectations at all.
 */
import mongoose from "mongoose";
import {
  calcFinancials,
  readCostTreatment,
  toProjectionMetrics,
  type BaseVariables,
  type CalcFinancialsInput,
  type DecisionGlobalInputEntry,
  type ProductField,
} from "../sim/calcFinancials";
import { SELLING_PRICE_KEY } from "../constants/impacts";

const oid = () => new mongoose.Types.ObjectId();

const PRODUCT_ID = oid();
const TEAM_ID = oid();
const AVAILABLE_MARKET = 10_000;

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A product field with sane defaults; override what a test cares about. */
function field(over: Partial<ProductField> & { key: string }): ProductField {
  return {
    _id: oid(),
    label: over.key,
    type: "money",
    order: 0,
    required: false,
    minValue: 0,
    maxValue: 10,
    direction: 1,
    tightening: 3,
    coefficients: {},
    options: {},
    unitCost: null,
    ...over,
  };
}

/**
 * A globalInput entry as it arrives AFTER `readCostTreatment` has normalised
 * it — which is the only shape calcFinancials ever sees, by design.
 */
function gi(
  over: Partial<DecisionGlobalInputEntry> & { category: string },
): DecisionGlobalInputEntry {
  return {
    globalInputItemId: oid(),
    key: over.category,
    label: over.category,
    selectedStepKey: null,
    options: {},
    impacts: {},
    impactLevel: null,
    cost: 0,
    costTreatment: { cogs: 0, opex: 0 },
    energy: 0,
    productsImpacted: [],
    ...over,
  };
}

interface ScenarioOpts {
  /** What the team charges. 0 ⇒ productScore 0 ⇒ no customers. */
  sellingPrice?: number;
  /** Raw value on the cost-bearing field; unit cost scales off it. */
  materialValue?: number;
  /** `unitCost` on the cost-bearing field. */
  materialUnitCost?: number;
  marketShare?: number;
  globalInputs?: DecisionGlobalInputEntry[];
  baseVariables?: Partial<BaseVariables>;
  /** Units the team commits to producing. Omitted ⇒ null ⇒ ZERO: production is
   *  a decision, not a default. Pass Number.MAX_SAFE_INTEGER to mean "to the
   *  ceiling": calcFinancials clamps it. */
  produced?: number;
  /** Units carried in from the previous round's closing stock. */
  openingStock?: number;
}

/**
 * One product, one team, one cost field, one price field. Returns the full
 * calcFinancials input so a test can vary a single knob and diff the results.
 */
function scenario(opts: ScenarioOpts = {}): CalcFinancialsInput {
  const {
    sellingPrice = 12,
    materialValue = 1,
    materialUnitCost = 0.5,
    marketShare = 0.2,
    globalInputs = [],
    baseVariables = {},
    produced,
    openingStock,
  } = opts;

  const priceField = field({ key: SELLING_PRICE_KEY, minValue: 1, maxValue: 30 });
  const qualityField = field({ key: "quality" });
  const materialField = field({ key: "material", unitCost: materialUnitCost });

  const productFields = [priceField, qualityField, materialField];

  return {
    productId: PRODUCT_ID,
    marketShares: [{ teamId: TEAM_ID, value: marketShare }],
    productFields,
    decisions: [
      {
        teamId: TEAM_ID,
        inputs: [
          {
            productId: PRODUCT_ID,
            produced: produced ?? null,
            fields: [
              { fieldId: priceField._id, value: sellingPrice },
              { fieldId: qualityField._id, value: 4 },
              { fieldId: materialField._id, value: materialValue },
            ],
          },
        ],
        // Selecting every configured input: getGlobalInputQuantity matches on
        // globalInputItemId, so the same entry object serves as both the
        // available config and the team's selection.
        globalInputs,
      },
    ],
    globalInputs,
    baseVariables: { availableMarket: AVAILABLE_MARKET, ...baseVariables },
    ...(openingStock != null
      ? { openingStock: { [TEAM_ID.toString()]: openingStock } }
      : {}),
  };
}

const run = (opts: ScenarioOpts = {}) => calcFinancials(scenario(opts)).results[0];

const sumTreatment = (
  incurred: { treatment: "cogs" | "opex"; incurredCost: number }[],
  t: "cogs" | "opex",
) => incurred.filter((e) => e.treatment === t).reduce((a, e) => a + e.incurredCost, 0);

/** Every cost row, both shapes. The COGS/opex totals are only whole across the
 *  two arrays — unit-charged rows in one, globalInput spend in the other. */
const allCosts = (r: { incurredCosts: any[]; globalInputCosts: any[] }) =>
  [...r.incurredCosts, ...r.globalInputCosts];

// ─── Layer A — invariants ────────────────────────────────────────────────────

describe("calcFinancials · Layer A — invariants", () => {
  it("holds the sheet identities", () => {
    const r = run();
    expect(r.grossProfit).toBeCloseTo(r.revenue - r.COGS);
    expect(r.operatingProfit).toBeCloseTo(r.grossProfit - r.operatingExpenses);
  });

  it("books every incurred cost to exactly one side of the line", () => {
    // The assertion that catches a future cost landing in NEITHER bucket.
    const r = run({
      globalInputs: [
        gi({ category: "Marketing", costTreatment: { cogs: 0, opex: 40 } }),
        gi({ category: "Hiring", costTreatment: { cogs: 25, opex: 0 } }),
        gi({ category: "Mixed", costTreatment: { cogs: 10, opex: 15 } }),
      ],
    });

    expect(sumTreatment(allCosts(r), "cogs")).toBeCloseTo(r.COGS);
    expect(sumTreatment(allCosts(r), "opex")).toBeCloseTo(r.operatingExpenses);
  });

  it("splits a category spanning both sides into two breakdown entries", () => {
    const r = run({
      globalInputs: [gi({ category: "Hiring", costTreatment: { cogs: 30, opex: 12 } })],
    });
    const hiring = r.globalInputCosts.filter((e) => e.category === "Hiring");

    expect(hiring).toHaveLength(2);
    expect(hiring.find((e) => e.treatment === "cogs")?.incurredCost).toBeCloseTo(30);
    expect(hiring.find((e) => e.treatment === "opex")?.incurredCost).toBeCloseTo(12);
  });

  it("never emits a zero-value breakdown entry", () => {
    const r = run({
      globalInputs: [gi({ category: "Marketing", costTreatment: { cogs: 0, opex: 40 } })],
    });
    const marketing = r.globalInputCosts.filter((e) => e.category === "Marketing");

    expect(marketing).toHaveLength(1);
    expect(marketing[0].treatment).toBe("opex");
  });
});

// ─── Layer A — the regression this rewrite existed to fix ────────────────────

describe("calcFinancials · COGS is charged on units PRODUCED", () => {
  it("charges the build, not the sale", () => {
    const r = run();
    expect(r.COGS).toBeCloseTo(r.produced * r.dynamicCost);
  });

  it("never produces more than the ceiling allows", () => {
    const r = run({ produced: Number.MAX_SAFE_INTEGER });
    expect(r.produced).toBe(r.inventoryQty);
  });

  it("produces NOTHING when no target is stated", () => {
    // Production is a decision, not a default. Half the ceiling used to be
    // handed out unrequested, billing COGS for units the team never planned.
    const r = run();
    expect(r.produced).toBe(0);
    expect(r.COGS).toBe(0);
  });

  it("sells carried stock with no additional COGS", () => {
    // Same decisions and costs — only opening stock differs. Revenue rises with
    // the extra units sold; COGS does not move, because those units were
    // expensed in the round that built them.
    const base    = run({ produced: 100 });
    const carried = run({ produced: 100, openingStock: 500 });

    expect(carried.unitsSold).toBeGreaterThan(base.unitsSold);
    expect(carried.COGS).toBeCloseTo(base.COGS);
    expect(carried.revenue).toBeGreaterThan(base.revenue);
  });

  it("carries the unsold remainder forward", () => {
    const r = run({ produced: 100, openingStock: 50 });
    // Rounded, because `customersObtained` — and therefore `unitsSold` — is
    // fractional while stock is whole units.
    expect(r.closingStock).toBe(Math.round(Math.max(0, 50 + r.produced - r.unitsSold)));
  });

  it("leaves revenue arithmetically unchanged from the old clamp", () => {
    // Old code: customersObtained > inventoryQty ? inventoryQty * price
    //                                            : customersObtained * price
    // New code: unitsSold * price, where unitsSold = min(customers, inventory).
    const r = run({ sellingPrice: 12 });
    expect(r.revenue).toBeCloseTo(r.unitsSold * r.sellingPrice);
  });

  it("bills a produced unit once — the COGS entry carries the build", () => {
    const r = run();
    const cogsEntry = r.incurredCosts.find((e) => e.key === "inventory");

    expect(cogsEntry?.inputQty).toBe(Math.round(r.produced));
  });

  it("charges NOTHING on stock that did not sell", () => {
    // The whole cost of an unsold unit is its COGS, recognised on the build.
    // There is no second charge on what it left behind — no `holding` entry
    // exists, and nothing else may key off `closingStock`.
    const r = run({ produced: Number.MAX_SAFE_INTEGER });

    expect(r.closingStock).toBeGreaterThan(0);
    expect(r.incurredCosts.find((e) => e.key === "holding")).toBeUndefined();
    expect(r.incurredCosts.some((e) => e.leftover > 0)).toBe(false);
  });
});

// ─── Layer B1 — monotonicity: does each lever move its number? ───────────────

describe("calcFinancials · Layer B1 — every lever moves the promised direction", () => {
  it("lower unit cost ⇒ higher gross profit", () => {
    // Both build to the ceiling: with no stated target nothing is produced, and
    // a zero build has no COGS to tell apart.
    const cheap = run({ materialUnitCost: 0.2, produced: Number.MAX_SAFE_INTEGER });
    const dear = run({ materialUnitCost: 2.0, produced: Number.MAX_SAFE_INTEGER });

    expect(cheap.dynamicCost).toBeLessThan(dear.dynamicCost);
    expect(cheap.grossProfit).toBeGreaterThan(dear.grossProfit);
  });

  it("a customersObtained impact ⇒ more customers", () => {
    const without = run();
    const with_ = run({
      globalInputs: [
        gi({
          category: "Marketing",
          costTreatment: { cogs: 0, opex: 10 },
          impacts: { marketing: { type: "relative", value: 0.5 } },
        }),
      ],
    });

    expect(with_.customersObtained).toBeGreaterThan(without.customersObtained);
  });

  it("higher market share ⇒ proportionally more customers", () => {
    const small = run({ marketShare: 0.1 });
    const big = run({ marketShare: 0.4 });

    expect(big.customersObtained).toBeGreaterThan(small.customersObtained);
  });

  it("a dynamic_cost impact reduces unit cost", () => {
    const without = run();
    const with_ = run({
      globalInputs: [
        gi({
          category: "SupplyChain",
          costTreatment: { cogs: 0, opex: 5 },
          impacts: { dynamic_cost: { type: "relative", value: 0.3 } },
        }),
      ],
    });

    expect(with_.dynamicCost).toBeLessThan(without.dynamicCost);
  });
});

// ─── Layer B1b — the per-product override ────────────────────────────────────
//
// `impacts[k].selections[]` carries a multiplier keyed by productId: 0.5 halves
// that impact for that product. The operator's admin client has always written
// it and the GlobalInput validator has always accepted it, but calcFinancials
// never read it — so every configured override moved no number at all. These
// tests are what keep it wired.

describe("calcFinancials · Layer B1b — per-product impact overrides", () => {
  const vendor = (selections?: Array<{ productId: unknown; value: number }>) =>
    gi({
      category: "SupplyChain",
      costTreatment: { cogs: 0, opex: 0 },
      impacts: { inventory: { type: "relative", value: 0.5, selections } },
    });

  it("halves an impact for the product it names", () => {
    const full = run({ globalInputs: [vendor()] });
    const halved = run({
      globalInputs: [vendor([{ productId: PRODUCT_ID, value: 0.5 }])],
    });

    // Same decision, same everything — only the override differs, so the
    // capacity the impact augments must come out strictly lower.
    expect(halved.inventoryQty).toBeLessThan(full.inventoryQty);
  });

  it("leaves a product the override does not name untouched", () => {
    const full = run({ globalInputs: [vendor()] });
    const otherProduct = run({
      globalInputs: [vendor([{ productId: oid(), value: 0.5 }])],
    });

    expect(otherProduct.inventoryQty).toBeCloseTo(full.inventoryQty);
  });

  it("treats a RELATIVE override of 1 as no override", () => {
    const full = run({ globalInputs: [vendor()] });
    const neutral = run({
      globalInputs: [vendor([{ productId: PRODUCT_ID, value: 1 }])],
    });

    expect(neutral.inventoryQty).toBeCloseTo(full.inventoryQty);
  });

  it("a RELATIVE override of 0 cancels the impact entirely", () => {
    const none = run();
    const cancelled = run({
      globalInputs: [vendor([{ productId: PRODUCT_ID, value: 0 }])],
    });

    // A zeroed multiplier must land exactly where having no vendor at all lands.
    expect(cancelled.inventoryQty).toBeCloseTo(none.inventoryQty);
  });

  // ── absolute impacts: the override ADDS, it does not scale ────────────────
  //
  // These are the cases the first cut of this feature got wrong. It multiplied
  // both types, so an override of 0.5 on a flat quantity of 11.8 silently
  // became 5.90 instead of 12.3. Every test above passed regardless, because
  // they all exercise `relative` impacts.
  //
  // They used to ride on `inventory_cost`, the only key IMPACT_CONFIG declared
  // `via: "absolute"`. That impact is gone (2026-09-17, with the holding
  // charge), but the RULE it happened to demonstrate is not: `impactValue`
  // dispatches on the DOCUMENT's `impact.type`, not on the key, so ANY impact
  // an operator authors `absolute` takes this path — the console lets them type
  // any metric key and pick relative/absolute per impact.
  //
  // Re-pinned to `sales_channel`, deliberately: it is a key the live config
  // actually authors, so this fixture is a real shape rather than a key chosen
  // to suit the test. (`inventory` would have been the closer swap and is the
  // wrong one — nothing authors it either, which is how the previous version
  // ended up pinned to a lever that did not exist.)

  const absChannel = (
    value: number,
    selections?: Array<{ productId: unknown; value: number }>,
  ) =>
    gi({
      category: "Channels",
      costTreatment: { cogs: 0, opex: 0 },
      impacts: { sales_channel: { type: "absolute", value, selections } },
    });

  it("ADDS an absolute override to the base quantity", () => {
    const base = run({ globalInputs: [absChannel(0.5)] });
    const raised = run({
      globalInputs: [absChannel(0.5, [{ productId: PRODUCT_ID, value: 0.5 }])],
    });
    // 0.5 + 0.5 ⇒ a LARGER augmentation, so more customers. Under the old
    // multiply rule this was 0.5 × 0.5 = 0.25 and the figure went DOWN.
    expect(raised.customersObtained).toBeGreaterThan(base.customersObtained);
  });

  it("lets a negative absolute override reduce the quantity", () => {
    const base = run({ globalInputs: [absChannel(0.5)] });
    const cut = run({
      globalInputs: [absChannel(0.5, [{ productId: PRODUCT_ID, value: -0.25 }])],
    });
    expect(cut.customersObtained).toBeLessThan(base.customersObtained);
  });

  it("treats an ABSOLUTE override of 0 as no override", () => {
    const base = run({ globalInputs: [absChannel(0.5)] });
    const neutral = run({
      globalInputs: [absChannel(0.5, [{ productId: PRODUCT_ID, value: 0 }])],
    });
    // 0 is the additive identity — the opposite of the relative case, where 0
    // cancels. This pair is what pins the two rules apart.
    expect(neutral.customersObtained).toBeCloseTo(base.customersObtained);
  });

  it("leaves an absolute impact alone for a product the override does not name", () => {
    const base = run({ globalInputs: [absChannel(0.5)] });
    const other = run({
      globalInputs: [absChannel(0.5, [{ productId: oid(), value: 100 }])],
    });
    expect(other.customersObtained).toBeCloseTo(base.customersObtained);
  });

  it("scales a dynamic_cost impact too, not just inventory", () => {
    const build = (selections?: Array<{ productId: unknown; value: number }>) =>
      run({
        globalInputs: [
          gi({
            category: "SupplyChain",
            costTreatment: { cogs: 0, opex: 0 },
            impacts: { dynamic_cost: { type: "relative", value: 0.4, selections } },
          }),
        ],
      });

    const full = build();
    const halved = build([{ productId: PRODUCT_ID, value: 0.5 }]);

    // A weaker cost reduction ⇒ a HIGHER unit cost than the full one, but still
    // below the un-augmented baseline.
    expect(halved.dynamicCost).toBeGreaterThan(full.dynamicCost);
    expect(halved.dynamicCost).toBeLessThan(run().dynamicCost);
  });

  it("stays monotonic across a range of override values", () => {
    const qtyFor = (value: number) =>
      run({ globalInputs: [vendor([{ productId: PRODUCT_ID, value }])] }).inventoryQty;

    const series = [0, 0.25, 0.5, 0.75, 1].map(qtyFor);
    for (let i = 1; i < series.length; i++) {
      expect(series[i]).toBeGreaterThan(series[i - 1]);
    }
  });
});

// ─── Layer B2 — playability ──────────────────────────────────────────────────

describe("calcFinancials · Layer B2 — the game is playable", () => {
  it("a well-played round lands at or above breakeven", () => {
    // Sensible price, low unit cost, one marketing input — AND production
    // matched to demand. Matching is what "well played" MEANS now: under
    // COGS-on-production, stock nobody buys is expensed in the round that built
    // it, so this cannot be asserted without stating a target. If this fails the
    // game is unwinnable no matter what the player does.
    const base = run({ sellingPrice: 14, materialValue: 1, materialUnitCost: 0.3 });

    const r = run({
      sellingPrice: 14,
      materialValue: 1,
      materialUnitCost: 0.3,
      produced: Math.floor(base.customersObtained),
      globalInputs: [
        gi({
          category: "Marketing",
          costTreatment: { cogs: 0, opex: 25 },
          impacts: { marketing: { type: "relative", value: 0.4 } },
        }),
      ],
    });

    expect(r.operatingProfit).toBeGreaterThanOrEqual(0);
  });

  it("overproducing is strictly worse than matching demand", () => {
    // THE INVARIANT — relational, deliberately not pinned to a sign. A glut can
    // still be PROFITABLE at a luxury price: few buyers, high margin, and that
    // is good pricing rather than a failure. What must always hold is that units
    // nobody bought cost money — they add COGS (expensed on production) and add
    // no revenue. Retuning INVENTORY_BASE or the margin cannot redden this.
    //
    // COGS is now the WHOLE penalty. This test used to add an `inventory_cost`
    // impact and assert opex rose too; with the holding charge gone the glut's
    // opex is identical (consignment is on units SOLD, which is unchanged) and
    // the invariant rests entirely on the build — which is the point of
    // recognising cost on production.
    const opts = {
      sellingPrice: 14,
      materialValue: 1,
      materialUnitCost: 0.3,
    };
    const demand = run(opts).customersObtained;
    // CEIL, not floor: `customersObtained` is fractional, so flooring would
    // leave `matched` production-limited and selling marginally LESS than the
    // glut — which would make the revenue comparison below fail for a reason
    // that has nothing to do with overproduction.
    const matched = run({ ...opts, produced: Math.ceil(demand) });
    const glut    = run({ ...opts, produced: Number.MAX_SAFE_INTEGER });

    expect(glut.produced).toBe(glut.inventoryQty);
    expect(glut.revenue).toBeCloseTo(matched.revenue);                     // extra units did not sell
    expect(glut.COGS).toBeGreaterThan(matched.COGS);                       // but were built
    expect(glut.operatingExpenses).toBeCloseTo(matched.operatingExpenses); // and cost nothing to keep
    expect(glut.operatingProfit).toBeLessThan(matched.operatingProfit);
  });

  it("a badly-played round lands below breakeven", () => {
    // Thin margin AND a glut — the combination the inventory lesson is about.
    // If this passes at >= 0, a bad decision is survivable and the lesson is
    // absent from the model.
    const r = run({
      sellingPrice: 6,
      materialValue: 1,
      materialUnitCost: 4,
      produced: Number.MAX_SAFE_INTEGER,
    });

    expect(r.operatingProfit).toBeLessThan(0);
  });

  it("a strictly dominated decision yields strictly worse profit", () => {
    const base = run({ materialUnitCost: 0.4, produced: Number.MAX_SAFE_INTEGER });
    // same everything, costlier
    const dominated = run({ materialUnitCost: 1.2, produced: Number.MAX_SAFE_INTEGER });

    expect(dominated.operatingProfit).toBeLessThan(base.operatingProfit);
  });

  it("never obtains more customers than the market holds", () => {
    const r = run({ marketShare: 1, sellingPrice: 1 });
    expect(r.customersObtained).toBeLessThanOrEqual(AVAILABLE_MARKET);
  });

  it("produces finite numbers for every figure, on empty inputs", () => {
    const r = calcFinancials({
      productId: PRODUCT_ID,
      marketShares: [{ teamId: TEAM_ID, value: 0 }],
      productFields: [],
      decisions: [],
      globalInputs: [],
      baseVariables: { availableMarket: 0 },
    }).results[0];

    for (const v of [
      r.customersObtained, r.dynamicCost, r.dynamicPrice, r.unitsSold,
      r.revenue, r.COGS, r.grossProfit, r.operatingExpenses, r.operatingProfit,
      r.productScore, r.csatScore, r.sellingPrice,
    ]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

// ─── Layer B3 — degenerate boundaries ────────────────────────────────────────

describe("calcFinancials · Layer B3 — degenerate cases", () => {
  it("charges operating expenses even when nothing sells", () => {
    // Price 0 ⇒ productScore 0 ⇒ no customers ⇒ no revenue. Fixed costs still
    // bite, which is a real game rule: standing still is not free.
    const r = run({
      sellingPrice: 0,
      produced: Number.MAX_SAFE_INTEGER,
      globalInputs: [gi({ category: "Marketing", costTreatment: { cogs: 0, opex: 40 } })],
    });

    expect(r.customersObtained).toBe(0);
    expect(r.revenue).toBe(0);
    // COGS is NOT zero: the team still produced. Under COGS-on-production, a
    // round that sells nothing has expensed its whole build — which is the
    // point. The previous assertion of 0 encoded COGS-on-sale.
    expect(r.COGS).toBeCloseTo(r.produced * r.dynamicCost);
    expect(r.COGS).toBeGreaterThan(0);
    expect(r.operatingExpenses).toBeGreaterThan(0);
    expect(r.operatingProfit).toBeLessThan(0);
  });

  // Renamed from "treats the entire build as leftover when no one buys": under
  // COGS-on-production the build is a COST here, not merely idle stock.
  it("expenses the whole build when nothing sells", () => {
    const r = run({ sellingPrice: 0 });

    expect(r.unitsSold).toBe(0);
    // The build is the ENTIRE charge. Every unit is carried forward, and
    // carrying costs nothing — so opex owes nothing to the leftovers.
    expect(r.COGS).toBeCloseTo(r.produced * r.dynamicCost);
    expect(r.closingStock).toBe(Math.round(r.produced));
    expect(r.operatingExpenses).toBeCloseTo(0);
  });
});

// ─── toProjectionMetrics — the shape both writers share ─────────────────────

describe("toProjectionMetrics", () => {
  it("returns the capacity the frontend reads as its produce ceiling", () => {
    const r = run();
    expect(r.inventoryQty).toBeGreaterThan(0);
    expect(toProjectionMetrics(r).inventoryQty).toBe(r.inventoryQty);
  });

  it("carries every money figure on TeamFinancials", () => {
    // Adding a field to the sheet and forgetting the writer fails here, which
    // is the whole reason the two write sites share one function.
    const metrics = toProjectionMetrics(run());
    const required = [
      "customersObtained", "sellingPrice", "dynamicPrice", "productScore",
      "dynamicCost", "inventoryQty", "produced", "closingStock", "unitsSold", "revenue", "COGS",
      "grossProfit", "operatingExpenses", "operatingProfit",
      "productCostBreakdown", "incurredCosts", "globalInputCosts",
    ];

    expect(Object.keys(metrics).sort()).toEqual(required.sort());
  });

  it("omits marketShare so a what-if cannot overwrite a competed share", () => {
    expect(toProjectionMetrics(run())).not.toHaveProperty("marketShare");
  });
});

// ─── readCostTreatment — the single interpreter both paths share ─────────────

describe("readCostTreatment", () => {
  it("reads a legacy flat cost as a period cost", () => {
    // Pre-change decisions carry `cost` and no treatment. Booking them to opex
    // restates what the old code did with them rather than rewriting history.
    expect(readCostTreatment({ cost: 40 })).toEqual({ cogs: 0, opex: 40 });
  });

  it("prefers an explicit treatment over the legacy total", () => {
    expect(readCostTreatment({ cost: 999, costTreatment: { cogs: 10, opex: 5 } }))
      .toEqual({ cogs: 10, opex: 5 });
  });

  it("tolerates a partial treatment", () => {
    expect(readCostTreatment({ costTreatment: { cogs: 7 } })).toEqual({ cogs: 7, opex: 0 });
  });

  it("yields zeros for an entry with neither field", () => {
    expect(readCostTreatment({})).toEqual({ cogs: 0, opex: 0 });
  });

  it("routes a legacy cost entirely below the gross-profit line", () => {
    const r = run({
      globalInputs: [gi({ category: "Legacy", costTreatment: readCostTreatment({ cost: 60 }) })],
    });

    expect(sumTreatment(allCosts(r), "opex")).toBeGreaterThanOrEqual(60);
  });
});

// ─── The seeds, now per-product config ──────────────────────────────────────

describe("calcFinancials · per-product seed overrides", () => {
  it("honours baseVariables.customersObtainedBase over the 0.3 default", () => {
    const def = run();
    const doubled = run({ baseVariables: { customersObtainedBase: 0.6 } });

    expect(doubled.customersObtained).toBeGreaterThan(def.customersObtained);
  });

  it("honours baseVariables.dynamicPriceBase over the 0.55 default", () => {
    const def = run();
    const shifted = run({ baseVariables: { dynamicPriceBase: 1.0 } });

    // The augmented dynamic price is the bell curve's centre, so moving it
    // moves productScore for a fixed selling price.
    expect(shifted.productScore).not.toBeCloseTo(def.productScore);
  });

  it("falls back to the documented defaults when baseVariables omits them", () => {
    const bare = run();
    const explicit = run({
      baseVariables: { customersObtainedBase: 0.3, dynamicPriceBase: 0.55 },
    });

    expect(bare.customersObtained).toBeCloseTo(explicit.customersObtained);
    expect(bare.productScore).toBeCloseTo(explicit.productScore);
  });
});

// ─── Layer C — DECLINED levers ───────────────────────────────────────────────
//
// THE GAP THE REST OF THE SUITE CANNOT REACH. `scenario()` hands the SAME array
// to the config and to the team's selection, so every test above plays a team
// that chose every configured lever. "Configured but not selected" was
// therefore inexpressible — and that is exactly the state a real bug lived in:
//
//   const m = hasOptions ? getGlobalInputQuantity(...) : 1;
//
// For a BINARY lever (no `options`) the ternary discarded the resolver's 0 and
// substituted 1, because `hasOptions === false` cannot distinguish "binary and
// chosen" from "binary and absent". Every declined binary lever was charged at
// full cost and had all of its impacts applied. Channels are binary, so this
// moved real money. Fixed 2026-09-22 by deleting the ternary; these tests are
// what would have caught it.
//
// ABSENCE IS THE "NO": the player client submits only the levers it chose, so a
// declined one has no entry at all. See services/reportMatrix (`!sel → "No"`).

describe("calcFinancials · Layer C — declined levers", () => {
  /** Config and selection kept SEPARATE, which `scenario()` deliberately does
   *  not do. `selected` is what the team actually submitted. */
  function withLevers(
    config: DecisionGlobalInputEntry[],
    selected: DecisionGlobalInputEntry[],
  ) {
    const input = scenario({ globalInputs: config });
    input.decisions[0].globalInputs = selected;
    return calcFinancials(input).results[0];
  }

  /** Binary: no `options`, so presence alone is the selection. */
  const binaryCost = (): DecisionGlobalInputEntry =>
    gi({ category: "channel", options: {}, cost: 40, costTreatment: { cogs: 0, opex: 40 } });

  /** Stepped: `options` maps each step to its multiplier. */
  const steppedCost = (): DecisionGlobalInputEntry =>
    gi({
      category: "hiring",
      options: { low: 0.5, high: 1 },
      cost: 100,
      costTreatment: { cogs: 0, opex: 100 },
      selectedStepKey: "high",
    });

  it("charges NOTHING for a binary lever the team declined", () => {
    const lever = binaryCost();
    const declined = withLevers([lever], []);

    // The regression: this read 40 while the ternary stood.
    expect(sumTreatment(allCosts(declined), "opex")).toBe(0);
    expect(declined.globalInputCosts).toHaveLength(0);
  });

  it("still charges the same binary lever when the team DID select it", () => {
    // The control. Without it the test above passes for a build that charges
    // nothing ever, which would be a different bug with the same green tick.
    const lever = binaryCost();
    const chosen = withLevers([lever], [lever]);

    expect(sumTreatment(allCosts(chosen), "opex")).toBeCloseTo(40);
  });

  it("applies NO IMPACT from a binary lever the team declined", () => {
    // Covers the OTHER call site — the impacts loop, not the cost loop. A
    // `dynamic_cost` impact at multiplier 1 would have cut unit cost by 20% for
    // a lever nobody chose.
    const lever = gi({
      category: "channel",
      options: {},
      impacts: { dynamic_cost: { type: "relative", value: 0.2 } },
    });

    const declined = withLevers([lever], []);
    const noLeverAtAll = withLevers([], []);

    expect(declined.dynamicCost).toBeCloseTo(noLeverAtAll.dynamicCost);
  });

  it("charges nothing for a STEPPED lever the team declined", () => {
    // This path was always correct — `options[undefined] ?? 0` resolves to 0 —
    // but pinning it stops a future "fix" from routing both kinds through the
    // binary rule.
    const lever = steppedCost();
    const declined = withLevers([lever], []);

    expect(sumTreatment(allCosts(declined), "opex")).toBe(0);
  });

  it("scales a stepped lever by its selected step", () => {
    const lever = steppedCost();
    const half = withLevers([lever], [{ ...lever, selectedStepKey: "low" }]);
    const full = withLevers([lever], [{ ...lever, selectedStepKey: "high" }]);

    expect(sumTreatment(allCosts(half), "opex")).toBeCloseTo(50);
    expect(sumTreatment(allCosts(full), "opex")).toBeCloseTo(100);
  });

  it("charges nothing for a stepped lever whose step key is not configured", () => {
    // An unknown key collapses the entry rather than guessing a multiplier — a
    // frontend-invented key must not silently bill the team at full rate.
    const lever = steppedCost();
    const bogus = withLevers([lever], [{ ...lever, selectedStepKey: "enormous" }]);

    expect(sumTreatment(allCosts(bogus), "opex")).toBe(0);
  });
});
