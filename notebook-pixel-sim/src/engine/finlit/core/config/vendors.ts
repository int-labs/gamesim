// Shipping vendors / supply-chain partners — hydrated at boot from the
// backend's globalInputs (key: 'supply_chain'). Only the inventory (production
// rate) impact is carried; there is no per-genre coverage table or sell bonus.
//
// Quality is derived from prodBonus using the operator's mapping:
//   perfect  > 0.75  |  good  > 0.60  |  average  > 0.35  |  none  otherwise
//
// Genre coverage is resolved at hydration time: productsImpacted ObjectIds are
// matched against the bootstrap products array to produce coveredGenres (string
// genre ids). Components use coveredGenres to gate vendor availability per line.

import type { GlobalInputItemDto } from '@/gamesim/types';
import { GENRES } from './genres';

export type VendorId = string;
export type VendorQuality = 'perfect' | 'good' | 'average' | 'none';

export interface VendorDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  energy: number;
  /** Product ObjectIds from the backend — raw reference. */
  productsImpacted: string[];
  /** Genre ids this vendor covers, resolved at hydration from productsImpacted. */
  coveredGenres: string[];
  /** Production rate augment — applied as prodPerDay × (1 + prodBonus). */
  prodBonus: number;
  quality: VendorQuality;
}

export const VENDORS: VendorDef[] = [];

function deriveQuality(prodBonus: number): VendorQuality {
  if (prodBonus > 0.75) return 'perfect';
  if (prodBonus > 0.60) return 'good';
  if (prodBonus > 0.35) return 'average';
  return 'none';
}

export function hydrateVendors(
  items: GlobalInputItemDto[],
  products: { _id: string; productName: string }[],
): void {
  const productGenre = new Map<string, string>();
  for (const p of products) {
    const lower = p.productName.toLowerCase();
    const genre = GENRES.find((g) => lower.includes(g.id.toLowerCase()));
    if (genre) productGenre.set(p._id, genre.id);
  }

  VENDORS.length = 0;
  for (const item of items) {
    const prodBonus = item.impacts['inventory']?.value ?? 0;
    const coveredGenres = item.productsImpacted
      .map(String)
      .flatMap((id) => {
        const g = productGenre.get(id);
        return g ? [g] : [];
      });
    VENDORS.push({
      id: item.key,
      name: item.label,
      description: item.description ?? '',
      cost: item.cost,
      energy: item.energy,
      productsImpacted: item.productsImpacted.map(String),
      coveredGenres,
      prodBonus,
      quality: deriveQuality(prodBonus),
    });
  }
}

export function vendorById(id: string): VendorDef | undefined {
  return VENDORS.find((v) => v.id === id);
}
