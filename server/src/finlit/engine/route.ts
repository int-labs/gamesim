// The player's funding route.
//
// This used to declare the type itself, restated from the player's global type
// barrel. That was a structural change on top of the import rewrite, and it
// broke the invariant the vendored copy rests on — that the copy is a purely
// MECHANICAL transform of the original. Upstream, `core/types.ts` declares
// `Route` inline, so the synced `./types` does too, and restating it here
// would be a second source of truth for one union.
//
// Kept as a re-export because other vendored files import the type from this
// path, and because `npm run sync-finlit` would otherwise need a special case.
export type { Route } from "./types";
