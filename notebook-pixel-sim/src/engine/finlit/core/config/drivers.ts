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

/** Field key → operator copy. Filled by `hydrateDriverCopy` from PlayerConfig. */
export interface DriverCopy {
  /** Overrides `ProductField.label` when set. */
  label?: string;
  /** Tooltip on the driver row. No entry = no tooltip. */
  hint?: string;
}

export const DRIVER_COPY: Record<string, DriverCopy> = {};

/** Lazy read — never snapshot this at module scope; it is empty until boot. */
export const driverCopy = (key: string): DriverCopy => DRIVER_COPY[key] ?? {};

/**
 * Replace the copy table from the operator's `PlayerConfig.drivers` section.
 *
 * Mutates the exported container in place (empty, then refill) so every
 * importer sees the change — the container-hydration rule in CLAUDE.md. Rows
 * with no `id` are skipped rather than keyed under `undefined`.
 */
export function hydrateDriverCopy(
  rows: Array<{ id?: string; label?: string | null; hint?: string | null }>,
): void {
  for (const key of Object.keys(DRIVER_COPY)) delete DRIVER_COPY[key];
  for (const row of rows) {
    if (!row?.id) continue;
    const entry: DriverCopy = {};
    if (row.label) entry.label = row.label;
    if (row.hint) entry.hint = row.hint;
    DRIVER_COPY[row.id] = entry;
  }
}
