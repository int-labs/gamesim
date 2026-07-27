// Slot-based add-on placement.
// Every add-on is anchored to a named slot relative to the notebook canvas
// (the square that contains the notebook image). Slot coordinates are
// percentages of the notebook frame.

export type AddOnSlot =
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-bl'
  | 'corner-br'
  | 'center-label'
  | 'cover-band-v' // ribbon wrap, vertical
  | 'cover-band-h' // elastic band, horizontal
  | 'edge-right'   // sticking out the right edge (bookmark)
  | 'bundle';      // beside the notebook (pen, etc.)

export interface SlotPlacement {
  x: number;     // % of frame width (0..100), of the centre point
  y: number;     // % of frame height
  scale: number; // 0..1 width relative to frame width
  rotate?: number; // optional rotation
  zHint?: number;  // base z within stack
}

// Tuned so add-ons sit on the notebook cover instead of floating over the
// desk background. The notebook image fills a 1:1 frame; the cover (yellow)
// area is roughly x:18..82, y:18..82 in the source art.
//
// Placement strategy:
//   - Charms hang from the upper-RIGHT corner (the corner farthest from the
//     ring binding, so they read as "keychain off the cover edge").
//   - Decorative add-ons (stickers, name labels, sticker packs) cluster on
//     the LOWER cover so they don't fight the notebook's identity.
//   - Functional add-ons (band, closure, bookmark) hug the cover edges.
//
// All percentages are of the 1:1 frame containing the notebook image.
// The y-axis sweet spot for the cover is roughly 35-72 — outside that the
// art tapers and add-ons start clipping over the desk.
export const SLOT: Record<AddOnSlot, SlotPlacement> = {
  // Charms hang off the top-right corner of the notebook (away from binding)
  'corner-tr':    { x: 78, y: 26, scale: 0.20, zHint: 2 },
  'corner-tl':    { x: 30, y: 26, scale: 0.20, zHint: 2 },
  // Sticker packs cluster on the lower cover, just below the name label
  'corner-bl':    { x: 38, y: 68, scale: 0.26, zHint: 1, rotate: -4 },
  'corner-br':    { x: 62, y: 70, scale: 0.22, zHint: 1, rotate: 3 },
  // Name sticker is the visual anchor — sits dead-center on the cover.
  'center-label': { x: 52, y: 52, scale: 0.40, zHint: 1 },
  // Ribbon wrap runs vertically through the cover centre
  'cover-band-v': { x: 50, y: 50, scale: 0.42, zHint: 3 },
  // Elastic band crosses horizontally across the lower-middle cover
  'cover-band-h': { x: 50, y: 60, scale: 0.58, zHint: 2 },
  // Bookmark peeks from the right edge of the cover (lower so it reads as
  // emerging from the pages rather than floating beside the cover)
  'edge-right':   { x: 84, y: 64, scale: 0.16, zHint: 0 },
  // Pen/pencil bundle sits beside the notebook (package accessory)
  'bundle':       { x: 100, y: 65, scale: 0.30, zHint: 0 },
};
