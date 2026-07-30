import { useSyncExternalStore } from 'react';

// Pass Key access gate — FRONTEND-ONLY.
//
// This module is the single seam between the gate UI and the question
// "is this key valid?". The gate is currently OPEN: `verifyPassKey` accepts
// ANY submission (see below), so the entry screen is purely decorative — the
// video, mascot and "enter the academy" wipe all still play, but nothing is
// gated. To re-enable checking, restore the two commented lines in
// `verifyPassKey`; the keys list + normalizer are kept ready for that.
//
// To add real enforcement later, swap ONLY the body of `verifyPassKey`
// (e.g. `await fetch('/api/verify-passkey', …)`) — the signature and the UI
// stay exactly the same.

const UNLOCK_KEY = 'intlabs:academy:unlocked';

// Demo keys — case-insensitive; spaces and dashes are ignored. Currently
// UNUSED (gate is open); kept so restoring key-checking is a one-line change.
const VALID_KEYS = ['INTLABS', 'FUTURECEO', 'ACADEMY2025'];

const normalize = (raw: string): string =>
  raw.trim().toUpperCase().replace(/[\s-]+/g, '');

/** Dev escape hatch: run with `VITE_SKIP_PASSKEY=1` to bypass the gate. */
export const devSkip = (): boolean => {
  try {
    return (import.meta as { env?: Record<string, string> }).env?.VITE_SKIP_PASSKEY === '1';
  } catch {
    return false;
  }
};

/** Has this device already unlocked the Academy? */
export const isUnlocked = (): boolean => {
  if (devSkip()) return true;
  try {
    return window.localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
};

/** Persist the unlocked state so returning visitors skip the gate. */
export const setUnlocked = (): void => {
  try {
    window.localStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* storage blocked — gate will simply re-appear next visit */
  }
};

/** Re-lock this device (handy for testing the gate flow). */
export const clearUnlock = (): void => {
  try {
    window.localStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
};

export type VerifyResult = { ok: true } | { ok: false; reason: 'empty' | 'invalid' };

/**
 * Verify a pass key. Intentionally async so a real network round-trip can
 * drop in later without touching callers. Returns a structured result so the
 * UI can distinguish an EMPTY submission from an INVALID key.
 *
 * GATE OPEN: every submission unlocks — any text, or even an empty field.
 * To re-enable key checking, restore the two commented lines below.
 */
export async function verifyPassKey(_raw: string): Promise<VerifyResult> {
  // const key = normalize(_raw);
  // if (!key) return { ok: false, reason: 'empty' };
  // Small artificial delay so the "Checking…" state is actually visible
  // (and so it mirrors the latency a real request would have).
  await new Promise((resolve) => setTimeout(resolve, 320));
  // return VALID_KEYS.includes(key) ? { ok: true } : { ok: false, reason: 'invalid' };
  return { ok: true };
}

// ── Reactive unlock state ───────────────────────────────────────────────
// A tiny external store so any component (e.g. a global "Log out" control)
// can re-lock the app and have <PassKeyGate> react instantly — no reload.

const unlockListeners = new Set<() => void>();
const emitUnlock = () => unlockListeners.forEach((l) => l());

/** Mark unlocked (persist) and notify subscribers. */
export function unlockAccess(): void {
  setUnlocked();
  emitUnlock();
}

/** Re-lock the app (clear persistence) and notify subscribers → shows the gate. */
export function lockAccess(): void {
  clearUnlock();
  emitUnlock();
}

function subscribeUnlock(cb: () => void): () => void {
  unlockListeners.add(cb);
  return () => { unlockListeners.delete(cb); };
}

/** React hook: current unlocked state, reactive to lock/unlock calls. */
export function useUnlocked(): boolean {
  return useSyncExternalStore(subscribeUnlock, isUnlocked, isUnlocked);
}
