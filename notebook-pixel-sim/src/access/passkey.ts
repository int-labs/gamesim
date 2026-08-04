import { useSyncExternalStore } from 'react';
import { clearGamesimSession, getStoredSession, loginWithPasskey, setGamesimSession } from '@/gamesim/client';

// Pass Key access gate.
//
// This module is the single seam between the gate UI and the question "is this
// key valid?", exactly as V3 left it — only the BODY of `verifyPassKey` changed:
// the gate used to be open (any text unlocked it) and now it is a real team
// login against the gamesim API (POST /users/login-passkey). The signature and
// every caller are untouched.
//
// "Unlocked" therefore means "we hold a gamesim team session", not "a flag is
// set on this device" — the flag is kept only so devSkip keeps working.

const UNLOCK_KEY = 'intlabs:academy:unlocked';

/** Dev escape hatch: run with `VITE_SKIP_PASSKEY=1` to bypass the gate. */
export const devSkip = (): boolean => {
  try {
    return (import.meta as { env?: Record<string, string> }).env?.VITE_SKIP_PASSKEY === '1';
  } catch {
    return false;
  }
};

/** Is a gamesim team session held on this device? */
export const isUnlocked = (): boolean => {
  if (devSkip()) return true;
  try {
    return getStoredSession() !== null;
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

/** Drop the session (log out) — the gate comes back on the next render. */
export const clearUnlock = (): void => {
  try {
    window.localStorage.removeItem(UNLOCK_KEY);
    clearGamesimSession();
  } catch {
    /* ignore */
  }
};

export type VerifyResult = { ok: true } | { ok: false; reason: 'empty' | 'invalid' | 'offline' };

/**
 * Verify a pass key against the gamesim API and, on success, store the team
 * session (token + teamId + simulationId) so every later call is authenticated.
 *
 * The passkey is sent as the player typed it, minus surrounding whitespace —
 * server passkeys are generated as lowercase `word-word`, so the display
 * normalizer (uppercase, dashes stripped) must NOT be applied to the wire value.
 *
 * Reasons: 'empty' (nothing typed), 'invalid' (server rejected the key),
 * 'offline' (couldn't reach the server — a retry may well work).
 */
export async function verifyPassKey(raw: string): Promise<VerifyResult> {
  const passkey = raw.trim();
  if (!passkey) return { ok: false, reason: 'empty' };

  try {
    const res = await loginWithPasskey(passkey);
    // Keep the identity with the session so the HUD can name the team after a
    // reload without a second request just to find out who is playing.
    setGamesimSession({
      token: res.token,
      teamId: res.teamId,
      simulationId: res.simulationId,
      teamName: res.teamName,
      avatarUrl: res.avatar?.url ?? null,
    });
    return { ok: true };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 400 || status === 401 || status === 404) return { ok: false, reason: 'invalid' };
    console.warn('[gamesim] passkey login failed', err);
    return { ok: false, reason: 'offline' };
  }
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
