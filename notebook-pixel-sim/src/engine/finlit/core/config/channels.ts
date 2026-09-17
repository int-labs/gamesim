// Sales channels — the operator's `channel` GlobalInput, mirrored locally so
// the UI has display values without re-resolving impacts at every call site.
//
// FLAT, one row per channel. It used to be a genre × channel MATRIX
// (`CHANNELS_BY_GENRE`), which existed to fill two "by market" reference tables
// in the operations detail sheet. Those tables are gone, and with them the
// reason for the genre axis:
//
//   • `split` (the `sales_channel` impact) was the only field that varied by
//     genre, and only the reach table read it. The SERVER reads that impact
//     itself — the client never computed with it.
//   • `sellRate` was bundled teaching content for the other table, per-day, from
//     the retired local engine.
//   • `consignment` / `inventoryCost` were written identically across every
//     genre, so the axis carried no information for them at all.
//
// A fixed-column matrix also needs a fixed column set, which is what pinned the
// channel count at the bundled three. One row per channel scales with however
// many the operator configures.

import type { GlobalInputItemDto } from '@/gamesim/types';

/**
 * The backend `channel` GlobalInput item's `key`. A STRING, not a union of the
 * three bundled ids: the operator decides how many channels exist, and a union
 * made every extra one unassignable.
 *
 * The bundled entries below are a FALLBACK for offline play, not the allowed set.
 */
export type ChannelId = string;

export interface ChannelRow {
  channel: ChannelId;
  /** Per-SALE fee. Hydrates and displays, but `calcFinancials` has no per-sale
   *  term, so it moves no money yet — deliberate, to surface in UAT. */
  consignment: number;
  // NO `inventoryCost`. It mirrored the server's `inventory_cost` impact, which
  // was deleted with the holding charge on 2026-09-17: there is no warehouse
  // here, and COGS already lands on the build.
}

export const CHANNEL_META: Record<string, { name: string; blurb: string }> = {
  offline: { name: 'Offline', blurb: 'Direct/pop-up sales. No consignment, lowest overhead.' },
  online: { name: 'Online', blurb: 'Always-on storefront. Consignment fee, broad reach.' },
  retail: { name: 'Retail', blurb: 'Shelf placement. Highest consignment cut.' },
};

/** Mutated in place by `hydrateChannels` — importers hold this array, so it
 *  must never be reassigned. See CLAUDE.md, Tunable game data. */
export const CHANNEL_ROWS: ChannelRow[] = [
  { channel: 'offline', consignment: 0 },
  { channel: 'online', consignment: 8 },
  { channel: 'retail', consignment: 11.8 },
];

/** Throws on an unknown channel, like every other accessor here — a dropped id
 *  is a crash to fix, not a cosmetic gap. */
export const channelRow = (channel: ChannelId): ChannelRow => {
  const r = CHANNEL_ROWS.find((x) => x.channel === channel);
  if (!r) throw new Error(`No row for channel ${channel}`);
  return r;
};

// Impact key → ChannelRow field. There is deliberately no `sell_rate` impact:
// one that moves no number is a field the operator fills in for nothing, and
// hydration for a key nobody authors is a path that says nothing. Both crowd
// the thinking rather than clarifying it. `inventory_cost` was dropped from
// this list on 2026-09-17 for the same reason once the holding charge went.
const FIELDS: { impactKey: string; rowField: 'consignment' }[] = [
  { impactKey: 'consignment', rowField: 'consignment' },
];

/**
 * Populate CHANNEL_META and CHANNEL_ROWS from the backend `channel` GlobalInput.
 *
 * NO CEILING. This used to open with `if (!CHANNEL_META[chId]) continue;` and
 * only wrote rows that already existed, so the bundled three were the most
 * channels a simulation could have — a fourth was configurable, hydrated
 * nothing, and appeared nowhere. Meta and rows are CREATED on demand.
 */
export function hydrateChannels(items: GlobalInputItemDto[]): void {
  for (const item of items) {
    const chId = item.key as ChannelId;

    // The backend's label wins; its description falls back to a bundled blurb
    // when there is one, which a channel the bundle never had does not have.
    CHANNEL_META[chId] = {
      name: item.label,
      blurb: item.description ?? CHANNEL_META[chId]?.blurb ?? '',
    };

    let row = CHANNEL_ROWS.find((r) => r.channel === chId);
    if (!row) {
      // Zeros, not invented numbers — a fabricated fee reads exactly like a
      // real one. The impacts below overwrite whichever ones are configured.
      row = { channel: chId, consignment: 0 };
      CHANNEL_ROWS.push(row);
    }

    for (const { impactKey, rowField } of FIELDS) {
      const impact = item.impacts[impactKey];
      if (impact) row[rowField] = impact.value;
    }
  }
}
