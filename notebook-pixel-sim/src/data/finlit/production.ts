// Production model config tables (sheet rows 27–52). Each option carries a
// multiplicative production-RATE and a per-unit COST. Production per day:
//
//   prodPerDay = type.rate × paper.rate × size.rate × design.rate
//                × addon.rate × cover.rate × BASERATE + hiringProdBonus
//
// Unit prod cost = Σ (cost of each chosen option).
// Verified against the sheet: G28 ≈ 7.818/day, unit cost example = $12.30.

export interface ConfigOption {
  id: string;
  name: string;
  /** Multiplicative production-rate factor (<1). */
  rate: number;
  /** Per-unit material cost ($). */
  cost: number;
}

// Type (rows 28–31) — one per genre; identical economics in the sheet.
export const TYPE_OPTIONS: ConfigOption[] = [
  { id: 'cute', name: 'Cute', rate: 0.1, cost: 5.0 },
  { id: 'anime', name: 'Anime', rate: 0.1, cost: 5.0 },
  { id: 'minimalist', name: 'Minimalist', rate: 0.1, cost: 5.0 },
  { id: 'indie', name: 'Indie', rate: 0.1, cost: 5.0 },
];

// Paper Material (rows 32–35).
export const PAPER_OPTIONS: ConfigOption[] = [
  { id: 'cream', name: 'Cream Paper', rate: 0.025, cost: 1.25 },
  { id: 'fountain', name: 'Fountain Pen Paper', rate: 0.015, cost: 1.5 },
  { id: 'recycled', name: 'Recycled Paper', rate: 0.027, cost: 0.75 },
  { id: 'black', name: 'Black Paper', rate: 0.03, cost: 1.35 },
];

// Size (rows 36–38).
export const SIZE_OPTIONS: ConfigOption[] = [
  { id: 'a5', name: 'A5', rate: 0.4, cost: 0.25 },
  { id: 'b4', name: 'B4', rate: 0.3, cost: 0.3 },
  { id: 'b5', name: 'B5', rate: 0.45, cost: 0.2 },
];

// Page Design (rows 39–43).
export const PAGE_DESIGN_OPTIONS: ConfigOption[] = [
  { id: 'lined', name: 'Lined', rate: 0.6, cost: 0.1 },
  { id: 'grid', name: 'Grid', rate: 0.52, cost: 0.15 },
  { id: 'storyboarding', name: 'Storyboarding', rate: 0.45, cost: 0.25 },
  { id: 'blank', name: 'Blank', rate: 0.8, cost: 0.05 },
  { id: 'numbered', name: 'Numbered', rate: 0.68, cost: 0.115 },
];

// Addons (rows 44–49).
export const ADDON_OPTIONS: ConfigOption[] = [
  { id: 'spiral', name: 'Spiral Bound', rate: 0.32, cost: 2.0 },
  { id: 'sewn', name: 'Sewn Binding', rate: 0.3, cost: 2.15 },
  { id: 'pen_holder', name: 'Pen Holder', rate: 0.33, cost: 1.85 },
  { id: 'bookmark', name: 'Bookmark Ribbon', rate: 0.31, cost: 1.5 },
  { id: 'corner', name: 'Corner Protectors', rate: 0.27, cost: 2.25 },
  { id: 'charms', name: 'Acrylic Charms', rate: 0.29, cost: 2.3 },
];

// Cover Page (rows 50–52).
export const COVER_OPTIONS: ConfigOption[] = [
  { id: 'hard', name: 'Hard Cover', rate: 0.2, cost: 2.55 },
  { id: 'plastic', name: 'Plastic Covers', rate: 0.35, cost: 1.5 },
  { id: 'holographic', name: 'Holographic Covers', rate: 0.125, cost: 2.95 },
];

export const CONFIG_TABLES = {
  type: TYPE_OPTIONS,
  paper: PAPER_OPTIONS,
  size: SIZE_OPTIONS,
  pageDesign: PAGE_DESIGN_OPTIONS,
  addon: ADDON_OPTIONS,
  cover: COVER_OPTIONS,
} as const;

export type ConfigAxis = keyof typeof CONFIG_TABLES;

export const configOption = (axis: ConfigAxis, id: string): ConfigOption => {
  const o = CONFIG_TABLES[axis].find((x) => x.id === id);
  if (!o) throw new Error(`Unknown ${axis} option: ${id}`);
  return o;
};

/** A full notebook production spec: one option id per axis. */
export interface ProductionSpec {
  type: string;
  paper: string;
  size: string;
  pageDesign: string;
  addon: string;
  cover: string;
}
