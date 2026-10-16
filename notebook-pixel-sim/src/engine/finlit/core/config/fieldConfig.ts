import type { ProductDto } from '@/gamesim/types';
import { PRICE_MAX } from './constants';
import {
  CONFIG_TABLES,
  optionScore,
  priceAnchorSpec,
  type ConfigAxis,
  type ProductionSpec,
} from './production';

export interface FieldConfig {
  direction:  number;
  minValue:   number;
  maxValue:   number;
  tightening: number;
  /** Dollars per score point, from the operator's ProductField.
   *  0 = the field contributes no cost (same reading the server takes). */
  unitCost:   number;
  /** The operator's own `ProductField.label` and `order`. Carried so a surface
   *  can LIST the fields a product actually has instead of a hardcoded set —
   *  see `driverAxes`. */
  label:      string;
  order:      number;
}

/**
 * Per-product, per-field backend config. Keyed `Product._id` → fieldKey →
 * FieldConfig. Populated at boot by hydrateFieldConfig — reads lazy, never at
 * module scope.
 */
export const FIELD_CONFIG: Record<string, Record<string, FieldConfig>> = {};

/**
 * Fill the table from the wire, keyed by the Product's own `_id`.
 *
 * This used to bind each product to a bundled genre slug by substring —
 * `productName.toLowerCase().includes(genreId)` — which worked only by luck of
 * naming (`"cutesy notebook".includes("cute")`), bound to whichever genre came
 * first when a name matched two, and silently DROPPED any product that matched
 * none. The Product's id is the operator's own key; nothing needs guessing.
 */
export function hydrateFieldConfig(products: ProductDto[]): void {
  for (const key of Object.keys(FIELD_CONFIG)) delete FIELD_CONFIG[key];
  for (const product of products) {
    if (product.active === false) continue;
    const productId = String(product._id);
    FIELD_CONFIG[productId] = {};
    for (const field of product.fields) {
      FIELD_CONFIG[productId][field.key] = {
        direction:  field.direction  ?? 0,
        minValue:   field.minValue   ?? 0,
        maxValue:   field.maxValue   ?? 100,
        tightening: field.tightening ?? 3,
        unitCost:   field.unitCost   ?? 0,
        label:      field.label || field.key,
        order:      field.order ?? 0,
      };
    }
  }
}

export const fieldCfg = (genre: string, key: string): FieldConfig =>
  FIELD_CONFIG[genre]?.[key]
  ?? { direction: 0, minValue: 0, maxValue: 100, tightening: 3, unitCost: 0, label: key, order: 0 };

/**
 * What one option on an axis ADDS to the unit cost: `score × unitCost`.
 *
 * COMPUTED, never stored — the same arithmetic the server's `dynamicCost` runs,
 * so the figure under an add-on tile and the figure in the design drawer cannot
 * quote differently for the same choice.
 *
 * `null` when the axis has no server field or the field has no `unitCost`,
 * which the callers render as NO hint rather than a confident "+$0.00".
 */
export const optionUnitCost = (
  genre: string,
  axis: ConfigAxis,
  optionId: string | undefined,
): number | null => {
  const fieldKey = CONFIG_TABLES[axis].fieldKey;
  if (!fieldKey) return null;
  const perPoint = fieldCfg(genre, fieldKey).unitCost;
  if (!perPoint) return null;
  return optionScore(axis, optionId) * perPoint;
};

/**
 * Fields that are NOT customer drivers, excluded by key rather than by any
 * property of the data.
 *
 * `selling_price` carries direction 0, so a `direction > 0` filter would drop it
 * anyway — but `projected_market_share` carries 0.5 and would be INCLUDED by
 * such a filter. It is the team's own share claim, not something a buyer weighs,
 * so no numeric rule separates these two from the design axes. The operator
 * adding a seventh design field needs no change here; adding another
 * non-driver field does.
 */
const NON_DRIVER_KEYS = new Set(['selling_price', 'projected_market_share']);

export interface DriverAxis {
  key:       string;
  label:     string;
  direction: number;
}

/**
 * The customer-driver axes for one genre, IN THE OPERATOR'S OWN `order`, derived
 * from the product's real fields.
 *
 * This replaced a hardcoded six-entry list. That list could not show a field the
 * operator added, kept showing one they deleted (as an empty bar, which reads as
 * "buyers don't care" rather than "this does not exist"), and — worst — was the
 * DENOMINATOR for every share on the card, so a seventh field's weight was
 * silently excluded and all six shares were computed against an incomplete
 * total while still summing to 100%.
 */
/**
 * The FLOOR a notebook costs per unit the moment it is created, before a single
 * design choice: `Σ over every cost field of minValue × unitCost`.
 *
 * This is where the notebook TYPE is charged. `page_design` carries
 * `minValue: 15` — the same 15 as `TYPE_OPTIONS.score` — and it is the only
 * field with a non-zero floor, so the type's cost and this baseline are one
 * number, not two. The type has no server field of its own and needs none.
 *
 * DELIBERATELY NOT the cost of the starting spec. Quoting that would not
 * reconcile with the design drawer, which shows each option as a DELTA on top
 * of this floor — a player adding the drawer's figures up would never reach it,
 * and a total that cannot be re-derived from the screens that feed it reads as
 * a lie rather than a summary.
 *
 * Iterates the HYDRATED fields rather than the frontend's axes, so a cost field
 * the operator added that no axis maps to (`charms`, `ribbons`, `functional`)
 * still contributes its floor instead of being silently priced at zero.
 */
export const typeBaseCost = (genre: string): number =>
  Object.values(FIELD_CONFIG[genre] ?? {}).reduce(
    (sum, cfg) => (cfg.unitCost ? sum + cfg.minValue * cfg.unitCost : sum),
    0,
  );

/**
 * What one unit of a given spec costs to build, mirroring `calcFinancials`:
 *
 *     Σ over every cost field of (minValue + submitted) × unitCost
 *
 * The `minValue` term is NOT optional — the server charges it as a baseline on
 * every field (`effectiveValue = (field.minValue ?? 0) + raw`), so pricing only
 * `score × unitCost` quotes low on every notebook.
 *
 * Used for the PRICE ANCHOR: the cost of `PRICE_ANCHOR`, the reference build.
 * It is a cost, not a suggested price — what the notebook must clear before it
 * earns anything, which is the number a player needs to price against.
 */
export const specUnitCost = (genre: string, spec: ProductionSpec): number => {
  // Spec axes collapsed onto the server field each one submits to.
  const submitted: Record<string, number> = {};
  for (const axis of Object.keys(CONFIG_TABLES) as ConfigAxis[]) {
    const fieldKey = CONFIG_TABLES[axis].fieldKey;
    if (!fieldKey) continue;
    submitted[fieldKey] = (submitted[fieldKey] ?? 0) + optionScore(axis, spec[axis]);
  }

  return Object.entries(FIELD_CONFIG[genre] ?? {}).reduce((sum, [fieldKey, cfg]) => {
    if (!cfg.unitCost) return sum;
    return sum + (cfg.minValue + (submitted[fieldKey] ?? 0)) * cfg.unitCost;
  }, 0);
};

/** The price anchor for a market: what the reference build of it costs. */
export const priceAnchorCost = (genre: string): number =>
  specUnitCost(genre, priceAnchorSpec(genre));

/**
 * How TOLERANT a market is about price — the VoC weight for `selling_price`,
 * which cannot come from `direction` because that is 0 on every product.
 *
 *     weight = (max − min) / PRICE_MAX
 *
 * The share of the whole price universe this market will accept. A notebook
 * priced anywhere from $10 to $40 against a $40 ceiling takes 0.75 of it and is
 * tolerant; one confined to $5–$20 takes 0.375 and is not.
 *
 * ⚠ THE RATIO VERSION COULD NOT TELL $5–$20 FROM $10–$40. `min / (min + max)`
 * is scale-invariant — both are 1:4, both scored exactly 0.2000, and all four
 * live products came out "Tolerant". Any measure built only from the two bounds
 * has that flaw; separating them needs an ABSOLUTE divisor, which is what
 * `PRICE_MAX` is. Owner, 2026-10-15.
 *
 * Bounded [0, 1]: a span cannot exceed the ceiling it is measured against, and
 * the slider is capped at the same constant.
 *
 * ONE DEFINITION, TWO READERS — the market tab's label and the debrief's VoC
 * tick. They were separate, and a notebook could read "Tolerant" on one and
 * carry a high price weight on the other.
 */
export interface PriceSensitivity {
  /** `(max − min) / PRICE_MAX` on the market's `selling_price` field, [0, 1].
   *  HIGH means tolerant — the opposite of the ratio version it replaced. */
  weight: number;
  label: 'Tolerant' | 'Moderate' | 'Picky' | 'Very picky';
}

/**
 * EVEN QUARTERS of [0, 1]. Owner-set 2026-10-15.
 *
 * They can be even now because the weight uses the whole range: it is a share
 * of `PRICE_MAX`, so 0 and 1 are both real values rather than asymptotes. The
 * previous bands were four 0.025-wide slivers crowded at 0.250 — hand-tuned to
 * separate four products whose ratio-based weights spanned 0.06 in total, which
 * stopped separating anything the moment the bounds were re-authored.
 *
 * The cuts are `<=`, so a span landing exactly on a quarter takes the LOWER
 * band. Exact fractions rather than decimals: a $10–$40 span against a $40
 * ceiling is 0.75 precisely, and `0.75 <= 0.75` must not hinge on the last bit.
 *
 * Live, at PRICE_MAX 40:
 *     Anime 10–40 = 0.750 Tolerant    Cutesy 6–25 = 0.475 Moderate
 *     Indie 10–40 = 0.750 Tolerant    Minimalist 5–20 = 0.375 Moderate
 */
const PICKY_BANDS = {
  veryPicky: 1 / 4,   // 0.25 — span is a quarter of the universe or less
  picky:     1 / 2,   // 0.50
  moderate:  3 / 4,   // 0.75 — above this the market takes almost any price
} as const;

/**
 * THE formula, from bounds alone.
 *
 * Two entry points, one implementation: `priceSensitivity(genre)` resolves the
 * bounds from the hydrated `FIELD_CONFIG`, while the round debrief already has
 * them on the wire (`GET /round-debrief` ships raw `minValue`/`maxValue` rather
 * than normalising, precisely so this stays the only definition).
 */
export const priceSensitivityFromBounds = (
  minValue: number | null | undefined,
  maxValue: number | null | undefined,
): PriceSensitivity => {
  const lo = Number(minValue) || 0;
  const hi = Number(maxValue) || 0;
  // An unauthored field (both bounds 0) is NOT the most tolerant market — it is
  // no market at all, so it scores 0 and sits at the bottom of the axis rather
  // than the top. `PRICE_MAX` is read at call time, never captured at module
  // scope: it is `export let` and the operator's config can rebind it.
  const span = Math.max(0, hi - lo);
  const weight = PRICE_MAX > 0 ? Math.min(1, span / PRICE_MAX) : 0;
  return {
    // HIGH IS TOLERANT — a wide span means the market accepts most prices. The
    // ratio version this replaced read the other way round, so the bands were
    // inverted with it.
    weight,
    label:
      weight <= PICKY_BANDS.veryPicky ? 'Very picky'
      : weight <= PICKY_BANDS.picky ? 'Picky'
      : weight <= PICKY_BANDS.moderate ? 'Moderate'
      : 'Tolerant',
  };
};

/**
 * THE WEIGHT SCALE — 95% of customers, earned by a notebook's heaviest driver.
 *
 * ⚠ PER NOTEBOOK. Each archetype has its own divisor: its own top `direction`.
 * Owner, 2026-10-16. Two notebooks with different spec weightings therefore
 * produce different factors, and that is the point — a weight is read against
 * the market it belongs to, not against the catalogue.
 *
 * ONE DEFINITION, TWO SURFACES: the competitor report's Weight column
 * (`reportMatrix.ts`, where it is additionally ×8 for the 100-point product
 * score presentation) and the debrief's VoC axis (0..1, no multiplier — ×8
 * would run straight off the plot). The NORMALISATION is shared; the display
 * multiplier belongs to each surface.
 */
export const TOP_DRIVER_SHARE = 0.95;

/**
 * The divisor for one notebook, from its own `direction` weights.
 *
 * Takes the MAX rather than the first element. The report's field list happens
 * to be sorted by direction descending, so `fields[0]` is the max there today —
 * but that is invisible coupling, and the debrief's wire order is the
 * operator's `order`, where it would simply be wrong.
 *
 * Returns 1 for a notebook with no weighted driver: dividing by zero would send
 * every weight on that notebook to Infinity.
 */
export const weightScaleFor = (directions: readonly (number | null | undefined)[]): number => {
  const top = Math.max(0, ...directions.map((d) => Number(d) || 0));
  return top > 0 ? TOP_DRIVER_SHARE / top : 1;
};

/**
 * PRODUCT SCORE, as the player is shown it: `dynamicPrice × 8`, out of 100.
 *
 * `dynamicPrice` IS the unnormalised product score — `calcFinancials` builds it
 * as `Σ (resolved × bellFactor × direction)` over the priced spec fields, and
 * `Σ productScoreBreakdown === dynamicPrice` by construction. It runs 0..12.5,
 * so ×8 reads it out of 100.
 *
 * The owner's note on the scale, kept verbatim from its first home in
 * `CanvasStatusStrip`:
 *   value is multiplied by 2^3 as 2^3 only reverts resulting product score
 *   from the /4 derived from the sigma value.
 *   actual x4 means it's 2^3 as opposed to 2^2
 *
 * ONE definition, two surfaces — the HUD chip while the player designs, and the
 * round debrief afterwards. They must read the same number or "product score"
 * names two different things across one run.
 *
 * ⚠ NOT the server's `productScore` field, which is 0..1 and measures how the
 * asking price sits against `dynamicPrice` as its centre.
 */
export const PRODUCT_SCORE_SCALE = 8;

export const productScoreFromDynamicPrice = (
  dynamicPrice: number | null | undefined,
): number | null =>
  typeof dynamicPrice === 'number' && Number.isFinite(dynamicPrice)
    ? dynamicPrice * PRODUCT_SCORE_SCALE
    : null;

/** By GENRE ID — not a product name. `fieldCfg` misses on a product name and
 *  returns defaults silently, which type-checks and is wrong. */
export const priceSensitivity = (genre: string): PriceSensitivity => {
  const cfg = fieldCfg(genre, 'selling_price');
  return priceSensitivityFromBounds(cfg.minValue, cfg.maxValue);
};

export const driverAxes = (genre: string): DriverAxis[] =>
  Object.entries(FIELD_CONFIG[genre] ?? {})
    .filter(([key]) => !NON_DRIVER_KEYS.has(key))
    .map(([key, cfg]) => ({ key, label: cfg.label, direction: cfg.direction }))
    .sort((a, b) => (FIELD_CONFIG[genre][a.key].order - FIELD_CONFIG[genre][b.key].order));
