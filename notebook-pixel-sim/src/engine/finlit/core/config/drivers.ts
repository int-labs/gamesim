// Operator copy for the customer-driver axes.
//
// The axes themselves are NOT here — `driverAxes()` in `fieldConfig.ts` derives
// them from the product's own fields, and their names are the operator's
// `ProductField.label`. This holds only the teaching copy a ProductField has no
// room for: a hint, and an optional label override.
//
// DELIBERATELY EMPTY BY DEFAULT. Every other config table in this folder ships
// bundled values as a fallback for an unreachable server; this one must not,
// because a bundled hint for `page_size` would keep describing "format and page
// count" after an operator repurposed that field. Absent copy renders no
// tooltip, which is correct — see the teaching-design note about surfaces that
// withhold rather than invent.

export interface DriverCopy {
  /** Overrides `ProductField.label` when set. */
  label?: string;
  /** What the decision MEANS — rendered as prose on the market card. Was a
   *  hover tooltip on the chart point until 2026-09-30. No entry = no row. */
  hint?: string;
}

/**
 * PRODUCT → field key → operator copy. Filled by `hydrateDriverCopy`.
 *
 * NESTED, 2026-09-30. It was a flat `fieldKey → copy`, on the reasoning that one
 * hint describes an axis rather than one product's copy of it. That is not true
 * of this game: `page_size` means something different on a pocket notebook than
 * on a desk one, and `direction` is already per product (Minimalist's
 * `page_size` is 0.145 against Anime's 0.057), so the copy has to be too.
 *
 * Keyed by `Product._id`, the same key `FIELD_CONFIG` uses — the operator's own
 * id, never a name match.
 */
export const DRIVER_COPY: Record<string, Record<string, DriverCopy>> = {};

/** Rows an operator left unscoped — a FALLBACK for any product with no row of
 *  its own, so copy written before the nesting keeps working. */
const UNSCOPED = '*';

/**
 * Lazy read — never snapshot this at module scope; it is empty until boot.
 *
 * The product's own copy wins; an unscoped row answers when it has none. Both
 * absent gives `{}`, which renders nothing rather than inventing a line.
 */
export const driverCopy = (productId: string, key: string): DriverCopy =>
  DRIVER_COPY[productId]?.[key] ?? DRIVER_COPY[UNSCOPED]?.[key] ?? {};

/**
 * Replace the copy table from the operator's `PlayerConfig.drivers` section.
 *
 * Mutates the exported container in place (empty, then refill) so every
 * importer sees the change — the container-hydration rule in CLAUDE.md. Rows
 * with no `id` are skipped rather than keyed under `undefined`; rows with no
 * `productId` land under `UNSCOPED` and act as the fallback above.
 */
export function hydrateDriverCopy(
  rows: Array<{
    id?: string;
    productId?: string | null;
    label?: string | null;
    hint?: string | null;
  }>,
): void {
  for (const key of Object.keys(DRIVER_COPY)) delete DRIVER_COPY[key];
  for (const row of rows) {
    if (!row?.id) continue;
    const entry: DriverCopy = {};
    if (row.label) entry.label = row.label;
    if (row.hint) entry.hint = row.hint;

    const parent = row.productId ? String(row.productId) : UNSCOPED;
    (DRIVER_COPY[parent] ??= {})[row.id] = entry;
  }
}
