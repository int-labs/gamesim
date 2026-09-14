// Notebook spec config. The frontend owns the input SHAPE; the backend owns
// every FORMULA. One scalar per option — `score` — drives all three of them.
// See ../../../../../../server/README.md#score

export interface ConfigOption {
  id: string;
  name: string;
  /** 0-100, authored from the design sheet. Higher = costlier, slower, further
   *  from the price curve's peak. Never derived from another column. */
  score: number;
}

/**
 * Type — one per notebook, identical economics by design.
 *
 * EMPTY until boot: the type axis IS the product choice, so its ids are
 * `Product._id` and it is refilled by `hydrateTypeOptions` from the same
 * catalogue as `GENRES`. It used to hold frontend-authored slugs, which
 * `configOption` (which THROWS on an unknown id) could not resolve once a spec
 * started carrying product ids.
 */
export const TYPE_OPTIONS: ConfigOption[] = [];

/**
 * The score every notebook type carries.
 *
 * INERT for cost: `CONFIG_TABLES.type.fieldKey` is null, so `specUnitCost`
 * skips this axis entirely — the notebook type's real cost is `page_design`'s
 * `minValue` (also 15, and not a coincidence). Kept so the axis still reports a
 * score to anything that asks.
 */
const TYPE_SCORE = 15;

/** Refill the type axis in place from the backend catalogue. */
export function hydrateTypeOptions(rows: Array<{ id: string; name: string }>): void {
  TYPE_OPTIONS.length = 0;
  for (const r of rows) TYPE_OPTIONS.push({ id: r.id, name: r.name, score: TYPE_SCORE });
}

export const PAPER_OPTIONS: ConfigOption[] = [
  { id: 'recycled', name: 'Recycled Paper', score: 6 },
  { id: 'cream', name: 'Cream Paper', score: 7 },
  { id: 'black', name: 'Black Paper', score: 8 },
  { id: 'fountain', name: 'Fountain Pen Paper', score: 9 },
];

export const SIZE_OPTIONS: ConfigOption[] = [
  { id: 'a5', name: 'A5', score: 6 },
  { id: 'b4', name: 'B4', score: 8 },
  { id: 'b5', name: 'B5', score: 10 },
];

export const PAGE_DESIGN_OPTIONS: ConfigOption[] = [
  { id: 'blank', name: 'Blank', score: 5 },
  { id: 'lined', name: 'Lined', score: 8 },
  { id: 'grid', name: 'Grid', score: 10 },
  { id: 'numbered', name: 'Numbered', score: 12 },
  { id: 'storyboarding', name: 'Storyboarding', score: 14 },
];

export const ADDON_OPTIONS: ConfigOption[] = [
  { id: 'spiral', name: 'Spiral Bound', score: 4 },
  { id: 'sewn', name: 'Sewn Binding', score: 6 },
  { id: 'pen_holder', name: 'Pen Holder', score: 9 },
  { id: 'bookmark', name: 'Bookmark Ribbon', score: 10 },
  { id: 'corner', name: 'Corner Protectors', score: 8 },
  { id: 'charms', name: 'Acrylic Charms', score: 7 },
];

export const COVER_OPTIONS: ConfigOption[] = [
  { id: 'plastic', name: 'Plastic Covers', score: 8 },
  { id: 'hard', name: 'Hard Cover', score: 10 },
  { id: 'holographic', name: 'Holographic Covers', score: 12 },
];

/**
 * An axis and its DESTINATION, declared together — `fieldKey` is the server
 * ProductField it submits to. Keep them in one declaration: a mismatch is
 * SILENT (`toDecisionFields` does `if (!field) return []`).
 *
 * `type` is explicitly `null` — it has no server field and submits nothing.
 */
export const CONFIG_TABLES = {
  type: { fieldKey: null, options: TYPE_OPTIONS },
  paper: { fieldKey: 'paper_material', options: PAPER_OPTIONS },
  size: { fieldKey: 'page_size', options: SIZE_OPTIONS },
  pageDesign: { fieldKey: 'page_design', options: PAGE_DESIGN_OPTIONS },
  addon: { fieldKey: 'addons', options: ADDON_OPTIONS },
  cover: { fieldKey: 'cover_page', options: COVER_OPTIONS },
} as const;

export type ConfigAxis = keyof typeof CONFIG_TABLES;

export const configOption = (axis: ConfigAxis, id: string): ConfigOption => {
  const o = CONFIG_TABLES[axis].options.find((x) => x.id === id);
  if (!o) throw new Error(`Unknown ${axis} option: ${id}`);
  return o;
};

/** The score for an axis/option, or 0 when the spec has not chosen one. */
export const optionScore = (axis: ConfigAxis, id: string | undefined): number =>
  id ? configOption(axis, id).score : 0;

/** A full notebook production spec: one option id per axis. */
export interface ProductionSpec {
  type: string;
  paper: string;
  size: string;
  pageDesign: string;
  addon: string;
  cover: string;
}

/**
 * The REFERENCE spec: a lean, plausible build of any notebook.
 *
 * Two jobs, deliberately one object so they cannot disagree:
 *   1. what a newly added notebook starts on (`defaultLine`), and
 *   2. the basis of the PRICE ANCHOR shown on the market cards — what a
 *      sensible build of this notebook costs, so a player has something to
 *      price against instead of guessing.
 *
 * Lives here with the tables it indexes into.
 */
export const PRICE_ANCHOR: Omit<ProductionSpec, 'type'> = {
  paper: 'recycled',
  size: 'b5',
  pageDesign: 'blank',
  addon: 'bookmark',
  cover: 'plastic',
};

/** `type` mirrors the genre — it is the notebook's identity, not a choice. */
export const priceAnchorSpec = (genre: string): ProductionSpec => ({
  type: genre,
  ...PRICE_ANCHOR,
});

