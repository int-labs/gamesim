// Notebook genres = the four markets (DEC A). Each genre has its own demand
// curve across phases (sheet rows 2–9) and a VoC preference vector — the PDF's
// "VoC Alignment" chart — over the five decision axes, so config alignment
// still drives fit (LP1). Preference weights sum-normalised at use time.

export type GenreId = 'cute' | 'anime' | 'minimalist' | 'indie';

/** VoC importance per decision axis (0..1). Higher = this market cares more. */
export interface VoCPreference {
  design: number;
  price: number;
  channel: number;
  size: number;
  paper: number;
}

export interface GenreDef {
  id: GenreId;
  name: string;
  /** Total addressable market demand per phase (units of "market need"). */
  demand: { pMinus1: number; p0: number; p1: number; p2: number; p3: number };
  voc: VoCPreference;
  blurb: string;
}

// Demand values are the sheet's rows 2/4/6/8 (cols B..F = Phase −1..3).
export const GENRES: GenreDef[] = [
  {
    id: 'cute',
    name: 'Cute',
    demand: { pMinus1: 10115, p0: 12212, p1: 14507, p2: 17115, p3: 20759 },
    // Cute buyers: decoration/design-led, mid price sensitivity.
    voc: { design: 0.95, price: 0.7, channel: 0.6, size: 0.4, paper: 0.5 },
    blurb: 'Decoration-led buyers who want charm and personality on the cover.',
  },
  {
    id: 'anime',
    name: 'Anime',
    demand: { pMinus1: 9752, p0: 11506, p1: 14093, p2: 17108, p3: 21023 },
    // Anime fans: design + collectible cover, willing to pay for the right art.
    voc: { design: 1.0, price: 0.55, channel: 0.65, size: 0.5, paper: 0.6 },
    blurb: 'Fandom collectors chasing the right art - design and cover matter most.',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    demand: { pMinus1: 12503, p0: 14022, p1: 16409, p2: 18552, p3: 21543 },
    // Minimalist: paper quality + function over decoration; price-tolerant.
    voc: { design: 0.4, price: 0.5, channel: 0.55, size: 0.7, paper: 0.95 },
    blurb: 'Function-first writers who value clean paper and restraint over flourish.',
  },
  {
    id: 'indie',
    name: 'Indie',
    demand: { pMinus1: 11594, p0: 14233, p1: 17562, p2: 19527, p3: 22511 },
    // Indie: balanced, channel-savvy, paper + design both count.
    voc: { design: 0.75, price: 0.6, channel: 0.8, size: 0.6, paper: 0.75 },
    blurb: 'Taste-driven independents who reward a coherent, well-placed product.',
  },
];

export const genreById = (id: GenreId): GenreDef => {
  const g = GENRES.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown genre: ${id}`);
  return g;
};

/** Per-phase growth of a genre's demand (matches sheet's Growth rows). */
export function genreGrowth(g: GenreDef, from: keyof GenreDef['demand'], to: keyof GenreDef['demand']): number {
  const f = g.demand[from];
  const t = g.demand[to];
  return t === 0 ? 0 : 1 - f / t;
}
