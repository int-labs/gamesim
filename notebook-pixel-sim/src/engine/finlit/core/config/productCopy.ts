// Operator presentation for the notebooks, keyed by PRODUCT _id.
//
// The notebooks themselves are NOT here — the backend's Product documents are
// the catalogue, and every number on them (fields, baseVariables, minValue,
// unitCost) is read straight off the wire. This holds only what a Product has
// no room for: an art upload and the teaching prose around it.
//
// DELIBERATELY EMPTY BY DEFAULT, for the same reason as `drivers.ts`: a bundled
// blurb for one product _id would keep describing a notebook the operator has
// since repurposed. Absent copy falls back to the Product's own `productName`
// and renders no prose, which is correct.

/** Product _id → operator presentation. Filled by `hydrateProductCopy`. */
export interface ProductCopy {
  /** Overrides `Product.productName` when set. */
  name?: string;
  /** One-line blurb under the notebook's name. */
  blurb?: string;
  /** Longer prose for the Details tab. */
  description?: string;
  /** Cover art URL from the operator's upload. */
  art?: string;
  /** Details tab, STRENGTHS panel — one bullet per entry. */
  bestFor?: string[];
  /** Details tab, WEAKNESS panel — one bullet per entry. */
  watchOut?: string[];
  /**
   * SEGMENTS tab — who buys this notebook, as operator flavour and lore.
   *
   * HTML as stored, and ALREADY SANITISED — the admin console cleans it on the
   * way into the database (owner's ruling 2026-09-30). Everything else in this
   * table is plain text a component decides how to present; this one arrives as
   * markup because an operator needs headings and lists that no fixed layout
   * can anticipate.
   *
   * Do NOT add a pass here or in `SegmentsTab`. One boundary, on the admin side:
   * a second opinion about what is safe is how the two come to disagree.
   */
  segments?: string;
}

export const PRODUCT_COPY: Record<string, ProductCopy> = {};

/** Lazy read — never snapshot this at module scope; it is empty until boot. */
export const productCopy = (id: string): ProductCopy => PRODUCT_COPY[id] ?? {};

/**
 * Replace the table from the operator's `PlayerConfig.products` section.
 *
 * Mutates the exported container in place (empty, then refill) so every
 * importer sees the change — the container-hydration rule in CLAUDE.md. Rows
 * with no `id` are skipped rather than keyed under `undefined`.
 */
export function hydrateProductCopy(
  rows: Array<{
    id?: string;
    name?: string | null;
    blurb?: string | null;
    description?: string | null;
    art?: string | null;
    segments?: string | null;
    bestFor?: string[] | null;
    watchOut?: string[] | null;
  }>,
): void {
  for (const key of Object.keys(PRODUCT_COPY)) delete PRODUCT_COPY[key];
  for (const row of rows) {
    if (!row?.id) continue;
    const entry: ProductCopy = {};
    if (row.name) entry.name = row.name;
    if (row.blurb) entry.blurb = row.blurb;
    if (row.description) entry.description = row.description;
    if (row.art) entry.art = row.art;
    if (row.segments) entry.segments = row.segments;
    // Empty arrays are dropped, not stored: an absent list renders an empty
    // panel, which is the same outcome and one less shape to reason about.
    if (row.bestFor?.length) entry.bestFor = row.bestFor.filter(Boolean);
    if (row.watchOut?.length) entry.watchOut = row.watchOut.filter(Boolean);
    PRODUCT_COPY[row.id] = entry;
  }
}
