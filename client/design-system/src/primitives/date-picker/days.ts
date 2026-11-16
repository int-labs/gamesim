/**
 * Calendar days as the apps store them: "yyyy-mm-dd" strings in local time, with no time and no
 * time zone. They are read into Date objects at local noon and written back from the local
 * year, month and day, so a day never moves through UTC or across midnight (daylight saving).
 */
export type DayString = string;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The Date at local noon of a "yyyy-mm-dd" day, or undefined when the string is not a real day. */
export function parseDay(value: DayString | null | undefined): Date | undefined {
  if (!value) return undefined;
  const match = DAY.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(2000, 0, 1, 12);
  date.setFullYear(year, month, day);
  // "2026-02-30" rolls over to March: not a real day.
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return undefined;
  return date;
}

/** The "yyyy-mm-dd" day of a Date, in local time. */
export function toDay(date: Date): DayString {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today, in local time. */
export function today(): DayString {
  return toDay(new Date());
}

/** The later of two days; "yyyy-mm-dd" strings order as their days do. */
export function laterDay(a: DayString | undefined, b: DayString | undefined): DayString | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Formats a day for people: "24 Sept 2026" in British English, the Admin's format. */
export function formatDay(value: DayString | null | undefined, locale: string): string | undefined {
  const date = parseDay(value);
  return date ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date) : undefined;
}
