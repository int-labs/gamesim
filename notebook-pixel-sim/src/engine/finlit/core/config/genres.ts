import { assetUrl } from '@/assets';

// Notebook genres = the four markets (DEC A). Each genre has its own demand
// curve across phases (sheet rows 2–9) and a VoC preference vector — the PDF's
// "VoC Alignment" chart — over the five decision axes, so config alignment
// still drives fit (LP1). Preference weights sum-normalised at use time.

/**
 * A notebook / market id.
 *
 * DELIBERATELY `string`, not a literal union. The operator's PlayerConfig can
 * append genres at runtime (`configHydrator` → `mergeById`, which appends
 * genuinely new rows, and `coupledCoreIsSafe`, which rejects any addition that
 * lacks channel rows or vendor coverage). A closed union would have been a lie
 * the moment a 5th notebook was published, and would have forced a code change
 * for what is meant to be pure data.
 *
 * Safety does not come from the type, it comes from the accessors: `genreById`
 * throws on an unknown id, and the hydrator validates the whole graph before
 * anything is applied.
 */
export type GenreId = string;

export interface GenreDef {
  id: GenreId;
  /** Display name, e.g. "Cute Notebook". */
  name: string;
  /** Total addressable market demand per phase (units of "market need"). */
  demand: { pMinus1: number; p0: number; p1: number; p2: number; p3: number };
  /** One line on who buys it. */
  blurb: string;
  /** Short hook shown under the title in the details modal. */
  tagline?: string;
  /** The full paragraph in the details modal. */
  description?: string;
  strengths?: string[];
  tradeoffs?: string[];
  /**
   * Cover art. Left undefined in the bundle so `genreArt()` can fall back to
   * the filename convention — a new notebook only needs its PNG dropped in
   * `assets/img/notebooks/<id>.png`. The hydrator overwrites this with an
   * operator-uploaded URL when one is published.
   */
  imgPath?: string;
}

// Demand values are the sheet's rows 2/4/6/8 (cols B..F = Phase −1..3).
export const GENRES: GenreDef[] = [
  {
    id: 'cute',
    name: 'Cute Notebook',
    demand: { pMinus1: 10115, p0: 12212, p1: 14507, p2: 17115, p3: 20759 },
    blurb: 'Decoration-led buyers who want charm and personality on the cover.',
    tagline: 'Charming, decorated, hard to put down.',
    description:
      'A pastel notebook built to be seen. Hearts, stars and a soft cover carry it more than the paper inside. Buyers pick it up because it is lovely, so decoration earns its cost here in a way it does not elsewhere.',
    strengths: [
      'Design is weighted highest of any market - decoration pays back',
      'Steady, forgiving demand growth across all three phases',
      'Tolerates a mid price when the cover justifies it',
    ],
    tradeoffs: [
      'Cheap covers read as cheap fast - buyers notice',
      'Paper quality is barely rewarded, so premium stock is wasted spend',
      'Price still matters: it is decorative, not luxury',
    ],
  },
  {
    id: 'anime',
    name: 'Anime Notebook',
    demand: { pMinus1: 9752, p0: 11506, p1: 14093, p2: 17108, p3: 21023 },
    blurb: 'Fandom collectors chasing the right art - design and cover matter most.',
    tagline: 'Collectible cover art, and fans who know it.',
    description:
      'A character cover for people who buy with their eyes and their fandom. Design is weighted higher here than in any other market, and the buyer is the least price-sensitive of the four - get the art right and the price argument mostly disappears.',
    strengths: [
      'Highest design weighting in the game - art is the whole product',
      'Least price-sensitive buyers, so margin headroom is real',
      'Fastest-growing market by Phase 3 (+45%)',
    ],
    tradeoffs: [
      'A weak cover has nothing else to fall back on',
      'Smallest market today - it grows into its size',
      'Needs channel reach to find the fans in the first place',
    ],
  },
  {
    id: 'minimalist',
    name: 'Minimalist Notebook',
    demand: { pMinus1: 12503, p0: 14022, p1: 16409, p2: 18552, p3: 21543 },
    blurb: 'Function-first writers who value clean paper and restraint over flourish.',
    tagline: 'No decoration. Just very good paper.',
    description:
      'A plain cover and an elastic band, sold on what is inside. This is the one market that pays for paper stock and size over anything on the front, and it forgives a higher price for getting them right.',
    strengths: [
      'Paper quality is weighted highest here - premium stock finally pays',
      'Largest market today, so volume is available from day one',
      'Price-tolerant buyers reward a well-made object',
    ],
    tradeoffs: [
      'Decoration is nearly worthless - spend on covers is burnt',
      'Slowest growth of the four (+35%)',
      'Cheap paper is immediately obvious to this buyer',
    ],
  },
  {
    id: 'indie',
    name: 'Indie Notebook',
    demand: { pMinus1: 11594, p0: 14233, p1: 17562, p2: 19527, p3: 22511 },
    blurb: 'Taste-driven independents who reward a coherent, well-placed product.',
    tagline: 'Well made, well placed, nothing wasted.',
    description:
      'A considered notebook for buyers with taste and opinions. Nothing is weighted extremely, which makes this the most balanced market - but it cares about CHANNEL more than any other, so where you sell it matters as much as what you made.',
    strengths: [
      'Biggest market at every phase, including the end of the run',
      'Rewards paper and design together - no wasted investment',
      'Balanced weighting is forgiving of an imperfect spec',
    ],
    tradeoffs: [
      'Highest channel weighting - a great notebook nobody can find fails',
      'No single lever carries it, so it needs broad competence',
      'Middling price tolerance leaves less margin than Anime',
    ],
  },
];

export const genreById = (id: GenreId): GenreDef => {
  const g = GENRES.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown genre: ${id}`);
  return g;
};

/**
 * Cover art for a notebook, resolved in priority order:
 *   1. `imgPath` — set by the hydrator from an operator upload
 *   2. `assets/img/notebooks/<id>.png` — the filename convention
 *   3. a bundled placeholder, so an id with no art still renders
 *
 * This is why adding a notebook needs no code: drop `<id>.png` in that folder
 * (or upload art in the console) and it appears. Encoded because ids come from
 * operator data and could contain characters that need escaping in a URL.
 */
export const genreArt = (id: GenreId): string => {
  const g = GENRES.find((x) => x.id === id);
  if (g?.imgPath) return g.imgPath;
  return assetUrl(`img/notebooks/${id}.png`);
};

/** Per-phase growth of a genre's demand (matches sheet's Growth rows). */
export function genreGrowth(g: GenreDef, from: keyof GenreDef['demand'], to: keyof GenreDef['demand']): number {
  const f = g.demand[from];
  const t = g.demand[to];
  return t === 0 ? 0 : 1 - f / t;
}
