// The notebook catalogue, DERIVED from the engine's genre table.
//
// This file used to hold a hand-written record of three V2 product shapes
// (student / planner / daily) that had no connection to the four markets the
// simulation actually models. Two catalogues meant two things to keep in sync,
// and they had already drifted apart.
//
// Now there is one source of truth: `GENRES` in the FinLit engine config. That
// table is hydratable, so an operator publishing a fifth notebook makes it
// appear here too — no code change, no second list to update.

import { GENRES, genreArt, genreById, type GenreDef } from '@/engine/finlit/core/config/genres';
import { GENRE_TO_SEGMENT } from '@/engine/finlit/core/config/genreSegments';
import type { Archetype, Segment } from '@/types';

export interface ArchetypeInfo {
  id: Archetype;
  title: string;
  tagline: string;
  description: string;
  bestFor: Segment[];
  strengths: string[];
  tradeoffs: string[];
  /** Cover art, resolved through the filename convention or an operator upload. */
  art: string;
}

/** Fallback copy so a notebook published without prose still renders. */
const describe = (g: GenreDef): ArchetypeInfo => ({
  id: g.id,
  title: g.name,
  tagline: g.tagline ?? g.blurb,
  description: g.description ?? g.blurb,
  bestFor: [GENRE_TO_SEGMENT[g.id] ?? 'students'],
  strengths: g.strengths ?? [],
  tradeoffs: g.tradeoffs ?? [],
  art: genreArt(g.id),
});

/**
 * Every notebook currently in the catalogue, in table order.
 *
 * A getter, not a snapshot: `GENRES` is edited in place at boot by
 * `configHydrator`, so anything computed at module scope would freeze the
 * bundled values and silently ignore the operator's config.
 */
export const notebookCatalogue = (): ArchetypeInfo[] => GENRES.map(describe);

/** One notebook by id. Throws on an unknown id, like every other accessor. */
export const archetypeInfo = (id: Archetype): ArchetypeInfo => describe(genreById(id));

/** The id used when nothing else is known — always a real, present notebook. */
export const defaultArchetype = (): Archetype => GENRES[0].id;

/**
 * Back-compat shim for the `ARCHETYPE_INFO[id]` call sites.
 *
 * A Proxy rather than a plain object because it has to stay live: a built map
 * would capture the bundled genres before hydration and never see a published
 * one. Reads resolve against `GENRES` at access time.
 */
export const ARCHETYPE_INFO: Record<Archetype, ArchetypeInfo> = new Proxy(
  {} as Record<Archetype, ArchetypeInfo>,
  {
    get: (_t, key: string) => (typeof key === 'string' ? describe(genreById(key)) : undefined),
    has: (_t, key: string) => GENRES.some((g) => g.id === key),
    ownKeys: () => GENRES.map((g) => g.id),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  },
);
