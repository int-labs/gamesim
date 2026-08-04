import {
  SECTION_SCHEMAS,
  fullConfigSchema,
  validateFullConfig,
  CONSTANT_SCHEMAS,
} from "./playerConfig";

/**
 * The validators ARE the PlayerConfig contract — they're what stops an operator
 * edit from shipping a document the player can't read. Pure functions, so these
 * run without a database.
 */

const genre = (over: Record<string, any> = {}) => ({
  id: "cute",
  name: "Cute",
  blurb: "Decoration-led buyers.",
  demand: { pMinus1: 10115, p0: 12212, p1: 14507, p2: 17115, p3: 20759 },
  voc: { design: 0.95, price: 0.7, channel: 0.6, size: 0.4, paper: 0.5 },
  ...over,
});

const channelRows = (genreId = "cute") => ({
  genreId,
  rows: [
    { channel: "offline", split: 0.35, maintenance: 10, consignment: 0, inventoryCost: 0, sellRate: 0.04 },
    { channel: "online", split: 0.35, maintenance: 11.5, consignment: 8, inventoryCost: 0, sellRate: 0.04 },
    { channel: "retail", split: 0.3, maintenance: 15, consignment: 11.8, inventoryCost: 11.8, sellRate: 0.02 },
  ],
});

const addOn = (over: Record<string, any> = {}) => ({
  id: "charm_bear",
  name: "Bear Charm",
  category: "integrated_charm",
  costPerUnit: 0.4,
  perceivedValue: 0.15,
  segmentBoost: { gift: 0.2 },
  slot: "corner-tr",
  description: "Cute charm dangle.",
  ...over,
});

describe("PlayerConfig validators", () => {
  describe("genres", () => {
    it("accepts a genre matching the player's shape", () => {
      expect(SECTION_SCHEMAS.genres.safeParse([genre()]).success).toBe(true);
    });

    it("rejects duplicate ids", () => {
      const r = SECTION_SCHEMAS.genres.safeParse([genre(), genre()]);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toMatch(/Duplicate id/);
    });

    it("rejects a VoC weight outside 0..1", () => {
      const r = SECTION_SCHEMAS.genres.safeParse([
        genre({ voc: { design: 1.5, price: 0.7, channel: 0.6, size: 0.4, paper: 0.5 } }),
      ]);
      expect(r.success).toBe(false);
    });

    it("rejects negative demand", () => {
      const bad = genre();
      (bad.demand as any).p1 = -5;
      expect(SECTION_SCHEMAS.genres.safeParse([bad]).success).toBe(false);
    });
  });

  describe("productionOptions", () => {
    const opt = (id: string) => ({ id, name: id, rate: 0.1, cost: 5 });
    const axes = {
      type: [opt("cute")],
      paper: [opt("cream")],
      size: [opt("a5")],
      pageDesign: [opt("lined")],
      addon: [opt("spiral")],
      cover: [opt("hard")],
    };

    it("accepts a full six-axis spec", () => {
      expect(SECTION_SCHEMAS.productionOptions.safeParse(axes).success).toBe(true);
    });

    it("rejects an empty axis — production rate would be undefined", () => {
      const r = SECTION_SCHEMAS.productionOptions.safeParse({ ...axes, paper: [] });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toMatch(/at least one option/);
    });

    it("rejects rate 0 — it would stall production entirely", () => {
      const r = SECTION_SCHEMAS.productionOptions.safeParse({
        ...axes,
        size: [{ id: "a5", name: "A5", rate: 0, cost: 0.25 }],
      });
      expect(r.success).toBe(false);
    });

    it("rejects a missing axis", () => {
      // `cover` is destructured only to drop it — the rest is the fixture.
      const { cover: _cover, ...withoutCover } = axes;
      expect(SECTION_SCHEMAS.productionOptions.safeParse(withoutCover).success).toBe(false);
    });
  });

  describe("constants", () => {
    it("accepts whitelisted tunables", () => {
      const r = SECTION_SCHEMAS.constants.safeParse({
        DEMAND_SCALE: 0.28,
        ENERGY_CAP: 100,
        SCENARIO_DAYS: [15, 45, 55, 75, 85],
        PRICE_REFERENCE: { students: 6, creators: 14 },
      });
      expect(r.success).toBe(true);
    });

    it("rejects an unknown key rather than silently storing it", () => {
      const r = SECTION_SCHEMAS.constants.safeParse({ TOTALLY_MADE_UP: 1 });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toMatch(/not a tunable constant/);
    });

    it("rejects out-of-range values that would quietly ruin balance", () => {
      expect(SECTION_SCHEMAS.constants.safeParse({ DEMAND_SCALE: 0 }).success).toBe(false);
      expect(SECTION_SCHEMAS.constants.safeParse({ BASE_MARKET_SHARE: 1.5 }).success).toBe(false);
      expect(SECTION_SCHEMAS.constants.safeParse({ HOLDING_RATE_PER_DAY: -0.1 }).success).toBe(false);
      expect(SECTION_SCHEMAS.constants.safeParse({ ENERGY_CAP: 0 }).success).toBe(false);
    });

    it("covers every constant the player actually reads", () => {
      // Guards against a tunable being added to the frontend but forgotten here,
      // which would make it un-editable (rejected as "unknown").
      for (const key of [
        "BASERATE",
        "BASE_MARKET_SHARE",
        "UNIT_CONTRIBUTION",
        "DEMAND_SCALE",
        "HOLDING_RATE_PER_DAY",
        "PHASE_LENGTH_DAYS",
        "ENERGY_START",
        "ENERGY_PER_PHASE",
        "ENERGY_CAP",
        "SCENARIO_DAYS",
      ]) {
        expect(CONSTANT_SCHEMAS[key]).toBeDefined();
      }
    });
  });

  describe("addOns", () => {
    it("accepts a built-in slot", () => {
      expect(SECTION_SCHEMAS.addOns.safeParse([addOn()]).success).toBe(true);
    });

    it("rejects a slot the player can't position", () => {
      const r = SECTION_SCHEMAS.addOns.safeParse([addOn({ slot: "nowhere" })]);
      expect(r.success).toBe(false);
    });

    it("rejects a segment boost above 1", () => {
      const r = SECTION_SCHEMAS.addOns.safeParse([addOn({ segmentBoost: { gift: 4 } })]);
      expect(r.success).toBe(false);
    });
  });

  describe("upgrades", () => {
    it("allows a negative cash cost — finance upgrades pay the player", () => {
      // `finance_loan` in the shipped catalog is { time: 0, energy: 4, cash: -500 }.
      const r = SECTION_SCHEMAS.upgrades.safeParse([
        {
          id: "finance_loan",
          name: "Take a Small Loan",
          category: "finance",
          description: "Receive $500 now.",
          costs: { time: 0, energy: 4, cash: -500 },
        },
      ]);
      expect(r.success).toBe(true);
    });

    it("still rejects negative time or energy", () => {
      const base = {
        id: "x",
        name: "X",
        category: "tool",
        costs: { time: 0, energy: 0, cash: 0 },
      };
      expect(
        SECTION_SCHEMAS.upgrades.safeParse([{ ...base, costs: { time: -1, energy: 0, cash: 0 } }]).success
      ).toBe(false);
      expect(
        SECTION_SCHEMAS.upgrades.safeParse([{ ...base, costs: { time: 0, energy: -1, cash: 0 } }]).success
      ).toBe(false);
    });
  });

  describe("insights", () => {
    it("requires at least one correct answer", () => {
      const r = SECTION_SCHEMAS.insights.safeParse([
        {
          id: "q1",
          phase: 1,
          question: "Which lever moves demand?",
          options: [
            { id: "A", text: "Marketing", correct: false },
            { id: "B", text: "Nothing", correct: false },
          ],
        },
      ]);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toMatch(/correct/);
    });
  });

  describe("fullConfigSchema", () => {
    it("allows partial documents while a catalog is being built", () => {
      expect(fullConfigSchema.safeParse({ genres: [genre()] }).success).toBe(true);
      expect(fullConfigSchema.safeParse({}).success).toBe(true);
    });

    it("rejects an unknown section so a typo fails loudly", () => {
      expect(fullConfigSchema.safeParse({ genrez: [] }).success).toBe(false);
    });
  });

  describe("validateFullConfig — cross-section rules", () => {
    it("passes a coherent config", () => {
      expect(
        validateFullConfig({ genres: [genre()], channelsByGenre: [channelRows()] })
      ).toEqual([]);
    });

    it("flags a genre with no channel rows", () => {
      const issues = validateFullConfig({
        genres: [genre(), genre({ id: "anime", name: "Anime" })],
        channelsByGenre: [channelRows("cute")],
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toMatch(/anime/);
    });

    it("flags channel rows pointing at a genre that no longer exists", () => {
      const issues = validateFullConfig({
        genres: [genre()],
        channelsByGenre: [channelRows("cute"), channelRows("deleted_genre")],
      });
      expect(issues.some((i) => i.message.includes("deleted_genre"))).toBe(true);
    });

    it("flags vendor coverage for an unknown genre", () => {
      const issues = validateFullConfig({
        genres: [genre()],
        channelsByGenre: [channelRows()],
        vendors: [
          {
            id: "als",
            name: "Al's Store",
            energyByLevel: { l1: 8, l2: 18 },
            coverage: [
              { level: 1, genreId: "ghost", cost: 40, quality: "perfect", sellBonus: 0.1, prodBonus: 3 },
            ],
          },
        ],
      });
      expect(issues.some((i) => i.message.includes("ghost"))).toBe(true);
    });

    it("flags an add-on in an undeclared category", () => {
      const issues = validateFullConfig({ addOns: [addOn({ category: "invented" })] });
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toMatch(/Unknown category/);
    });

    it("accepts an add-on in an operator-declared category", () => {
      const issues = validateFullConfig({
        addOns: [addOn({ category: "seasonal" })],
        addOnCategories: [{ id: "seasonal", name: "Seasonal", group: "decorative" }],
      });
      expect(issues).toEqual([]);
    });

    it("flags an upgrade requiring an upgrade that doesn't exist", () => {
      const issues = validateFullConfig({
        upgrades: [
          {
            id: "press_pro",
            name: "Pro Press",
            category: "tool",
            costs: { time: 1, energy: 5, cash: 200 },
            requires: ["press_basic"],
          },
        ],
      });
      expect(issues.some((i) => i.message.includes("press_basic"))).toBe(true);
    });

    it("flags an archetype targeting a segment that doesn't exist", () => {
      const issues = validateFullConfig({
        segments: [
          {
            id: "students",
            name: "Students",
            baseDemand: 18,
            priceSensitivity: 1.6,
            preferredPriceRef: 6,
            preference: { paperQuality: 0.4, coverPremium: 0.2, decorative: 0.5, functional: 0.7, packaging: 0.2 },
          },
        ],
        archetypes: [{ id: "daily", title: "Daily", bestFor: ["students", "aliens"] }],
      });
      expect(issues.some((i) => i.message.includes("aliens"))).toBe(true);
    });
  });
});
