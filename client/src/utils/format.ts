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
