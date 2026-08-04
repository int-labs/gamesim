import { z } from "zod";

/**
 * Shape contract for the editable slices of BaseData.
 *
 * BaseData is the tuning heart of a simulation type — market sizes per round
 * and the coefficients calcMarketModel competes teams on. The existing
 * `PATCH /base-data/:id` is a blind passthrough with no validation; these
 * schemas back a newer section-scoped endpoint that validates before writing
 * and refuses to silently rewrite a round that has already been calculated.
 */

const objectIdish = z.string().min(1);
const finite = z.number().finite();
const nonNeg = z.number().min(0);

/* ───────────────────────────── market data ─────────────────────────────── */

/** yearlyData is keyed by round number as a string: { "1": { marketSize } }. */
const yearlyDataSchema = z.record(
  z.string().regex(/^\d+$/, "Year keys are round numbers, e.g. \"1\"."),
  z.object({ marketSize: nonNeg })
);

const marketDataProductSchema = z.object({
  productId: objectIdish,
  yearlyData: yearlyDataSchema,
  subProducts: z
    .array(z.object({ key: z.string().min(1), yearlyData: yearlyDataSchema }))
    .optional(),
});

export const marketDataSchema = z.object({
  segments: z.array(
    z.object({
      segmentId: objectIdish,
      products: z.array(marketDataProductSchema),
    })
  ),
});

/* ──────────────────────────── market model ─────────────────────────────── */

const marketModelFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  formula: z.string().nullish(),
  type: z.string().nullish(),
  level: z.enum(["global", "segment", "product", "subproduct", "dynamic"]).nullish(),
  /** 1 = higher is better, 0 = lower is better. */
  direction: z.number().min(0).max(1),
  /** Spread of the normal curve teams are ranked on. Zero would divide by zero. */
  tightening: z.number().gt(0),
  elasticity: finite.nullish(),
  /** A field with no coefficients is SKIPPED by calcMarketModel entirely. */
  coefficients: z.record(z.string(), finite),
});

const marketModelProductSchema = z.object({
  productId: objectIdish,
  fields: z.array(marketModelFieldSchema),
  segmentFields: z.array(marketModelFieldSchema).default([]),
  globalFields: z.array(marketModelFieldSchema).default([]),
  subProducts: z
    .array(z.object({ key: z.string().min(1), fields: z.array(marketModelFieldSchema) }))
    .optional(),
});

export const marketModelSchema = z.object({
  segments: z.array(
    z.object({
      segmentId: objectIdish,
      products: z.array(marketModelProductSchema),
    })
  ),
});

/* ─────────────────────────── per-round overrides ───────────────────────── */

export const perRoundOverridesSchema = z.record(
  z.string().regex(/^\d+$/, "Override keys are round numbers, e.g. \"2\"."),
  z.object({
    constants: z.record(z.string(), finite).optional(),
    /** Scales every marketSize for that round. 1 = no change. */
    demandMultiplier: z.number().gt(0).max(100).optional(),
  })
);

export const constantsSchema = z.record(z.string(), z.unknown());

export const BASE_DATA_SECTIONS = {
  marketData: marketDataSchema,
  marketModel: marketModelSchema,
  perRoundOverrides: perRoundOverridesSchema,
  constants: constantsSchema,
} as const;

export type BaseDataSection = keyof typeof BASE_DATA_SECTIONS;

/* ──────────────────────── change detection (the guard) ─────────────────── */

/**
 * Which round numbers have a different marketSize between two marketData
 * documents. Drives the history guard: editing a round that already has
 * Results would leave those results unreproducible, so we name the exact
 * rounds rather than blocking the whole document.
 */
export function changedRounds(before: any, after: any): number[] {
  const flatten = (md: any): Map<string, number> => {
    const out = new Map<string, number>();
    for (const seg of md?.segments ?? []) {
      for (const p of seg.products ?? []) {
        for (const [year, v] of Object.entries(p.yearlyData ?? {})) {
          out.set(`${seg.segmentId}|${p.productId}|${year}`, (v as any)?.marketSize ?? 0);
        }
      }
    }
    return out;
  };

  const a = flatten(before);
  const b = flatten(after);
  const rounds = new Set<number>();

  for (const [key, value] of b) {
    if (a.get(key) !== value) rounds.add(Number(key.split("|")[2]));
  }
  // A removed entry is a change too.
  for (const [key] of a) {
    if (!b.has(key)) rounds.add(Number(key.split("|")[2]));
  }

  return [...rounds].filter((r) => Number.isFinite(r)).sort((x, y) => x - y);
}

export const formatIssues = (e: z.ZodError) =>
  e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
