import { assetUrl } from '@/assets';
import type { BaseDataDto, ProductDto } from '@/gamesim/types';
import { productCopy } from './productCopy';

// The notebook catalogue = the backend's Products, one per market.
//
// This table used to ship four hand-written rows whose `demand` curves were a
// hand-copied duplicate of `baseData.marketData` — verified equal, figure for
// figure. That made the frontend a second source for numbers the backend owns,
// and it went stale silently. It is now EMPTY until `hydrateGenres` fills it
// from the wire.

/**
 * A notebook / market id — the backend Product's `_id` since 2026-09-14.
 *
 * DELIBERATELY `string`, not a literal union: ids are operator data. It used to
 * hold frontend-authored slugs (`'cute'`, `'indie'`) which `hydrateFieldConfig`
 * bound to Products by matching `productName.includes(genreId)` — a substring
 * match that worked only by luck of naming.
 *
 * Safety comes from the accessors, not the type: `genreById` throws on an
 * unknown id.
 */
export type GenreId = string;

export interface GenreDef {
  id: GenreId;
  /** Display name — the operator's `Product.productName`, or a PlayerConfig override. */
  name: string;
  /**
   * Total addressable market per phase, from `baseData` `yearlyData[0..3].marketSize`.
   *
   * Year `-1` is NOT read. It exists for a printed edition of the copy and has
   * no meaning on the web, where `p0` is the pre-play baseline.
   */
  demand: { p0: number; p1: number; p2: number; p3: number };
  /** One line on who buys it. */
  blurb: string;
  /** Short hook shown under the title in the details modal. */
  tagline?: string;
  /** The full paragraph in the details modal. */
  description?: string;
  strengths?: string[];
  tradeoffs?: string[];
  /**
   * Cover art. Undefined until an operator uploads one, so `genreArt()` falls
   * back to the filename convention `assets/img/notebooks/<id>.png`.
   */
  imgPath?: string;
}

/**
 * EMPTY until boot. Filled in place by `hydrateGenres` so every importer sees
 * the change — the container-hydration rule in CLAUDE.md. Never snapshot it at
 * module scope.
 */
export const GENRES: GenreDef[] = [];

const PHASE_KEYS = [
  ['p0', '0'],
  ['p1', '1'],
  ['p2', '2'],
  ['p3', '3'],
] as const;

/** `baseData` market curve for one product, zeroed when the operator has none. */
function demandFor(baseData: BaseDataDto | null, productId: string): GenreDef['demand'] {
  const out = { p0: 0, p1: 0, p2: 0, p3: 0 };
  const row = baseData?.marketData?.segments
    ?.flatMap((s) => s.products ?? [])
    .find((p) => String(p.productId) === productId);
  if (!row?.yearlyData) return out;
  for (const [field, year] of PHASE_KEYS) {
    out[field] = row.yearlyData[year]?.marketSize ?? 0;
  }
  return out;
}

/**
 * Replace the catalogue from the backend's Products, keyed by `Product._id`.
 *
 * Presentation is layered on by id match from PlayerConfig (`PRODUCT_COPY`),
 * never authored here — see the `products` section in configHydrator. A product
 * with no published copy shows its own `productName` and no prose, which is a
 * legitimate state rather than a gap to fill with a bundled default.
 */
export function hydrateGenres(products: ProductDto[], baseData: BaseDataDto | null): void {
  GENRES.length = 0;
  for (const p of products) {
    if (p.active === false) continue;
    const id = String(p._id);
    const copy = productCopy(id);
    GENRES.push({
      id,
      name: copy.name || p.productName,
      demand: demandFor(baseData, id),
      blurb: copy.blurb ?? '',
      description: copy.description ?? p.description ?? undefined,
      // The Details tab's STRENGTHS / WEAKNESS panels. Operator-owned, so an
      // unpublished list renders an empty panel rather than invented copy.
      strengths: copy.bestFor ?? [],
      tradeoffs: copy.watchOut ?? [],
      ...(copy.art ? { imgPath: copy.art } : {}),
    });
  }
}

export const genreById = (id: GenreId): GenreDef => {
  const g = GENRES.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown genre: ${id}`);
  return g;
};

/**
 * Cover art for a notebook, resolved in priority order:
 *   1. `imgPath` — the operator's upload, via PlayerConfig's `products` section
 *   2. `assets/img/notebooks/<id>.png` — the filename convention
 *   3. a bundled placeholder, so an id with no art still renders
 *
 * Encoded because ids come from operator data. NOTE: ids are Product `_id`s
 * now, so the filename convention means `<_id>.png` — upload art in the console
 * rather than relying on it.
 */
export const genreArt = (id: GenreId): string => {
  const g = GENRES.find((x) => x.id === id);
  if (g?.imgPath) return g.imgPath;
  return assetUrl(`img/notebooks/${id}.png`);
};

/**
 * THE growth coefficient: `1 − from / to`, i.e. the change as a fraction of the
 * END value. Matches the sheet's Growth rows.
 *
 * Deliberately NOT `to / from − 1` (change over the START value), which is the
 * more common reading and gives a bigger number for the same movement. The
 * Market Data tab used to compute its total that way while the per-market
 * badges used this one, so the same run reported two different growth figures.
 * Every growth figure goes through here.
 */
export const growthCoefficient = (from: number, to: number): number =>
  to === 0 ? 0 : 1 - from / to;

/** Per-phase growth of a genre's demand (matches sheet's Growth rows). */
export function genreGrowth(g: GenreDef, from: keyof GenreDef['demand'], to: keyof GenreDef['demand']): number {
  return growthCoefficient(g.demand[from], g.demand[to]);
}
