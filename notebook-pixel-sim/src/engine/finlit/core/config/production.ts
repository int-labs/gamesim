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

// ADDON_OPTIONS and the `addon` axis were DELETED 2026-09-23. "Add-ons" is a
// CATEGORY — the umbrella over charms / ribbons / stickers / functional in
// ProductPanel's ADDON_GROUPS — not something a notebook submits. Its table had
// drifted into a grab-bag that duplicated the real axes (`charms`, `bookmark`)
// against a different server field with a different direction.
//
// The `addons` server field was removed from every product in the same update,
// verified against the live documents. Do not re-add either half alone.

export const COVER_OPTIONS: ConfigOption[] = [
  { id: 'plastic', name: 'Plastic Covers', score: 8 },
  { id: 'hard', name: 'Hard Cover', score: 10 },
  { id: 'holographic', name: 'Holographic Covers', score: 12 },
];

// ── The canvas add-on axes ───────────────────────────────────────────────────
//
// Four server fields that had NO axis and therefore submitted nothing:
// `charms`, `ribbons`, `stickers`, `functional`. All four are authored on every
// notebook-sim product as `money` fields (min 0, max 25 — `stickers` max 20 on
// Anime, 100 elsewhere) with their own per-notebook `direction`. Verified
// against the live documents, not inferred.
//
// Ids are the ADDONS catalogue's, so an option and the art it selects are the
// same row. Scores are the owner's score sheet, copied verbatim.
//
// OPTIONAL axes: a notebook with no charm scores 0 through `optionScore`, so
// `PRICE_ANCHOR` and the default specs are deliberately untouched — making them
// required would put a charm, a ribbon, stickers and a clasp on every notebook
// ever created and lift the price anchor with it.

export const CHARM_OPTIONS: ConfigOption[] = [
  { id: 'charm_bear', name: 'Bear Charm', score: 2 },
  { id: 'charm_cat', name: 'Cat Charm', score: 3.5 },
  { id: 'charm_penguin', name: 'Penguin Charm', score: 5 },
];

export const RIBBON_OPTIONS: ConfigOption[] = [
  { id: 'ribbon_red', name: 'Red Ribbon Wrap', score: 3.5 },
  { id: 'ribbon_pink', name: 'Pink Ribbon Wrap', score: 5 },
];

export const STICKER_OPTIONS: ConfigOption[] = [
  { id: 'sticker_name', name: 'Name Sticker', score: 2 },
  { id: 'sticker_basic', name: 'Sticker Pack', score: 3.5 },
  { id: 'sticker_cute', name: 'Cute Sticker Pack', score: 5.5 },
];

export const FUNCTIONAL_OPTIONS: ConfigOption[] = [
  { id: 'bookmark', name: 'Bookmark Ribbon', score: 2 },
  { id: 'band', name: 'Elastic Band', score: 3 },
  { id: 'closure', name: 'Magnetic Closure', score: 4 },
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
  cover: { fieldKey: 'cover_page', options: COVER_OPTIONS },
  // `categories` — the canvas categories this axis OWNS. Several fold into one
  // axis (two sticker kinds, three functional pieces), and the axis holds ONE
  // id, so the drawer's swap rule is per AXIS and not per category. Declared
  // here for the same reason `fieldKey` is: an axis and its inputs in one place.
  charms: { fieldKey: 'charms', options: CHARM_OPTIONS, categories: ['integrated_charm'] },
  ribbons: { fieldKey: 'ribbons', options: RIBBON_OPTIONS, categories: ['integrated_ribbon'] },
  stickers: {
    fieldKey: 'stickers',
    options: STICKER_OPTIONS,
    categories: ['integrated_sticker_name', 'integrated_sticker_pack'],
  },
  functional: {
    fieldKey: 'functional',
    options: FUNCTIONAL_OPTIONS,
    categories: ['functional_bookmark', 'functional_band', 'functional_closure'],
  },
} as const;

/**
 * The axis a canvas add-on category belongs to, or `undefined` for a category
 * no axis claims.
 *
 * Built from CONFIG_TABLES, so adding a category to an axis above is the whole
 * change — there is no second list to keep in step.
 */
export function axisForAddOnCategory(category: string | undefined): ConfigAxis | undefined {
  if (!category) return undefined;
  for (const [axis, table] of Object.entries(CONFIG_TABLES) as [ConfigAxis, { categories?: readonly string[] }][]) {
    if (table.categories?.includes(category)) return axis;
  }
  return undefined;
}

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
  cover: string;
  /** OPTIONAL — a notebook need not carry any of these, and an absent axis
   *  scores 0 via `optionScore`. Required keys would force one of each onto
   *  every notebook and move the price anchor with them. */
  charms?: string;
  ribbons?: string;
  stickers?: string;
  functional?: string;
}

/**
 * The REFERENCE spec PER NOTEBOOK, keyed by `Product._id`.
 *
 * Two jobs, deliberately one table so they cannot disagree:
 *   1. what a newly added notebook of that type starts on (`defaultLine`), and
 *   2. the basis of the PRICE ANCHOR on the market cards — what a sensible
 *      build of THIS notebook costs, so a player has something to price
 *      against instead of guessing.
 *
 * KEYED, not shared. One spec for every market priced them all off the same
 * build, so the anchor differed between notebooks only by their unit costs and
 * never by what a lean version of each actually is — a lean anime notebook and
 * a lean minimalist one are not the same object.
 *
 * `DEFAULT_PRICE_ANCHOR` answers for an id with no entry. It is a real state,
 * not a guard: the catalogue is the operator's, so a notebook can exist here
 * before anyone has written its anchor, and pricing it off a plain build beats
 * rendering nothing.
 *
 * ⚠ These ids belong to ONE simulation's data. Frontend-only is the owner's
 * call, but it means a different deployment's ids simply miss and take the
 * default — silently. If that becomes a problem the anchor belongs on the
 * Product document, not in a longer table here.
 *
 * Lives here with the tables it indexes into.
 */
const DEFAULT_PRICE_ANCHOR: Omit<ProductionSpec, 'type'> = {
  paper: 'recycled',
  size: 'b5',
  pageDesign: 'blank',
  cover: 'plastic',
};

export const PRICE_ANCHOR: Record<string, Omit<ProductionSpec, 'type'>> = {
  // One entry per notebook, e.g.
  //   '6a4b…': { paper: 'premium', size: 'a5', pageDesign: 'dotted', cover: 'hardcover' },
};

/**
 * `type` mirrors the product — it is the notebook's identity, not a choice.
 *
 * Read at CALL TIME, never merged at module scope: `PRICE_ANCHOR` is edited in
 * place, and a snapshot taken on import would freeze whatever it held then.
 */
export const priceAnchorSpec = (productId: string): ProductionSpec => ({
  type: productId,
  ...(PRICE_ANCHOR[productId] ?? DEFAULT_PRICE_ANCHOR),
});

