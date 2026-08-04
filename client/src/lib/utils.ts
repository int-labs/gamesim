import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic 0..n-1 bucket from a string — used for avatar/tile hues. */
export function hashIndex(input: string, buckets: number): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h << 5) - h + input.charCodeAt(i);
  return Math.abs(h) % buckets;
}

/** "Team Alpha" -> "TA"; "rido@int-labs.com" -> "RI" */
export function initials(name: string): string {
  const clean = (name ?? "").trim();
  if (!clean) return "?";
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

/** Mongo ObjectIds are 24 chars — never show them full width. */
export function shortId(id?: string | null): string {
  if (!id) return "—";
  return id.length <= 10 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}
