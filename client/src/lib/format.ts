/** Formatters — every numeric surface in the console routes through here. */

const NUM = new Intl.NumberFormat("en-US");
const NUM1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const count = (n?: number | null) => (n == null ? "—" : NUM.format(n));

/** Compacts at 100k+ per spec §14: 446700 -> "446.7K" */
export const compact = (n?: number | null) =>
  n == null ? "—" : Math.abs(n) >= 100_000 ? COMPACT.format(n) : NUM.format(n);

export function money(n?: number | null, currency = "USD") {
  if (n == null) return "—";
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
    notation: Math.abs(n) >= 100_000 ? "compact" : "standard",
  });
  return fmt.format(n);
}

/** Accepts either a fraction (0.63) or an already-scaled percent (63). */
export function percent(value?: number | null, opts: { fraction?: boolean } = {}) {
  if (value == null) return "—";
  const pct = opts.fraction === false ? value : value <= 1 && value >= -1 ? value * 100 : value;
  return `${NUM1.format(pct)}%`;
}

/** 95 -> "1 h 35 m"; 45 -> "45 m" */
export function duration(minutes?: number | null) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h} h ${m} m`;
  if (h) return `${h} h`;
  return `${m} m`;
}

/** Countdown from ms remaining: "01:24:08", or "14 m 06 s" under an hour. */
export function countdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export function countdownParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    urgent: ms > 0 && ms < 60 * 60 * 1000,
    expired: ms <= 0,
  };
}

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now" · "5 m ago" · "3 h ago" · weekday <7d · else date */
export function relativeTime(input?: string | Date | null): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  if (abs < min) return "just now";
  if (abs < 60 * min) return RTF.format(Math.round(diffMs / min), "minute");
  if (abs < 24 * 60 * min) return RTF.format(Math.round(diffMs / (60 * min)), "hour");
  if (abs < 7 * 24 * 60 * min)
    return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function absoluteTime(input?: string | Date | null): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function shortDate(input?: string | Date | null): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** For <input type="date"> round-trips. */
export function toDateInput(input?: string | Date | null): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
