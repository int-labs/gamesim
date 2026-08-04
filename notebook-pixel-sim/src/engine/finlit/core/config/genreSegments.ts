// Genre → legacy V2 segment.
//
// Lives here rather than in `mockEngine` so `src/data/` can read it without a
// circular import (mockEngine imports data, data would import mockEngine).
//
// The V2 segment axis is only still around because a couple of phase gates and
// the "best for" badge read it. It is a LOOKUP WITH A FALLBACK, not a total
// map: notebook ids are open-ended now, so a notebook published by an operator
// will not have an entry here and must not crash anything.

import type { GenreId } from './genres';

/** Segment ids as used by `src/data/segments.ts`. */
export type LegacySegment = 'students' | 'creators' | 'professionals' | 'gift';

const MAP: Record<string, LegacySegment> = {
  cute: 'creators',
  anime: 'gift',
  minimalist: 'professionals',
  indie: 'students',
};

/**
 * The segment a notebook sells into. Unknown ids fall back to `students`
 * rather than throwing — an operator can publish a notebook this build has
 * never heard of, and a missing badge is not worth a crash.
 */
export const GENRE_TO_SEGMENT: Record<string, LegacySegment> = new Proxy(MAP, {
  get: (t, key: string) => (typeof key === 'string' ? (t[key] ?? 'students') : undefined),
});

export const segmentForGenre = (id: GenreId): LegacySegment => MAP[id] ?? 'students';
