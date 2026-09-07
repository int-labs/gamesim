// FinLit (V3) DATA — the single import surface for the operator-hydrated
// catalogs. Originally transcribed from `FinLit Calc.xlsx`; see
// docs/V3-FINLIT-PRD.md.
//
// No `model` any more: it held per-day formulas (`× PHASE_LENGTH_DAYS`) with no
// callers. Every number the sheet shows is the server's — see
// ../../../../../../server/README.md.

export * from './constants';
export * from './genres';
export * from './production';
export * from './channels';
export * from './hiring';
export * from './marketing';
export * from './vendors';
export * from './scenarios';
