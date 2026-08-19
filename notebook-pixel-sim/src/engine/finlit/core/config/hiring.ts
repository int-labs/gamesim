// Hiring candidates (sheet rows 30–46). Four named candidates, each with four
// levels. Level N doubles the production-rate and sell-rate of level 1; cost
// 5→10→20→40; energy 2→4→6→8. Candidates differ in prod-vs-sell balance
// (Ains = production-heavy, Chewie = sell-heavy, etc). Level 4 gated: "only if
// level 3 reached at Phase 1".
//
// prodBonus adds to prodPerDay (the `+H43` term); sellBonus adds to channel
// sell-rate (the `+I43` term).

export type CandidateId = 'ains' | 'beta' | 'chewie';

export interface HireLevel {
  level: 1 | 2 | 3 | 4;
  prodBonus: number;
  sellBonus: number;
  /** Flat $/unit reduction applied to every line's unit cost while this hire is engaged. */
  costReduction: number;
  cost: number;
  energy: number;
}

export interface CandidateDef {
  id: CandidateId;
  name: string;
  blurb: string;
  levels: HireLevel[];
}

// Energy costs per level (K col): 2/4/6/8. Cost per level (J col): 5/10/20/40.
export const CANDIDATES: CandidateDef[] = [
  {
    id: 'ains',
    name: 'Production Team',
    blurb: 'Increases production.',
    levels: [
      { level: 1, prodBonus: 0.49,  sellBonus: 0,     costReduction: 0, cost: 5,  energy: 2 },
      { level: 2, prodBonus: 0.98,  sellBonus: 0,     costReduction: 0, cost: 10, energy: 4 },
      { level: 3, prodBonus: 1.96,  sellBonus: 0,     costReduction: 0, cost: 20, energy: 6 },
      { level: 4, prodBonus: 3.92,  sellBonus: 0,     costReduction: 0, cost: 40, energy: 8 },
    ],
  },
  {
    id: 'beta',
    name: 'Marketing Team',
    blurb: 'Increases marketing potential.',
    levels: [
      { level: 1, prodBonus: 0,     sellBonus: 0.018, costReduction: 0, cost: 5,  energy: 2 },
      { level: 2, prodBonus: 0,     sellBonus: 0.036, costReduction: 0, cost: 10, energy: 4 },
      { level: 3, prodBonus: 0,     sellBonus: 0.072, costReduction: 0, cost: 20, energy: 6 },
      { level: 4, prodBonus: 0,     sellBonus: 0.144, costReduction: 0, cost: 40, energy: 8 },
    ],
  },
  {
    id: 'chewie',
    name: 'Materials Team',
    blurb: 'Reduces cost of production.',
    levels: [
      { level: 1, prodBonus: 0, sellBonus: 0, costReduction: 1, cost: 5,  energy: 2 },
      { level: 2, prodBonus: 0, sellBonus: 0, costReduction: 2, cost: 10, energy: 4 },
      { level: 3, prodBonus: 0, sellBonus: 0, costReduction: 4, cost: 20, energy: 6 },
      { level: 4, prodBonus: 0, sellBonus: 0, costReduction: 8, cost: 40, energy: 8 },
    ],
  },
];

export const candidateById = (id: CandidateId): CandidateDef => {
  const c = CANDIDATES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown candidate: ${id}`);
  return c;
};

export const hireLevel = (id: CandidateId, level: number): HireLevel => {
  const l = candidateById(id).levels.find((x) => x.level === level);
  if (!l) throw new Error(`Candidate ${id} has no level ${level}`);
  return l;
};
