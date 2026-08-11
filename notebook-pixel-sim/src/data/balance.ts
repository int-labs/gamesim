// Balance constants. Tunable.
//
// The four scalars below are `let`, not `const`, so the operator's published
// PlayerConfig can change them at boot — an exported `const` cannot be rebound
// from outside its module, which is why editing them in the console used to do
// nothing until the next build. See `applyBalanceOverrides` at the bottom, and
// the longer note in engine/finlit/core/config/constants.ts.
//
// The object-shaped tables above/below stay `const`: hydration edits their
// CONTENTS in place, which every importer already sees.

export const PHASE_MAX_ENERGY = { 1: 30, 2: 45, 3: 60 } as const;

export const PAPER_COST = { cheap: 0.8, standard: 1.4, premium: 2.4 } as const;
export const COVER_COST = { hardcover: 1.0, leather: 2.6 } as const;
export const BINDING_COST = { ring: 0.4, staple: 0.1 } as const;
export const SIZE_COST_MULT = { s: 0.7, m: 1.0, l: 1.3 } as const;
export const SIZE_TIME_MULT = { s: 0.8, m: 1.0, l: 1.2 } as const;

export const PRICE_REFERENCE = { students: 6, creators: 14, professionals: 18, gift: 16 } as const;

export let BASE_PRODUCTION = 5;
export let HIRE_CAPACITY = 4;
export let HIRE_DAILY_WAGE = 12;

export const PHASE_DEMAND_MULT = { 1: 0.7, 2: 1.0, 3: 1.2 } as const;

export const STARTING_CASH = { self: 1000, investor: 2500 } as const;
export const STARTING_DEBT = { self: 0, investor: 3000 } as const;

export let DEFAULT_DEFECT = 0.08;

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


// ── Operator overrides ──────────────────────────────────────────────────────

const SCALAR_SETTERS: Record<string, (v: number) => void> = {
  BASE_PRODUCTION: (v) => { BASE_PRODUCTION = v; },
  HIRE_CAPACITY: (v) => { HIRE_CAPACITY = v; },
  HIRE_DAILY_WAGE: (v) => { HIRE_DAILY_WAGE = v; },
  DEFAULT_DEFECT: (v) => { DEFAULT_DEFECT = v; },
};

export const OVERRIDABLE_BALANCE: readonly string[] = Object.keys(SCALAR_SETTERS);

/** Apply operator overrides; returns the names that actually landed. */
export function applyBalanceOverrides(patch: Record<string, unknown>): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(patch ?? {})) {
    const set = SCALAR_SETTERS[key];
    if (!set) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    set(value);
    applied.push(key);
  }
  return applied;
}
