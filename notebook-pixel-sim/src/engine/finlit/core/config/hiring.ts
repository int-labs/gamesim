import type { GlobalInputItemDto } from '@/gamesim/types';

export type CandidateId = string;

export interface HireLevel {
  level: 1 | 2 | 3 | 4;
  prodBonus: number;
  sellBonus: number;
  marketingBonus: number;
  /** Unit cost reduction factor from dynamic_cost globalInputs impact. */
  costReduction: number;
  cost: number;
  energy: number;
}

export interface CandidateDef {
  id: string;
  name: string;
  blurb: string;
  levels: HireLevel[];
  imgPath?: string;
}

export const CANDIDATES: CandidateDef[] = [];

/** Rebuild CANDIDATES from backend hiring globalInput items. Call from GamesimProvider after bootstrap. */
export const hydrateCandidates = (items: GlobalInputItemDto[]): void => {
  CANDIDATES.length = 0;
  for (const item of items) {
    const levels: HireLevel[] = ([1, 2, 3, 4] as const).map((lvl) => {
      const optKey = String(lvl);
      const mult = item.options[optKey] ?? 1;
      return {
        level: lvl,
        prodBonus:      (item.impacts['inventory']?.value     ?? 0) * mult,
        sellBonus:      (item.impacts['sales_channel']?.value ?? 0) * mult,
        marketingBonus: (item.impacts['marketing']?.value     ?? 0) * mult,
        costReduction:  (item.impacts['dynamic_cost']?.value  ?? 0) * mult,
        cost:   item.cost   * Math.pow(2, lvl - 1),
        energy: item.energy * lvl,
      };
    });
    CANDIDATES.push({ id: item.key, name: item.label, blurb: item.description ?? '', levels });
  }
};

export const candidateById = (id: string): CandidateDef => {
  const c = CANDIDATES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown candidate: ${id}`);
  return c;
};

export const hireLevel = (id: string, level: number): HireLevel => {
  const l = candidateById(id).levels.find((x) => x.level === level);
  if (!l) throw new Error(`Candidate ${id} has no level ${level}`);
  return l;
};
