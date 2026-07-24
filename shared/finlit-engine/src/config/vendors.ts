// Shipping vendors / stockists (sheet rows 55–87). Each store covers some
// genres (not all — a "–" means unavailable). Per genre it offers a QUALITY,
// a SELL-RATE bonus, and a PRODUCTION-RATE bonus, at a COST. Stores unlock by
// level: Level 1 at Phase 1, Level 2 at Phase 2 (roughly ×2–3 scaling).
//
// PDF says "3 vendors"; the calc defines 4 stores. We transcribe all four
// (the numeric source of truth) and let the picker offer a subset if desired.

import type { GenreId } from './genres';

export type VendorId = 'als' | 'emils' | 'phoebes' | 'nines';
export type VendorQuality = 'perfect' | 'good' | 'average' | 'none';

export interface VendorCoverage {
  cost: number;
  quality: VendorQuality;
  sellBonus: number;
  prodBonus: number;
}

export interface VendorDef {
  id: VendorId;
  name: string;
  /** Energy cost to engage the vendor, per level (L1 = Phase 1, L2 = Phase 2). */
  energyByLevel: { 1: number; 2: number };
  /** coverage[level][genre] — quality 'none' + cost 0 means "doesn't stock it". */
  coverage: Record<1 | 2, Record<GenreId, VendorCoverage>>;
}

const none: VendorCoverage = { cost: 0, quality: 'none', sellBonus: 0, prodBonus: 0 };

export const VENDORS: VendorDef[] = [
  {
    id: 'als',
    name: "Al's Store",
    energyByLevel: { 1: 8, 2: 18 },
    coverage: {
      1: {
        cute: none,
        anime: { cost: 40, quality: 'perfect', sellBonus: 0.145, prodBonus: 3.1 },
        minimalist: { cost: 30, quality: 'average', sellBonus: 0.1, prodBonus: 3.125 },
        indie: { cost: 40, quality: 'good', sellBonus: 0.125, prodBonus: 3.1 },
      },
      2: {
        cute: none,
        anime: { cost: 120, quality: 'perfect', sellBonus: 0.31581, prodBonus: 6.6898 },
        minimalist: { cost: 90, quality: 'average', sellBonus: 0.2178, prodBonus: 6.74375 },
        indie: { cost: 120, quality: 'good', sellBonus: 0.27225, prodBonus: 6.6898 },
      },
    },
  },
  {
    id: 'emils',
    name: "Emil's Shop",
    energyByLevel: { 1: 8, 2: 18 },
    coverage: {
      1: {
        cute: { cost: 35, quality: 'good', sellBonus: 0.1, prodBonus: 3.1 },
        anime: { cost: 45, quality: 'perfect', sellBonus: 0.145, prodBonus: 3.125 },
        minimalist: none,
        indie: { cost: 45, quality: 'good', sellBonus: 0.1, prodBonus: 3.25 },
      },
      2: {
        cute: { cost: 105, quality: 'good', sellBonus: 0.2178, prodBonus: 6.6898 },
        anime: { cost: 135, quality: 'perfect', sellBonus: 0.31581, prodBonus: 6.74375 },
        minimalist: none,
        indie: { cost: 135, quality: 'good', sellBonus: 0.2178, prodBonus: 7.0135 },
      },
    },
  },
  {
    id: 'phoebes',
    name: "Phoebe's Books",
    energyByLevel: { 1: 8, 2: 18 },
    coverage: {
      1: {
        cute: { cost: 40, quality: 'good', sellBonus: 0.125, prodBonus: 3.4 },
        anime: none,
        minimalist: { cost: 25, quality: 'average', sellBonus: 0.1, prodBonus: 3.1 },
        indie: { cost: 35, quality: 'good', sellBonus: 0.125, prodBonus: 3.1 },
      },
      2: {
        cute: { cost: 120, quality: 'good', sellBonus: 0.27225, prodBonus: 7.3372 },
        anime: none,
        minimalist: { cost: 75, quality: 'average', sellBonus: 0.2178, prodBonus: 6.6898 },
        indie: { cost: 105, quality: 'good', sellBonus: 0.27225, prodBonus: 6.6898 },
      },
    },
  },
  {
    id: 'nines',
    name: "Nine's Wares",
    energyByLevel: { 1: 8, 2: 18 },
    coverage: {
      1: {
        cute: { cost: 25, quality: 'average', sellBonus: 0.1, prodBonus: 3.1 },
        anime: none,
        minimalist: { cost: 35, quality: 'perfect', sellBonus: 0.145, prodBonus: 3.25 },
        indie: { cost: 45, quality: 'perfect', sellBonus: 0.145, prodBonus: 3.25 },
      },
      2: {
        cute: { cost: 75, quality: 'average', sellBonus: 0.2178, prodBonus: 6.6898 },
        anime: none,
        minimalist: { cost: 105, quality: 'perfect', sellBonus: 0.31581, prodBonus: 7.0135 },
        indie: { cost: 135, quality: 'perfect', sellBonus: 0.31581, prodBonus: 7.0135 },
      },
    },
  },
];

export const vendorById = (id: VendorId): VendorDef => {
  const v = VENDORS.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown vendor: ${id}`);
  return v;
};

export const vendorCoverage = (id: VendorId, level: 1 | 2, genre: GenreId): VendorCoverage =>
  vendorById(id).coverage[level][genre];
