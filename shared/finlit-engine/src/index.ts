// Pure FinLit engine shared by the notebook player and gamesim server.
// bridge/adapter/storeRun stay in the player — those are Zustand/browser glue.
export * from './types';
export * from './fit';
export * from './simulate';
export * from './run';
export * from './engineMeta';
export * as finlitConfig from './config';
