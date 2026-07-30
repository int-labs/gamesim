// The player's funding route. Lifted from notebook-sim/src/types/index.ts,
// which is the player's global type barrel — the engine only needs this one
// declaration from it, so it is restated here rather than dragging the whole
// barrel (and its UI types) into the server.
//
// Kept byte-comparable on purpose: see server/src/test/finlitEngineParity.test.ts,
// which fails if this drifts from the player's definition.

export type Route = 'self' | 'investor';
