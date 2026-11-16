import { formatDay, laterDay, parseDay, today, toDay } from "./days";

describe("days", () => {
  it("reads a day at local noon and writes it back unchanged", () => {
    const date = parseDay("2026-09-24");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(24);
    expect(date?.getHours()).toBe(12);
    expect(date && toDay(date)).toBe("2026-09-24");
  });

  it("round-trips every day of a year, leap day included", () => {
    const start = parseDay("2028-01-01");
    if (!start) throw new Error("no start");
    for (let offset = 0; offset < 366; offset += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      expect(toDay(parseDay(toDay(date)) ?? new Date(Number.NaN))).toBe(toDay(date));
    }
    expect(toDay(parseDay("2028-02-29") ?? new Date(Number.NaN))).toBe("2028-02-29");
  });

  it("refuses strings that are not real days", () => {
    for (const value of ["", "2026-9-24", "24/09/2026", "2026-02-30", "2026-13-01", "2026-00-10", "2026-09-24T00:00:00Z"]) {
      expect(parseDay(value)).toBeUndefined();
    }
    expect(parseDay(null)).toBeUndefined();
  });

  it("keeps years below 100 as written", () => {
    expect(toDay(parseDay("0099-12-31") ?? new Date(Number.NaN))).toBe("0099-12-31");
  });

  it("gives today in local time", () => {
    const now = new Date();
    expect(today()).toBe(toDay(now));
  });

  it("picks the later of two days, either of which may be missing", () => {
    expect(laterDay("2026-09-24", "2026-10-01")).toBe("2026-10-01");
    expect(laterDay("2026-10-01", undefined)).toBe("2026-10-01");
    expect(laterDay(undefined, "2026-10-01")).toBe("2026-10-01");
    expect(laterDay(undefined, undefined)).toBeUndefined();
  });

  it("formats a day for people in the Admin's style", () => {
    expect(formatDay("2026-09-24", "en-GB")).toBe("24 Sept 2026");
    expect(formatDay("2025-12-04", "en-GB")).toBe("4 Dec 2025");
    expect(formatDay(null, "en-GB")).toBeUndefined();
  });
});
