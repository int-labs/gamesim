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

// Type — one per genre; identical economics by design.
export const TYPE_OPTIONS: ConfigOption[] = [
  { id: 'cute', name: 'Cute', score: 25 },
  { id: 'anime', name: 'Anime', score: 25 },
  { id: 'minimalist', name: 'Minimalist', score: 25 },
  { id: 'indie', name: 'Indie', score: 25 },
];

export const PAPER_OPTIONS: ConfigOption[] = [
  { id: 'cream', name: 'Cream Paper', score: 20 },
  { id: 'fountain', name: 'Fountain Pen Paper', score: 25 },
  { id: 'recycled', name: 'Recycled Paper', score: 15 },
  { id: 'black', name: 'Black Paper', score: 25 },
];

export const SIZE_OPTIONS: ConfigOption[] = [
  { id: 'a5', name: 'A5', score: 30 },
  { id: 'b4', name: 'B4', score: 45 },
  { id: 'b5', name: 'B5', score: 35 },
];

export const PAGE_DESIGN_OPTIONS: ConfigOption[] = [
  { id: 'lined', name: 'Lined', score: 55 },
  { id: 'grid', name: 'Grid', score: 60 },
  { id: 'storyboarding', name: 'Storyboarding', score: 70 },
  { id: 'blank', name: 'Blank', score: 40 },
  { id: 'numbered', name: 'Numbered', score: 45 },
];

export const ADDON_OPTIONS: ConfigOption[] = [
  { id: 'spiral', name: 'Spiral Bound', score: 20 },
  { id: 'sewn', name: 'Sewn Binding', score: 15 },
  { id: 'pen_holder', name: 'Pen Holder', score: 30 },
  { id: 'bookmark', name: 'Bookmark Ribbon', score: 15 },
  { id: 'corner', name: 'Corner Protectors', score: 15 },
  { id: 'charms', name: 'Acrylic Charms', score: 35 },
];

export const COVER_OPTIONS: ConfigOption[] = [
  { id: 'hard', name: 'Hard Cover', score: 35 },
  { id: 'plastic', name: 'Plastic Covers', score: 45 },
  { id: 'holographic', name: 'Holographic Covers', score: 55 },
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
