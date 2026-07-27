// Typed HTTP client for the gamesim backend's player API. Plain fetch (no
// axios dependency here) — this module is the only place that knows the
// gamesim base URL, token storage key, and response shapes.
import type {
  BootstrapResponse,
  FinlitDecisionPayload,
  PreviewResponse,
  TeamRoundDecisionDto,
  TeamRoundResultDto,
} from './types';

const TOKEN_KEY = 'gamesim:accessToken';

export function getGamesimBaseUrl(): string {
  const configured = (import.meta as any).env?.VITE_GAMESIM_API_URL as string | undefined;
  return (configured ?? 'http://localhost:5000/api').replace(/\/$/, '');
}

export function getGamesimToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setGamesimToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearGamesimToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class GamesimApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// The access token is short-lived (15m server-side). `/auth/login/passkey`
// and `/auth/refresh` both set an httpOnly refresh-token cookie — `request`
// sends credentials so that cookie round-trips, and transparently refreshes
// once on a 401/403 before giving up. Without this, a session that outlives
// the access token (an easy thing for a 90-day/3-phase run to do) silently
// drops every decision sync from that point on: sync.ts only console.warns
// on failure, it never surfaces to the player.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${getGamesimBaseUrl()}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return false;
        const body = (await res.json()) as { accessToken?: string };
        if (!body.accessToken) return false;
        setGamesimToken(body.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function doFetch(path: string, init: RequestInit | undefined, token: string | null): Promise<Response> {
  return fetch(`${getGamesimBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token = getGamesimToken();
  let res = await doFetch(path, init, token);

  if ((res.status === 401 || res.status === 403) && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = getGamesimToken();
      res = await doFetch(path, init, token);
    }
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new GamesimApiError(res.status, body, (body as { message?: string })?.message ?? `Request to ${path} failed (${res.status}).`);
  }
  return body as T;
}

export async function loginWithPasskey(passkey: string): Promise<{ accessToken: string }> {
  return request('/auth/login/passkey', { method: 'POST', body: JSON.stringify({ passkey }) });
}

/** Best-effort — revokes the refresh-token cookie server-side. Local token
 *  clearing (clearGamesimToken) is what actually ends the session client-side
 *  and must happen regardless of whether this call succeeds. */
export async function logoutFromGamesim(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    // already logging out locally either way
  }
}

export function getBootstrap(): Promise<BootstrapResponse> {
  return request('/player/bootstrap');
}

export function getCurrentDecision(): Promise<{ decision: TeamRoundDecisionDto | null }> {
  return request('/player/rounds/current/decision');
}

export function putCurrentDecision(body: {
  version: number;
  configVersion: string;
  payload: FinlitDecisionPayload;
}): Promise<TeamRoundDecisionDto> {
  return request('/player/rounds/current/decision', { method: 'PUT', body: JSON.stringify(body) });
}

export function postPreview(body: {
  decisionVersion?: number | null;
  payload: FinlitDecisionPayload;
}): Promise<PreviewResponse> {
  return request('/player/rounds/current/preview', { method: 'POST', body: JSON.stringify(body) });
}

export function submitCurrentDecision(body: { version?: number }): Promise<TeamRoundDecisionDto> {
  return request('/player/rounds/current/decision/submit', { method: 'POST', body: JSON.stringify(body) });
}

export function getResults(): Promise<{ results: TeamRoundResultDto[] }> {
  return request('/player/results');
}

export function getCurrentResult(): Promise<TeamRoundResultDto> {
  return request('/player/results/current');
}
