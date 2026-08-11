import { z } from "zod";
import { PLAYER_CONFIG_SECTIONS, type PlayerConfigSection } from "../models/playerConfig";

/**
 * Shape contract for PlayerConfig. Mirrors the player's own TypeScript types
 * field-for-field, so hydration on the frontend is a type-safe overlay rather
 * than a translation layer.
 *
 * Source of truth for each section:
 *   notebook-pixel-sim/src/engine/finlit/core/config/*.ts   (V3 economy)
 *   notebook-pixel-sim/src/data/*.ts                        (V2 catalogs)
 *   notebook-pixel-sim/src/types/index.ts                   (shared types)
 *
 * STRICTNESS POLICY
 *   - Sets the frontend has hardcoded (add-on slots, channel ids, option ids
 *     A–D, phases 1–3, vendor quality) are enumerated strictly: an unknown
 *     value there would break rendering or math.
 *   - Sets that are data (genre ids, add-on ids, vendor ids, segment ids) are
 *     free strings, because operators must be able to add and rename them.
 *   - Cross-section rules (e.g. every genre needs channel rows) can only run
 *     when the whole document is present, so they live in `validateFullConfig`
 *     and are re-run at publish time — a single-section PATCH can't see them.
 */

/* ─────────────────────────────── primitives ─────────────────────────────── */

const unit = z.number().min(0).max(1); // 0..1 weights
const nonNeg = z.number().min(0);
const finite = z.number().finite();
const id = z.string().trim().min(1).max(64);
const label = z.string().trim().min(1).max(200);
const richText = z.string().max(5000);

/** Every art-bearing entry: uploaded asset first, bundled sprite path second. */
const imageRefs = {
  imageAssetId: z.string().trim().length(24).nullish(),
  imagePath: z.string().trim().max(300).nullish(),
};

const optionLetter = z.enum(["A", "B", "C", "D"]);
const phase = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** Rejects duplicate ids inside a catalog array. */
const uniqueBy = <T extends { id: string }>(field = "id") =>
  (rows: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      const key = (row as any)[field];
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, field],
          message: `Duplicate ${field} "${key}" — each entry must be unique.`,
        });
      }
      seen.add(key);
    });
  };

/* ──────────────────────────── V3 FinLit sections ────────────────────────── */

export const genreSchema = z.object({
  id,
  name: label,
  blurb: richText.default(""),
  demand: z.object({
    pMinus1: nonNeg,
    p0: nonNeg,
    p1: nonNeg,
    p2: nonNeg,
    p3: nonNeg,
  }),
  voc: z.object({
    design: unit,
    price: unit,
    channel: unit,
    size: unit,
    paper: unit,
  }),
  ...imageRefs,
});

/** One option on a production axis: a multiplicative rate and a per-unit cost. */
export const configOptionSchema = z.object({
  id,
  name: label,
  /** Multiplicative production-rate factor. Zero would stall production. */
  rate: z.number().gt(0).max(10),
  cost: nonNeg,
  description: richText.nullish(),
  ...imageRefs,
});

export const PRODUCTION_AXES = ["type", "paper", "size", "pageDesign", "addon", "cover"] as const;

/** An axis with no options would make `prodPerDay` undefined — never allow empty. */
const axis = (name: string) =>
  z
    .array(configOptionSchema)
    .min(1, `The "${name}" axis needs at least one option.`)
    .superRefine(uniqueBy());

export const productionOptionsSchema = z.object({
  type: axis("type"),
  paper: axis("paper"),
  size: axis("size"),
  pageDesign: axis("pageDesign"),
  addon: axis("addon"),
  cover: axis("cover"),
});

const CHANNEL_IDS = ["offline", "online", "retail"] as const;

export const channelMetaSchema = z.object({
  id: z.enum(CHANNEL_IDS),
  name: label,
  blurb: richText.default(""),
});

export const channelRowSchema = z.object({
  channel: z.enum(CHANNEL_IDS),
  /** Share of the genre's demand routed to this channel. */
  split: unit,
  maintenance: nonNeg,
  consignment: nonNeg,
  inventoryCost: nonNeg,
  sellRate: z.number().min(0).max(1),
});

export const channelsByGenreSchema = z.object({
  genreId: id,
  rows: z.array(channelRowSchema).min(1).superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (seen.has(r.channel)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "channel"],
          message: `Duplicate channel "${r.channel}" for this genre.`,
        });
      }
      seen.add(r.channel);
    });
  }),
});

export const vendorSchema = z.object({
  id,
  name: label,
  blurb: richText.nullish(),
  energyByLevel: z.object({ l1: nonNeg, l2: nonNeg }),
  coverage: z.array(
    z.object({
      level: z.union([z.literal(1), z.literal(2)]),
      genreId: id,
      cost: nonNeg,
      /** "none" means this vendor doesn't stock that genre. */
      quality: z.enum(["perfect", "good", "average", "none"]),
      sellBonus: nonNeg,
      prodBonus: nonNeg,
    })
  ),
  ...imageRefs,
});

export const hiringCandidateSchema = z.object({
  id,
  name: label,
  blurb: richText.default(""),
  levels: z
    .array(
      z.object({
        level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        prodBonus: nonNeg,
        sellBonus: nonNeg,
        cost: nonNeg,
        energy: nonNeg,
      })
    )
    .min(1),
  ...imageRefs,
});

export const marketingTeamSchema = z.object({
  id,
  name: label,
  blurb: richText.default(""),
  cost: nonNeg,
  sellBonus: nonNeg,
  energy: nonNeg,
});

export const scenarioSchema = z.object({
  id,
  phase,
  title: label,
  body: richText,
  options: z
    .array(
      z.object({
        id: optionLetter,
        label,
        detail: richText,
        energy: nonNeg,
        demandMult: z.number().min(0).max(5).nullish(),
        sellMult: z.number().min(0).max(5).nullish(),
        cashNow: finite.nullish(),
      })
    )
    .min(2, "A scenario needs at least two options."),
  ...imageRefs,
});

/* ──────────────────────────────── constants ─────────────────────────────── */

const numberMap = z.record(z.string(), finite);

/**
 * Whitelisted tunables. Ranges come from the doc-comments on the frontend's
 * own constants — a bad value here (DEMAND_SCALE: 0, ENERGY_CAP: -5) doesn't
 * error, it just quietly ruins the game, so the bounds are the guardrail.
 */
export const CONSTANT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  // V3 — engine/finlit/core/config/constants.ts
  BASERATE: z.number().gt(0),
  BASE_MARKET_SHARE: z.number().gt(0).max(1),
  UNIT_CONTRIBUTION: z.number().gt(0),
  DEMAND_SCALE: z.number().gt(0).max(10),
  HOLDING_RATE_PER_DAY: unit,
  BUDGET_MAX: nonNeg,
  BUDGET_LEVER_ENERGY: nonNeg,
  MARKETING_DEMAND_RATE: unit,
  SALES_SELL_RATE: unit,
  PHASE_LENGTH_DAYS: z.number().int().gt(0).max(365),
  ENERGY_START: nonNeg,
  ENERGY_PER_PHASE: nonNeg,
  ENERGY_CAP: z.number().gt(0),
  SCENARIO_DAYS: z.array(z.number().int().min(1).max(365)),
  ROUTE_START_SELF_CASH: nonNeg,
  ROUTE_START_SELF_OPENING_PROFIT: finite,
  ROUTE_START_INVESTOR_CASH: nonNeg,
  ROUTE_START_INVESTOR_OPENING_PROFIT: finite,
  SCENARIOS_PER_PHASE: numberMap,

  // V2 — data/balance.ts
  PHASE_MAX_ENERGY: numberMap,
  PAPER_COST: numberMap,
  COVER_COST: numberMap,
  BINDING_COST: numberMap,
  SIZE_COST_MULT: numberMap,
  SIZE_TIME_MULT: numberMap,
  PRICE_REFERENCE: numberMap,
  PHASE_DEMAND_MULT: numberMap,
  STARTING_CASH: numberMap,
  STARTING_DEBT: numberMap,
  ENERGY_COSTS: numberMap,
  BASE_PRODUCTION: nonNeg,
  HIRE_CAPACITY: nonNeg,
  HIRE_DAILY_WAGE: nonNeg,
  DEFAULT_DEFECT: unit,
  SEED_DEFAULT: z.string().max(120),
};

export const constantsSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, ctx) => {
    for (const [key, raw] of Object.entries(value)) {
      const schema = CONSTANT_SCHEMAS[key];
      if (!schema) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message:
            `"${key}" is not a tunable constant. Allowed: ` +
            Object.keys(CONSTANT_SCHEMAS).sort().join(", "),
        });
        continue;
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: parsed.error.issues[0]?.message ?? "Invalid value.",
        });
      }
    }
  });

/* ──────────────────────────────── V2 sections ───────────────────────────── */

/** The 9 anchor points the player's AddOnLayer knows how to position. */
const ADDON_SLOTS = [
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
  "center-label",
  "cover-band-v",
  "cover-band-h",
  "edge-right",
  "bundle",
] as const;

/** The 12 categories shipped with the player. Operators may add more via
 *  `addOnCategories`; the cross-check runs in validateFullConfig. */
export const BUILTIN_ADDON_CATEGORIES = [
  "integrated_charm",
  "integrated_ribbon",
  "integrated_sticker_name",
  "integrated_sticker_pack",
  "decorative_washi",
  "decorative_pattern",
  "decorative_bundle",
  "functional_bookmark",
  "functional_band",
  "functional_closure",
  "functional_clip",
  "writing_tool",
] as const;

export const addOnSchema = z.object({
  id,
  name: label,
  category: id,
  costPerUnit: nonNeg,
  /** Effect on the price ceiling. */
  perceivedValue: unit,
  segmentBoost: z.record(z.string(), unit).default({}),
  slot: z.enum(ADDON_SLOTS),
  description: richText.default(""),
  active: z.boolean().default(true),
  thumbAssetId: z.string().trim().length(24).nullish(),
  thumbPath: z.string().trim().max(300).nullish(),
  ...imageRefs,
});

export const addOnCategorySchema = z.object({
  id,
  name: label,
  group: z.enum(["integrated", "decorative", "functional", "writing"]),
});

export const segmentSchema = z.object({
  id,
  name: label,
  description: richText.default(""),
  baseDemand: nonNeg,
  priceSensitivity: nonNeg,
  preferredPriceRef: nonNeg,
  preference: z.object({
    paperQuality: unit,
    coverPremium: unit,
    decorative: unit,
    functional: unit,
    packaging: unit,
  }),
  ...imageRefs,
});

export const channelV2Schema = z.object({
  id,
  name: label,
  description: richText.default(""),
  reach: nonNeg,
  dailyCost: nonNeg,
  unlockEnergy: nonNeg,
  unlockCash: nonNeg,
  segmentAffinity: z.record(z.string(), nonNeg).default({}),
  ...imageRefs,
});

export const archetypeSchema = z.object({
  id,
  title: label,
  tagline: z.string().max(300).default(""),
  description: richText.default(""),
  bestFor: z.array(id).default([]),
  strengths: z.array(z.string().max(500)).default([]),
  tradeoffs: z.array(z.string().max(500)).default([]),
  costNote: richText.default(""),
  productionNote: richText.default(""),
  whyChoose: richText.default(""),
  ...imageRefs,
});

export const eventSchema = z.object({
  id,
  day: z.number().int().min(0).max(365),
  title: label,
  body: richText,
  mascotMood: z.string().max(60).default("neutral"),
  options: z
    .array(
      z.object({
        id: optionLetter,
        label,
        description: richText,
        cost: z.object({ energy: nonNeg, cash: finite.nullish() }),
        effects: z.array(z.string().max(300)).default([]),
        modifierIds: z.array(z.string().max(120)).default([]),
      })
    )
    .min(2),
  ...imageRefs,
});

export const upgradeSchema = z.object({
  id,
  name: label,
  category: z.enum(["hire", "tool", "process", "supplier", "channel", "marketing", "finance"]),
  description: richText.default(""),
  costs: z.object({
    time: nonNeg,
    energy: nonNeg,
    /** Signed on purpose: finance upgrades like `finance_loan` carry a
     *  negative cash "cost" because they pay the player. */
    cash: finite,
  }),
  unlockDay: z.number().int().min(0).max(365).nullish(),
  requires: z.array(id).default([]),
  effects: z.array(z.string().max(300)).default([]),
  ...imageRefs,
});

export const insightSchema = z.object({
  id,
  phase,
  question: richText,
  options: z
    .array(z.object({ id: optionLetter, text: richText, correct: z.boolean() }))
    .min(2)
    .superRefine((opts, ctx) => {
      if (!opts.some((o) => o.correct)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one option must be marked correct.",
        });
      }
    }),
});

/* ────────────────────────── presentation sections ───────────────────────── */

export const copySchema = z.record(z.string().max(160), z.string().max(5000));

export const imagesSchema = z.record(
  z.string().max(160),
  z.object({
    imageAssetId: z.string().trim().length(24).nullish(),
    imagePath: z.string().trim().max(300).nullish(),
  })
);

/* ──────────────────────────── section registry ──────────────────────────── */

export const SECTION_SCHEMAS: Record<PlayerConfigSection, z.ZodTypeAny> = {
  genres: z.array(genreSchema).superRefine(uniqueBy()),
  productionOptions: productionOptionsSchema,
  channelMeta: z.array(channelMetaSchema),
  channelsByGenre: z.array(channelsByGenreSchema),
  vendors: z.array(vendorSchema).superRefine(uniqueBy()),
  hiringCandidates: z.array(hiringCandidateSchema).superRefine(uniqueBy()),
  marketingTeams: z.array(marketingTeamSchema).superRefine(uniqueBy()),
  scenarios: z.array(scenarioSchema).superRefine(uniqueBy()),
  constants: constantsSchema,
  addOns: z.array(addOnSchema).superRefine(uniqueBy()),
  addOnCategories: z.array(addOnCategorySchema).superRefine(uniqueBy()),
  segments: z.array(segmentSchema).superRefine(uniqueBy()),
  channelsV2: z.array(channelV2Schema).superRefine(uniqueBy()),
  archetypes: z.array(archetypeSchema).superRefine(uniqueBy()),
  events: z.array(eventSchema).superRefine(uniqueBy()),
  upgrades: z.array(upgradeSchema).superRefine(uniqueBy()),
  insights: z.array(insightSchema).superRefine(uniqueBy()),
  copy: copySchema,
  images: imagesSchema,
};

/** Full-document body for PUT. Every section optional — partial upserts are
 *  normal while an operator builds the catalog up. Unknown keys are rejected
 *  so a typo'd section name fails loudly instead of vanishing into the doc. */
export const fullConfigSchema = z
  .object(
    Object.fromEntries(
      PLAYER_CONFIG_SECTIONS.map((s) => [s, SECTION_SCHEMAS[s].optional()])
    ) as unknown as Record<PlayerConfigSection, z.ZodTypeAny>
  )
  .strict();

export interface CrossCheckIssue {
  path: string;
  message: string;
}

/**
 * Rules that span sections. A single-section PATCH can't evaluate these, so
 * they run on PUT and again at publish — publish is the gate that matters,
 * because that's when players start reading the document.
 */
export function validateFullConfig(config: Record<string, any>): CrossCheckIssue[] {
  const issues: CrossCheckIssue[] = [];

  const genres: any[] = Array.isArray(config.genres) ? config.genres : [];
  const genreIds = new Set(genres.map((g) => g.id));

  // Every genre needs channel rows — the engine indexes CHANNELS_BY_GENRE by
  // genre id and throws on a miss.
  if (genres.length && Array.isArray(config.channelsByGenre)) {
    const covered = new Set(config.channelsByGenre.map((c: any) => c.genreId));
    for (const g of genreIds) {
      if (!covered.has(g)) {
        issues.push({
          path: `channelsByGenre`,
          message: `Genre "${g}" has no channel rows. The engine can't price a genre it can't route.`,
        });
      }
    }
    for (const c of config.channelsByGenre) {
      if (!genreIds.has(c.genreId)) {
        issues.push({
          path: `channelsByGenre`,
          message: `Channel rows reference unknown genre "${c.genreId}".`,
        });
      }
    }
  }

  // Vendor coverage must point at real genres.
  if (Array.isArray(config.vendors) && genreIds.size) {
    for (const v of config.vendors) {
      for (const cov of v.coverage ?? []) {
        if (!genreIds.has(cov.genreId)) {
          issues.push({
            path: `vendors.${v.id}`,
            message: `Coverage references unknown genre "${cov.genreId}".`,
          });
        }
      }
    }
  }

  // Add-on categories: built-ins plus whatever the operator defined.
  if (Array.isArray(config.addOns)) {
    const known = new Set<string>([
      ...BUILTIN_ADDON_CATEGORIES,
      ...(Array.isArray(config.addOnCategories)
        ? config.addOnCategories.map((c: any) => c.id)
        : []),
    ]);
    for (const a of config.addOns) {
      if (!known.has(a.category)) {
        issues.push({
          path: `addOns.${a.id}`,
          message:
            `Unknown category "${a.category}". Add it under Add-on Categories, ` +
            `or use one of the built-ins.`,
        });
      }
    }
  }

  // Upgrade prerequisites must resolve, or the ladder dead-ends.
  if (Array.isArray(config.upgrades)) {
    const upgradeIds = new Set(config.upgrades.map((u: any) => u.id));
    for (const u of config.upgrades) {
      for (const req of u.requires ?? []) {
        if (!upgradeIds.has(req)) {
          issues.push({
            path: `upgrades.${u.id}`,
            message: `Requires unknown upgrade "${req}".`,
          });
        }
      }
    }
  }

  // Segment references in archetypes.bestFor.
  if (Array.isArray(config.archetypes) && Array.isArray(config.segments)) {
    const segIds = new Set(config.segments.map((s: any) => s.id));
    if (segIds.size) {
      for (const a of config.archetypes) {
        for (const seg of a.bestFor ?? []) {
          if (!segIds.has(seg)) {
            issues.push({
              path: `archetypes.${a.id}`,
              message: `"bestFor" references unknown segment "${seg}".`,
            });
          }
        }
      }
    }
  }

  return issues;
}

/** Flattens zod issues into the console's inline-error shape. */
export function formatZodIssues(error: z.ZodError): CrossCheckIssue[] {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}
