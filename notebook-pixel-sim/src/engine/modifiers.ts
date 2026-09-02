// Modifier system.
//
// Events push windowed effects (modifiers) into state.activeModifiers.
// On each day-tick the engine:
//   1. Expires modifiers whose endDay has passed (expireModifiers)
//   2. Aggregates the remaining ones into a single multiplier bundle
//      (aggregateActive) used by demand / cost / production formulas
//
// All multiplier-style effects stack MULTIPLICATIVELY:
//   two modifiers with demandMult 1.2 produce 1.44× demand.
// Additive effects (defectAdd) stack ADDITIVELY.
//
// `endDay: null` means permanent (or until-end-of-game).
//
// Note: state.modifiers (singular `Modifier[]`) is a deprecated field that
// the persist migration may still hydrate from older saves. The engine no
// longer reads it. The active system is state.activeModifiers.

export interface ActiveModifier {
  id: string;
  name: string;
  cause: string;
  startDay: number;
  endDay: number | null;
  effects: {
    materialCostMult?: number;
    demandMult?: number;
    priceMult?: number;
    capacityMult?: number;
    defectAdd?: number;
    retentionMult?: number;
    marketingMult?: number;
  };
}

export interface ActiveAggregate {
  materialCostMult: number;
  demandMult: number;
  priceMult: number;
  capacityMult: number;
  defectAdd: number;
  retentionMult: number;
  marketingMult: number;
}

export const makeModifierId = (): string => `amod-${Math.random().toString(36).slice(2, 10)}`;

/** Reduce active modifiers into a single multiplier/additive bundle. */
export const aggregateActive = (mods: ActiveModifier[]): ActiveAggregate => {
  const out: ActiveAggregate = {
    materialCostMult: 1,
    demandMult: 1,
    priceMult: 1,
    capacityMult: 1,
    defectAdd: 0,
    retentionMult: 1,
    marketingMult: 1,
  };
  for (const m of mods) {
    const e = m.effects;
    if (e.materialCostMult !== undefined && Number.isFinite(e.materialCostMult)) out.materialCostMult *= e.materialCostMult;
    if (e.demandMult !== undefined && Number.isFinite(e.demandMult)) out.demandMult *= e.demandMult;
    if (e.priceMult !== undefined && Number.isFinite(e.priceMult)) out.priceMult *= e.priceMult;
    if (e.capacityMult !== undefined && Number.isFinite(e.capacityMult)) out.capacityMult *= e.capacityMult;
    if (e.defectAdd !== undefined && Number.isFinite(e.defectAdd)) out.defectAdd += e.defectAdd;
    if (e.retentionMult !== undefined && Number.isFinite(e.retentionMult)) out.retentionMult *= e.retentionMult;
    if (e.marketingMult !== undefined && Number.isFinite(e.marketingMult)) out.marketingMult *= e.marketingMult;
  }
  return out;
};
