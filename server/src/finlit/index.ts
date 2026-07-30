// The FinLit (V3) simulation engine, server side.
//
// WHY THIS EXISTS
// The player owns this engine (notebook-sim/src/engine/finlit + src/data/finlit).
// Scoring must be authoritative, so the server has to run the same model — a
// client-submitted score would be trivially forgeable.
//
// WHY IT IS A COPY
// The player's sources import their config through the `@/` path alias, which
// TypeScript resolves at compile time only; `tsc` does not rewrite module
// specifiers, so compiling those files in place from here would additionally
// require tsconfig-paths (ts-node) plus tsc-alias (build), a rootDir/outDir
// shift, a `start` script change, and a Dockerfile that copies the player
// folder before building the server. That couples the backend build to the
// player app for five engine files.
//
// Instead the pure subset is vendored here with relative imports. The obvious
// hazard is drift, so it is guarded rather than trusted:
// `server/src/test/finlitEngineParity.test.ts` compares every vendored file
// against the player's original and FAILS on any difference. Sync is therefore
// a deliberate, visible act — re-copy and let the test confirm.
//
// Only the pure, deterministic subset lives here. Deliberately NOT vendored:
//   bridge.ts    maps results into the UI ledger
//   storeRun.ts  couples to the player's zustand store
//   index.ts     the player's barrel, which re-exports both of the above

export type {
  FinlitLine,
  FinlitDecisions,
  FinlitPhaseResult,
  FinlitDaySnapshot,
  FinlitLineResult,
} from './engine/types';
export type { Route } from './engine/route';

export { vocFit } from './engine/fit';
export { simulatePhase } from './engine/simulate';
export { runFullGame } from './engine/run';
export type { FinlitGameConfig, FinlitGameResult } from './engine/run';
export { toFinlitLines, toFinlitDecisions } from './engine/adapter';
export type { LineInput } from './engine/adapter';
