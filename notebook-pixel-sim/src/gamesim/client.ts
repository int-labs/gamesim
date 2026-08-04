// Typed HTTP client for the gamesim backend (`server/` on main). Plain fetch —
// this module is the only place that knows the gamesim base URL, the stored
// session keys, and which routes exist.
//
// Every route below already exists on main and is callable with a team token.
// There is deliberately NO /player/* namespace: that belonged to a different
// (abandoned) server branch. Everything the player needs is assembled here from
// the generic routes main already ships.
import type {
  BaseDataDto,
  CreateDecisionBody,
  DecisionDto,
  GlobalInputDto,
  Id,
  PasskeyLoginResponse,
  ProductDto,
  ProjectionDto,
  RecalcProjectionsBody,
  ResultDto,
  RoundDto,
  SimulationDto,
} from './types';

const TOKEN_KEY = 'gamesim:accessToken';
const TEAM_KEY = 'gamesim:teamId';
const SIM_KEY = 'gamesim:simulationId';

export function getGamesimBaseUrl(): string {
  const configured = (import.meta as any).env?.VITE_GAMESIM_API_URL as string | undefined;
  return (configured ?? 'http://localhost:5000/api').replace(/\/$/, '');
}

export interface GamesimSession {
  token: string;
  teamId: Id;
  simulationId: Id;
  /** Stored so the game can greet the team by name after a reload, without a
   *  second round-trip just to learn who is playing. */
  teamName?: string;
  avatarUrl?: string | null;
}

export function getGamesimToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** The stored session, or null when any part of it is missing. */
export function getStoredSession(): GamesimSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const teamId = localStorage.getItem(TEAM_KEY);
  const simulationId = localStorage.getItem(SIM_KEY);
  if (!token || !teamId || !simulationId) return null;
  return { token, teamId, simulationId };
}

export function setGamesimSession(session: GamesimSession): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(TEAM_KEY, session.teamId);
  localStorage.setItem(SIM_KEY, session.simulationId);
}

export function clearGamesimSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TEAM_KEY);
  localStorage.removeItem(SIM_KEY);
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
    throw new GamesimApiError(
      res.status,
      body,
      (body as { message?: string })?.message ?? `Request to ${path} failed (${res.status}).`,
    );
  }
  return body as T;
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

// ── Auth ────────────────────────────────────────────────────────────────
/** POST /users/login-passkey — the team-role login (public route). Returns the
 *  token PLUS the team/simulation ids every later call needs as query params. */
export function loginWithPasskey(passkey: string): Promise<PasskeyLoginResponse> {
  return request('/users/login-passkey', { method: 'POST', body: JSON.stringify({ passkey }) });
}

// ── Simulation context ──────────────────────────────────────────────────
export function getSimulation(simulationId: Id): Promise<SimulationDto> {
  return request(`/simulations/${simulationId}`);
}

export function getRounds(simulationId: Id): Promise<RoundDto[]> {
  return request(`/rounds${qs({ simulationId })}`);
}

// ── Decision form configuration ─────────────────────────────────────────
export function getProducts(simulationTypeId: Id): Promise<ProductDto[]> {
  return request(`/products${qs({ simulationTypeId })}`);
}

export function getBaseData(simulationTypeId: Id): Promise<BaseDataDto[]> {
  return request(`/base-data${qs({ simulationTypeId })}`);
}

export function getGlobalInputs(simulationTypeId: Id): Promise<GlobalInputDto[]> {
  return request(`/global-inputs${qs({ simulationTypeId })}`);
}

// ── Projections (own financials) ────────────────────────────────────────
/** POST /projections/recalc — server-side projection for ONE product's fields.
 *  NOTE: this UPSERTS the team's projection document, so it is not a read-only
 *  preview; call it for a configuration the team is actually considering. */
export function recalcProjections(body: RecalcProjectionsBody): Promise<ProjectionDto> {
  return request('/projections/recalc', { method: 'POST', body: JSON.stringify(body) });
}

export function getProjections(args: {
  simulationId: Id;
  teamId: Id;
  roundNumber?: number;
}): Promise<ProjectionDto[]> {
  return request(`/projections${qs(args)}`);
}

// ── Decisions ───────────────────────────────────────────────────────────
/** POST /decisions — insert-only, one document per (simulation, team, round).
 *  A resubmission comes back as 409. */
export function createDecision(body: CreateDecisionBody): Promise<DecisionDto> {
  return request('/decisions', { method: 'POST', body: JSON.stringify(body) });
}

export function getDecisions(args: {
  simulationId: Id;
  teamId?: Id;
  roundNumber?: number;
}): Promise<DecisionDto[]> {
  return request(`/decisions${qs(args)}`);
}

// ── Results (cross-team shares) ─────────────────────────────────────────
/** GET /results — one document per product+segment+round, holding EVERY team's
 *  weighted score and market share. Written by the operator's calculation run;
 *  empty until that has happened. */
export function getResults(args: { simulationId: Id; roundNumber?: number }): Promise<ResultDto[]> {
  return request(`/results${qs(args)}`);
}

// ── Operator-authored content ───────────────────────────────────────────
export interface RoundNoteDto {
  _id: Id;
  roundNumber: number;
  teamId: Id | null;
  title: string;
  body: string;
  pinned: boolean;
}

export interface DebriefSectionDto {
  title: string;
  body: string;
  teamId: Id | null;
  order: number;
}

export interface DebriefDto {
  _id: Id;
  status: 'draft' | 'published';
  title: string;
  intro: string;
  sections: DebriefSectionDto[];
}

/** GET /round-notes — the server filters to general + this team's notes for a
 *  team token, whatever we pass, so no teamId param is needed here. */
export function getRoundNotes(args: {
  simulationId: Id;
  roundNumber?: number;
}): Promise<RoundNoteDto[]> {
  return request(`/round-notes${qs(args)}`);
}

/** GET /debrief — 404 until an operator publishes it AND the simulation is
 *  Completed. Other teams' sections are stripped server-side. */
export function getDebrief(simulationId: Id): Promise<DebriefDto> {
  return request(`/debrief${qs({ simulationId })}`);
}

export interface TeamProgressBody {
  roundNumber: number;
  day: number;
  phase: number;
  cash: number;
  energy: number;
  lines: number;
  shopName?: string | null;
  ended?: boolean;
}

/**
 * PUT /team-progress — tell the facilitator where this team has got to.
 *
 * FIRE AND FORGET, on purpose. This exists so an operator can see who is stuck
 * mid-round; it is not part of the game and nothing is restored from it. The
 * server takes the team's identity from the token, so no ids are sent.
 *
 * The promise never rejects: a heartbeat that could throw would be a network
 * call able to interrupt a day-tick, which is the one place in the app that
 * must not be able to fail.
 */
export interface RunReportBody {
  roundNumber: number;
  total: number;
  netProfit: number;
  inventory: number;
  insight: number;
  netDollar: number;
  cleanliness: number;
  route?: string | null;
  obligationMet?: boolean | null;
  insightsCorrect: number;
  insightsTotal: number;
  shopName?: string | null;
}

/**
 * PUT /run-reports — file how this team's own 90-day run finished.
 *
 * NOT the competitive score. `Results` (rank/share) and `Projections` (the
 * server's financials) stay authoritative for anything teams are compared on;
 * this is the player's own rubric — Net Profit 50 · Inventory 25 · Insight 25 —
 * so the debrief can show what a team actually experienced rather than only
 * how it placed. Fire and forget, like the progress heartbeat.
 */
export function reportRunResult(body: RunReportBody): Promise<void> {
  return request<void>('/run-reports', {
    method: 'PUT',
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export function reportTeamProgress(body: TeamProgressBody): Promise<void> {
  return request<void>('/team-progress', {
    method: 'PUT',
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export type {
  BaseDataDto,
  CreateDecisionBody,
  DecisionDto,
  GlobalInputDto,
  Id,
  PasskeyLoginResponse,
  ProductDto,
  ProjectionDto,
  RecalcProjectionsBody,
  ResultDto,
  RoundDto,
  SimulationDto,
} from './types';
