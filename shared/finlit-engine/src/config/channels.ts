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
