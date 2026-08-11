export const fmt$ = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(Math.round(n));
  return `${sign}$${v.toLocaleString('en-US')}`;
};

export const fmtPct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const phaseOf = (day: number): 1 | 2 | 3 =>
  day <= 30 ? 1 : day <= 60 ? 2 : 3;

/**
 * Per-phase framing for decisions the engine prices per DAY.
 *
 * The design sheets set hiring, vendor, channel, marketing and sales costs as
 * $/day and their bonuses as units/day. Those are the correct engine units and
 * useless to a player at the point of choosing: "+0.49 produced / day" is not a
 * quantity anyone can picture — you cannot make half a notebook — and comparing
 * two hire tiers meant multiplying by 30 twice and dividing, in your head.
 *
 * `perPhase` is that multiplication done once, in one place.
 *
 * Only for DECISION INPUTS. Observations of a single day — the day-tick HUD,
 * the daily series charts — stay per-day; converting those would be wrong.
 */
export const perPhase = (perDay: number, daysPerPhase = 30) => perDay * daysPerPhase;

/** Whole units produced over a phase — fractional per-day rates only mean something summed. */
export const fmtUnitsPerPhase = (perDay: number, daysPerPhase = 30) =>
  fmtInt(perPhase(perDay, daysPerPhase));

export const dayUntilNextEvent = (day: number) => {
  const eventDays = [15, 30, 45, 60, 75, 89];
  const next = eventDays.find((d) => d >= day);
  return next === undefined ? null : next - day;
};

export const dayUntilNextEval = (day: number) => {
  const evalDays = [30, 60, 90];
  const next = evalDays.find((d) => d >= day);
  return next === undefined ? null : next - day;
};
