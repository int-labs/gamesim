// Balance constants. Tunable.

export const PHASE_MAX_ENERGY = { 1: 30, 2: 45, 3: 60 } as const;

export const PAPER_COST = { cheap: 0.8, standard: 1.4, premium: 2.4 } as const;
export const COVER_COST = { hardcover: 1.0, leather: 2.6 } as const;
export const BINDING_COST = { ring: 0.4, staple: 0.1 } as const;
export const SIZE_COST_MULT = { s: 0.7, m: 1.0, l: 1.3 } as const;
export const SIZE_TIME_MULT = { s: 0.8, m: 1.0, l: 1.2 } as const;

export const PRICE_REFERENCE = { students: 6, creators: 14, professionals: 18, gift: 16 } as const;

export const BASE_PRODUCTION = 5;
export const HIRE_CAPACITY = 4;
export const HIRE_DAILY_WAGE = 12;

export const PHASE_DEMAND_MULT = { 1: 0.7, 2: 1.0, 3: 1.2 } as const;

export const STARTING_CASH = { self: 1000, investor: 2500 } as const;
export const STARTING_DEBT = { self: 0, investor: 3000 } as const;

export const DEFAULT_DEFECT = 0.08;

export const ENERGY_COSTS = {
  hire: 4,
  tool: 5,
  process: 5,
  supplier: 6,
  channel: 4,
  campaign: 3,
  redesign: 6,
};

export const SEED_DEFAULT = 'amelia-2026-04-26';
