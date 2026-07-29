// Typed HTTP client for the gamesim backend's player API. Plain fetch (no
// axios dependency here) — this module is the only place that knows the
// gamesim base URL, token storage key, and response shapes.
import type {
  BootstrapResponse,
  FinlitDecisionPayload,
  PreviewResponse,
  TeamRoundDecisionDto,
  TeamRoundResultDto,
} from '@gamesim/api-contract';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getGamesimToken();
  const res = await fetch(`${getGamesimBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

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

export function getResultByRoundNumber(roundNumber: number): Promise<TeamRoundResultDto> {
  return request(`/player/results/${roundNumber}`);
}

export type {
  BootstrapResponse,
  FinlitDecisionPayload,
  PreviewResponse,
  TeamRoundDecisionDto,
  TeamRoundResultDto,
};
