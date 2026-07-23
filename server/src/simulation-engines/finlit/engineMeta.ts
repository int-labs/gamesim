// Version stamps recorded on every TeamRoundDecision/TeamRoundResult so a
// later config or formula change never silently reinterprets historical data.
// Bump FINLIT_ENGINE_VERSION when simulate.ts/run.ts/fit.ts change; bump
// FINLIT_CONFIG_VERSION when anything under ./config changes.
export const FINLIT_ENGINE_KEY = "finlit-phase";
export const FINLIT_ENGINE_VERSION = "1.0.0";
export const FINLIT_CONFIG_VERSION = "notebook-v3-2026-07";
