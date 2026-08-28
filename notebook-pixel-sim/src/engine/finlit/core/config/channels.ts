// Sales channels (sheet rows 13–24). Each genre sells through Offline / Online
// / Retail, each with a demand SPLIT, a daily MAINTENANCE cost, a CONSIGNMENT
// fee, an INVENTORY cost, and a base SELL-RATE.
//
// Customers / 30d for a (genre × channel):
//   demand(genre, phase) × (sellRate + hiringSellBonus) × 30
//     × BASE_MARKET_SHARE × split
// earn/30d ≈ (customers) × UNIT_CONTRIBUTION.
//
// NOTE — the sheet anchored every row to one demand cell ($D$8, Indie/P1) as a
// working simplification. We use each genre's OWN per-phase demand (the model's
// clear intent). This is the single deliberate correction; see PRD §DEC B.

import type { GlobalInputItemDto } from '@/gamesim/types';
import { GENRES } from './genres';
import type { GenreId } from './genres';

export type ChannelId = 'offline' | 'online' | 'retail';

export interface ChannelRow {
  channel: ChannelId;
  split: number;
  maintenance: number;
  consignment: number;
  inventoryCost: number;
  sellRate: number;
}

export const CHANNEL_META: Record<ChannelId, { name: string; blurb: string }> = {
  offline: { name: 'Offline', blurb: 'Direct/pop-up sales. No consignment, lowest overhead.' },
  online: { name: 'Online', blurb: 'Always-on storefront. Consignment fee, broad reach.' },
  retail: { name: 'Retail', blurb: 'Shelf placement. Highest overhead + inventory cost.' },
};

// Per-genre channel rows. Splits/sell-rates differ by genre (sheet C/G cols).
export const CHANNELS_BY_GENRE: Record<GenreId, ChannelRow[]> = {
  cute: [
    { channel: 'offline', split: 0.35, maintenance: 10, consignment: 0, inventoryCost: 0, sellRate: 0.04 },
    { channel: 'online', split: 0.35, maintenance: 11.5, consignment: 8, inventoryCost: 0, sellRate: 0.04 },
    { channel: 'retail', split: 0.3, maintenance: 15, consignment: 11.8, inventoryCost: 11.8, sellRate: 0.02 },
  ],
  anime: [
    { channel: 'offline', split: 0.3, maintenance: 10, consignment: 0, inventoryCost: 0, sellRate: 0.03 },
    { channel: 'online', split: 0.4, maintenance: 11.5, consignment: 8, inventoryCost: 0, sellRate: 0.04 },
    { channel: 'retail', split: 0.3, maintenance: 15, consignment: 11.8, inventoryCost: 11.8, sellRate: 0.03 },
  ],
  minimalist: [
    { channel: 'offline', split: 0.3, maintenance: 10, consignment: 0, inventoryCost: 0, sellRate: 0.027 },
    { channel: 'online', split: 0.3, maintenance: 11.5, consignment: 8, inventoryCost: 0, sellRate: 0.033 },
    { channel: 'retail', split: 0.4, maintenance: 15, consignment: 11.8, inventoryCost: 11.8, sellRate: 0.04 },
  ],
  indie: [
    { channel: 'offline', split: 0.4, maintenance: 10, consignment: 0, inventoryCost: 0, sellRate: 0.04 },
    { channel: 'online', split: 0.3, maintenance: 11.5, consignment: 8, inventoryCost: 0, sellRate: 0.0225 },
    { channel: 'retail', split: 0.3, maintenance: 15, consignment: 11.8, inventoryCost: 11.8, sellRate: 0.0375 },
  ],
};

export const channelRow = (genre: GenreId, channel: ChannelId): ChannelRow => {
  const r = CHANNELS_BY_GENRE[genre].find((x) => x.channel === channel);
  if (!r) throw new Error(`No ${channel} row for genre ${genre}`);
  return r;
};

// Impact key → ChannelRow field for per-product-aware fields
const SELECTION_FIELDS: { impactKey: string; rowField: 'split' | 'sellRate' }[] = [
  { impactKey: 'sales_channel', rowField: 'split' },
  { impactKey: 'sell_rate',     rowField: 'sellRate' },
];

// Impact key → ChannelRow field for flat (non-per-product) fields
const FLAT_FIELDS: { impactKey: string; rowField: 'maintenance' | 'consignment' | 'inventoryCost' }[] = [
  { impactKey: 'maintenance',   rowField: 'maintenance' },
  { impactKey: 'consignment',   rowField: 'consignment' },
  { impactKey: 'inventory_cost',rowField: 'inventoryCost' },
];

/**
 * Populate CHANNEL_META and all ChannelRow fields from the backend `channel`
 * GlobalInput. Fields with per-product selections (split, sellRate) resolve
 * per genre; flat fields (maintenance, consignment, inventoryCost) use the
 * impact default value uniformly across all genres.
 */
export function hydrateChannels(
  items: GlobalInputItemDto[],
  products: { _id: string; productName: string }[],
): void {
  // Build productId → genreId map
  const productGenre = new Map<string, GenreId>();
  for (const p of products) {
    const lower = p.productName.toLowerCase();
    const genre = GENRES.find((g) => lower.includes(g.id.toLowerCase()));
    if (genre) productGenre.set(String(p._id), genre.id as GenreId);
  }

  // Build genreId → productIds map for selection lookups
  const genreProducts = new Map<GenreId, string[]>();
  for (const [productId, genreId] of productGenre) {
    const list = genreProducts.get(genreId) ?? [];
    list.push(productId);
    genreProducts.set(genreId, list);
  }

  const genres = Object.keys(CHANNELS_BY_GENRE) as GenreId[];

  for (const item of items) {
    const chId = item.key as ChannelId;
    if (!CHANNEL_META[chId]) continue;

    // Update display metadata
    CHANNEL_META[chId] = {
      name: item.label,
      blurb: item.description ?? CHANNEL_META[chId].blurb,
    };

    // Per-product-aware fields: resolve per genre via selections
    for (const { impactKey, rowField } of SELECTION_FIELDS) {
      const impact = item.impacts[impactKey];
      if (!impact) continue;
      const selections = impact.selections ?? [];

      for (const genreId of genres) {
        const row = CHANNELS_BY_GENRE[genreId].find((r) => r.channel === chId);
        if (!row) continue;
        const genreProductIds = genreProducts.get(genreId) ?? [];
        const match = selections.find((s) => genreProductIds.includes(String(s.productId)));
        row[rowField] = match ? match.value : impact.value;
      }
    }

    // Flat fields: apply the same value across all genres
    for (const { impactKey, rowField } of FLAT_FIELDS) {
      const impact = item.impacts[impactKey];
      if (!impact) continue;
      for (const genreId of genres) {
        const row = CHANNELS_BY_GENRE[genreId].find((r) => r.channel === chId);
        if (row) row[rowField] = impact.value;
      }
    }
  }
}
