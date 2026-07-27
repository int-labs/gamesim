// Default placement per add-on category — normalized 0..1 relative to the
// NOTEBOOK square (the AddOnLayer renders inside the hero), so a toggled-on
// decoration lands neatly ON the cover, pre-sized, no dragging. Positions
// target the cover face of the angled notebook art (roughly x:0.28..0.72,
// y:0.22..0.78). Add-ons are cosmetic — placement never affects the score.

import type { AddOnCategory } from '@/types';

export interface DefaultPlacement {
  x: number;
  y: number;
  scale: number;
  rotation?: number;
  zIndex: number;
}

// Fixed layout by add-on TYPE (per the reference): every add-on has ONE home
// zone so the notebook always reads as an intentional, tidy arrangement —
//   • CHARM   → top-LEFT  (hooks over the corner; on the TOP layer)
//   • RIBBON  → top-RIGHT (hangs off the corner; on the TOP layer)
//   • STICKER → MIDDLE of the cover
//   • FUNCTIONAL → OUTSIDE the notebook, bottom-RIGHT
// Charm/ribbon get the highest z so they always sit above stickers. Some
// pieces intentionally overhang the notebook edges (the layer doesn't clip).

export const DEFAULT_PLACEMENT: Record<AddOnCategory, DefaultPlacement> = {
  // ── TOP LAYER — corners, overhanging the notebook edges ──
  // Charm — top-LEFT: clasp hooks OVER the top edge, bear body hangs down onto
  // the cover's upper-left corner (overhangs up + left, like the reference).
  integrated_charm:           { x: 0.27, y: 0.13, scale: 0.30, zIndex: 9 },
  // Ribbon/bow — top-RIGHT: bow sits ON the top-right corner and pokes ABOVE it.
  integrated_ribbon:          { x: 0.76, y: 0.16, scale: 0.30, zIndex: 9 },

  // ── MIDDLE — stickers / decorative sit centred on the cover face ──
  integrated_sticker_name:    { x: 0.48, y: 0.44, scale: 0.42, zIndex: 6 },
  integrated_sticker_pack:    { x: 0.48, y: 0.44, scale: 0.40, zIndex: 6 },
  decorative_washi:           { x: 0.49, y: 0.32, scale: 0.50, zIndex: 4 },
  decorative_pattern:         { x: 0.49, y: 0.44, scale: 0.56, zIndex: 2 },
  decorative_bundle:          { x: 0.49, y: 0.45, scale: 0.38, zIndex: 4 },

  // ── OUTSIDE — functional pieces sit OFF the notebook at the bottom-RIGHT,
  //    angled so they read as clipped-on accessories (bookmark, band, pen). ──
  functional_bookmark:        { x: 0.84, y: 0.74, scale: 0.20, rotation: -16, zIndex: 5 },
  functional_band:            { x: 0.85, y: 0.76, scale: 0.20, rotation: -20, zIndex: 5 },
  functional_closure:         { x: 0.85, y: 0.76, scale: 0.21, rotation: -20, zIndex: 5 },
  functional_clip:            { x: 0.84, y: 0.73, scale: 0.17, rotation: -16, zIndex: 5 },
  writing_tool:               { x: 0.85, y: 0.75, scale: 0.26, rotation: -26, zIndex: 5 },
};

/** Lookup with fallback. Used when category is unknown / missing. */
export const defaultPlacementFor = (category: AddOnCategory | undefined): DefaultPlacement => {
  if (category && DEFAULT_PLACEMENT[category]) return DEFAULT_PLACEMENT[category];
  return { x: 0.5, y: 0.5, scale: 0.25, zIndex: 5 };
};

/** Bounds for the free-drag editor. Add-ons are clamped to these ranges. */
export const PLACEMENT_BOUNDS = {
  xMin: 0.05,
  xMax: 0.95,
  yMin: 0.05,
  yMax: 0.95,
  scaleMin: 0.10,
  scaleMax: 0.90,
} as const;
