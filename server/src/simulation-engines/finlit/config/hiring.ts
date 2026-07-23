// Hiring candidates (sheet rows 30–46). Four named candidates, each with four
// levels. Level N doubles the production-rate and sell-rate of level 1; cost
// 5→10→20→40; energy 2→4→6→8. Candidates differ in prod-vs-sell balance
// (Ains = production-heavy, Chewie = sell-heavy, etc). Level 4 gated: "only if
// level 3 reached at Phase 1".
//
// prodBonus adds to prodPerDay (the `+H43` term); sellBonus adds to channel
// sell-rate (the `+I43` term).

export type CandidateId = 'ains' | 'beta' | 'chewie' | 'danoct';

export interface HireLevel {
  level: 1 | 2 | 3 | 4;
  prodBonus: number;
  sellBonus: number;
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
    name: 'Ains',
    blurb: 'Production powerhouse - highest output, modest sell lift.',
    levels: [
      { level: 1, prodBonus: 0.49, sellBonus: 0.01, cost: 5, energy: 2 },
      { level: 2, prodBonus: 0.98, sellBonus: 0.02, cost: 10, energy: 4 },
      { level: 3, prodBonus: 1.96, sellBonus: 0.04, cost: 20, energy: 6 },
      { level: 4, prodBonus: 3.92, sellBonus: 0.08, cost: 40, energy: 8 },
    ],
  },
  {
    id: 'beta',
    name: 'Beta',
    blurb: 'Balanced hand - steady production with a healthy sell bump.',
    levels: [
      { level: 1, prodBonus: 0.482, sellBonus: 0.018, cost: 5, energy: 2 },
      { level: 2, prodBonus: 0.964, sellBonus: 0.036, cost: 10, energy: 4 },
      { level: 3, prodBonus: 1.928, sellBonus: 0.072, cost: 20, energy: 6 },
      { level: 4, prodBonus: 3.856, sellBonus: 0.144, cost: 40, energy: 8 },
    ],
  },
  {
    id: 'chewie',
    name: 'Chewie',
    blurb: 'Closer - strongest sell-rate lift, slightly lower output.',
    levels: [
      { level: 1, prodBonus: 0.479, sellBonus: 0.021, cost: 5, energy: 2 },
      { level: 2, prodBonus: 0.958, sellBonus: 0.042, cost: 10, energy: 4 },
      { level: 3, prodBonus: 1.916, sellBonus: 0.084, cost: 20, energy: 6 },
      { level: 4, prodBonus: 3.832, sellBonus: 0.168, cost: 40, energy: 8 },
    ],
  },
  {
    id: 'danoct',
    name: 'Danoct',
    blurb: 'Grinder - top-tier production, minimal sell lift.',
    levels: [
      { level: 1, prodBonus: 0.487, sellBonus: 0.013, cost: 5, energy: 2 },
      { level: 2, prodBonus: 0.974, sellBonus: 0.026, cost: 10, energy: 4 },
      { level: 3, prodBonus: 1.948, sellBonus: 0.052, cost: 20, energy: 6 },
      { level: 4, prodBonus: 3.896, sellBonus: 0.104, cost: 40, energy: 8 },
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
