// Pure FinLit engine, ported verbatim (no formula changes) from
// notebook-pixel-sim origin/V3 src/engine/finlit/{types,fit,simulate,run}.ts.
// bridge.ts/adapter.ts/storeRun.ts were deliberately NOT ported — those are
// notebook-pixel-sim's Zustand/browser-store glue, not part of the pure engine.
export * from './types';
export * from './fit';
export * from './simulate';
export * from './run';
