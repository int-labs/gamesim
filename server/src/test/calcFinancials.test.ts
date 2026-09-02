/**
 * Unit tests for `calcFinancials` — the authoritative money path.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * calcFinancials had no coverage at all while it was rewritten to produce a
 * correct P&L (COGS on units SOLD rather than on the whole inventory build,
 * period costs moved below the gross-profit line, `inventory_cost` wired up
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
  /** Units the team commits to producing. Omitted ⇒ null ⇒ the sim's default of
   *  half the ceiling. Pass Number.MAX_SAFE_INTEGER to mean "to the ceiling":
   *  calcFinancials clamps it. */
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

    expect(sumTreatment(r.incurredCosts, "cogs")).toBeCloseTo(r.COGS);
    expect(sumTreatment(r.incurredCosts, "opex")).toBeCloseTo(r.operatingExpenses);
  });

  it("splits a category spanning both sides into two breakdown entries", () => {
    const r = run({
      globalInputs: [gi({ category: "Hiring", costTreatment: { cogs: 30, opex: 12 } })],
    });
    const hiring = r.incurredCosts.filter((e) => e.category === "Hiring");

    expect(hiring).toHaveLength(2);
    expect(hiring.find((e) => e.treatment === "cogs")?.incurredCost).toBeCloseTo(30);
    expect(hiring.find((e) => e.treatment === "opex")?.incurredCost).toBeCloseTo(12);
  });

  it("never emits a zero-value breakdown entry", () => {
    const r = run({
      globalInputs: [gi({ category: "Marketing", costTreatment: { cogs: 0, opex: 40 } })],
    });
    const marketing = r.incurredCosts.filter((e) => e.category === "Marketing");

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

  it("defaults to half the ceiling when no target is stated", () => {
    // The same figure the production planner displays, so a team that never
    // touched the slider is scored on what it was shown.
    const r = run();
    expect(r.produced).toBe(Math.floor(r.inventoryQty * 0.5));
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
    const holding = r.incurredCosts.find((e) => e.key === "holding");

    expect(cogsEntry?.inputQty).toBe(Math.round(r.produced));
    // Holding is charged on what is CARRIED, not on the whole build.
    expect(holding?.leftover).toBe(r.closingStock);
  });
});

// ─── Layer B1 — monotonicity: does each lever move its number? ───────────────

describe("calcFinancials · Layer B1 — every lever moves the promised direction", () => {
  it("lower unit cost ⇒ higher gross profit", () => {
    const cheap = run({ materialUnitCost: 0.2 });
    const dear = run({ materialUnitCost: 2.0 });

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

  it("a non-zero inventory_cost ⇒ strictly higher operating expenses", () => {
    // This is the impact that IMPACT_CONFIG had no entry for, so calcFinancials
    // silently discarded it. Without this test, wiring it up is unobservable.
    const free = run({
      globalInputs: [
        gi({
          category: "Channels",
          costTreatment: { cogs: 0, opex: 0 },
          impacts: { inventory_cost: { type: "absolute", value: 0 } },
        }),
      ],
    });
    const charged = run({
      globalInputs: [
        gi({
          category: "Channels",
          costTreatment: { cogs: 0, opex: 0 },
          impacts: { inventory_cost: { type: "absolute", value: 11.8 } },
        }),
      ],
    });

    expect(charged.operatingExpenses).toBeGreaterThan(free.operatingExpenses);
    expect(charged.operatingProfit).toBeLessThan(free.operatingProfit);
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
  // both types, so an override of 0.5 on the operator's flat 11.8 per-unit
  // holding cost silently became 5.90 instead of 12.3. Every test above passed
  // regardless, because they all exercise `relative` impacts.

  const holding = (
    value: number,
    selections?: Array<{ productId: unknown; value: number }>,
  ) =>
    gi({
      category: "Channel",
      costTreatment: { cogs: 0, opex: 0 },
      impacts: { inventory_cost: { type: "absolute", value, selections } },
    });

  it("ADDS an absolute override to the base quantity", () => {
    const base = run({ globalInputs: [holding(11.8)] });
    const raised = run({
      globalInputs: [holding(11.8, [{ productId: PRODUCT_ID, value: 0.5 }])],
    });
    // 11.8 + 0.5 ⇒ a HIGHER per-unit holding charge, so higher opex. Under the
    // old multiply rule this was 11.8 × 0.5 = 5.9 and opex went DOWN.
    expect(raised.operatingExpenses).toBeGreaterThan(base.operatingExpenses);
  });

  it("lets a negative absolute override reduce the quantity", () => {
    const base = run({ globalInputs: [holding(11.8)] });
    const cut = run({
      globalInputs: [holding(11.8, [{ productId: PRODUCT_ID, value: -5 }])],
    });
    expect(cut.operatingExpenses).toBeLessThan(base.operatingExpenses);
  });

  it("treats an ABSOLUTE override of 0 as no override", () => {
    const base = run({ globalInputs: [holding(11.8)] });
    const neutral = run({
      globalInputs: [holding(11.8, [{ productId: PRODUCT_ID, value: 0 }])],
    });
    // 0 is the additive identity — the opposite of the relative case, where 0
    // cancels. This pair is what pins the two rules apart.
    expect(neutral.operatingExpenses).toBeCloseTo(base.operatingExpenses);
  });

  it("leaves an absolute impact alone for a product the override does not name", () => {
    const base = run({ globalInputs: [holding(11.8)] });
    const other = run({
      globalInputs: [holding(11.8, [{ productId: oid(), value: 100 }])],
    });
    expect(other.operatingExpenses).toBeCloseTo(base.operatingExpenses);
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
    // nobody bought cost money — they add COGS (expensed on production) and
    // holding, and add no revenue. Retuning INVENTORY_BASE, inventory_cost or
    // the margin cannot redden this.
    const opts = {
      sellingPrice: 14,
      materialValue: 1,
      materialUnitCost: 0.3,
      globalInputs: [
        gi({
          category: "Channels",
          costTreatment: { cogs: 0, opex: 0 },
          impacts: { inventory_cost: { type: "absolute", value: 2 } },
        }),
      ],
    };
    const demand = run(opts).customersObtained;
    // CEIL, not floor: `customersObtained` is fractional, so flooring would
    // leave `matched` production-limited and selling marginally LESS than the
    // glut — which would make the revenue comparison below fail for a reason
    // that has nothing to do with overproduction.
    const matched = run({ ...opts, produced: Math.ceil(demand) });
    const glut    = run({ ...opts, produced: Number.MAX_SAFE_INTEGER });

    expect(glut.produced).toBe(glut.inventoryQty);
    expect(glut.revenue).toBeCloseTo(matched.revenue);                        // extra units did not sell
    expect(glut.COGS).toBeGreaterThan(matched.COGS);                          // but were built
    expect(glut.operatingExpenses).toBeGreaterThan(matched.operatingExpenses); // and are held
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
      globalInputs: [
        gi({
          category: "Channels",
          costTreatment: { cogs: 0, opex: 0 },
          impacts: { inventory_cost: { type: "absolute", value: 2 } },
        }),
      ],
    });

    expect(r.operatingProfit).toBeLessThan(0);
  });

  it("a strictly dominated decision yields strictly worse profit", () => {
    const base = run({ materialUnitCost: 0.4 });
    const dominated = run({ materialUnitCost: 1.2 }); // same everything, costlier

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
    const r = run({
      sellingPrice: 0,
      globalInputs: [
        gi({
          category: "Channels",
          costTreatment: { cogs: 0, opex: 0 },
          impacts: { inventory_cost: { type: "absolute", value: 2 } },
        }),
      ],
    });
    const holding = r.incurredCosts.find((e) => e.key === "holding");

    expect(r.unitsSold).toBe(0);
    expect(r.COGS).toBeCloseTo(r.produced * r.dynamicCost);
    expect(holding?.leftover).toBe(r.closingStock);
    expect(holding?.incurredCost).toBeCloseTo(r.closingStock * 2);
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
      "productCostBreakdown", "incurredCosts",
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

    expect(sumTreatment(r.incurredCosts, "opex")).toBeGreaterThanOrEqual(60);
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
