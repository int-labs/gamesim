// Pure FinLit engine (V3), browser-only. It powers the game's simulation and
// its local projections, which are indicative UX numbers — NOT the official
// score. The gamesim server never imports this: competitive results come from
// its own calcMarketModel/calcFinancials (see src/gamesim/).
// bridge/adapter/storeRun stay one level up — those are Zustand/browser glue.
export * from './types';
export * from './fit';
export * from './simulate';
export * from './run';
export * from './engineMeta';
export * as finlitConfig from './config';
