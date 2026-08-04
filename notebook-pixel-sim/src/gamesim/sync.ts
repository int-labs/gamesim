// Bridges the Zustand GameState to the gamesim API on main: server projection
// (POST /projections/recalc), submission (POST /decisions, once per round), and
// reading back the official numbers (GET /projections, GET /results).
//
// Authority split — the ONE rule this file exists to enforce:
//   • The browser's FinLit engine produces the game's own numbers. They are
//     indicative UX only ("estimate"), never the score.
//   • Everything competitive — market share, weighted score, revenue/COGS/gross
//     profit — comes from the server (calcMarketModel + calcFinancials).
//
// The old `{ lines, decisions }` finlit payload is gone: main's Decision model
// stores `inputs[].fields[{ fieldId, value }]`, and src/gamesim/mapping.ts is
// what converts game state into that shape.

import type { GameState } from '@/state/store';
import * as gamesim from './client';
import { toDecisionInputs, type ToDecisionInputsArgs } from './mapping';
import type {
  DecisionDto,
  DecisionGlobalInputDto,
  DecisionProductInput,
  Id,
  ProductProjectionDto,
  ProjectionDto,
  ResultDto,
} from './types';

export class GamesimSyncError extends Error {
  cause?: unknown;
  /** True when the round's decision was already submitted (server 409). */
  alreadySubmitted: boolean;
  constructor(message: string, cause?: unknown, alreadySubmitted = false) {
    super(message);
    this.cause = cause;
    this.alreadySubmitted = alreadySubmitted;
  }
}

/** The simulation context every call needs as explicit ids. */
export interface RoundContext {
  simulationId: Id;
  simulationTypeId: Id;
  teamId: Id;
  roundNumber: number;
}

export interface BuildDecisionArgs extends Omit<ToDecisionInputsArgs, 'state'> {
  state: GameState;
  globalInputs?: DecisionGlobalInputDto[];
}

/** Game state → the `inputs[]` the server stores and scores. */
export function buildDecisionInputs(args: BuildDecisionArgs): DecisionProductInput[] {
  return toDecisionInputs(args);
}

// ── Server projection ───────────────────────────────────────────────────

/** One product's server-computed projection, tagged with the product it came
 *  from so the UI can show per-line numbers. */
export interface ServerProductProjection extends ProductProjectionDto {
  productId: Id;
  productName: string;
}

export interface ServerProjectionResult {
  /** Whole projection document as the server last wrote it. */
  projection: ProjectionDto;
  /** Just the products this call submitted fields for. */
  byProduct: ServerProductProjection[];
}

/**
 * Server-side projection for the current draft. Calls POST /projections/recalc
 * once per product (the endpoint takes one product's fields at a time) and
 * returns the last document, which accumulates every product's numbers.
 *
 * NOTE: recalc UPSERTS the team's projection document — it is not a read-only
 * preview. That is the endpoint's behaviour on main and we don't work around
 * it; call this for a configuration the team is actually considering, not on
 * every keystroke.
 *
 * Never throws: a null return means "no server projection available", and the
 * caller falls back to the local engine's estimate.
 */
export async function fetchServerProjection(
  ctx: RoundContext,
  args: BuildDecisionArgs,
): Promise<ServerProjectionResult | null> {
  const inputs = buildDecisionInputs(args);
  if (inputs.length === 0) return null;

  try {
    let projection: ProjectionDto | null = null;
    for (const input of inputs) {
      projection = await gamesim.recalcProjections({
        simulationId: ctx.simulationId,
        simulationTypeId: ctx.simulationTypeId,
        teamId: ctx.teamId,
        roundNumber: ctx.roundNumber,
        productId: input.productId,
        fields: input.fields,
        globalInputs: args.globalInputs ?? [],
      });
    }
    if (!projection) return null;
    return { projection, byProduct: collectByProduct(projection, inputs) };
  } catch (err) {
    console.warn('[gamesim] server projection unavailable, using the local estimate', err);
    return null;
  }
}

function collectByProduct(
  projection: ProjectionDto,
  inputs: DecisionProductInput[],
): ServerProductProjection[] {
  return inputs.map((input) => ({
    productId: input.productId,
    productName: input.productName,
    ...(projection.projections?.[input.productId] ?? {}),
  }));
}

// ── Submission ──────────────────────────────────────────────────────────

/**
 * Submit the round's decision. POST /decisions is insert-only and unique per
 * (simulation, team, round): the server answers 409 on a second attempt, which
 * surfaces here as `GamesimSyncError.alreadySubmitted` so the UI can say "this
 * round is already locked in" instead of showing a generic failure.
 */
export async function submitRoundDecision(
  ctx: RoundContext,
  args: BuildDecisionArgs,
): Promise<DecisionDto> {
  const inputs = buildDecisionInputs(args);
  if (inputs.length === 0) {
    throw new GamesimSyncError(
      'No product line could be matched to a product in this simulation, so there is nothing to submit.',
    );
  }

  try {
    return await gamesim.createDecision({
      simulationId: ctx.simulationId,
      teamId: ctx.teamId,
      roundNumber: ctx.roundNumber,
      inputs,
      globalInputs: args.globalInputs ?? [],
    });
  } catch (err) {
    if (err instanceof gamesim.GamesimApiError && err.status === 409) {
      throw new GamesimSyncError(
        'This round\'s decision has already been submitted - decisions are final once sent.',
        err,
        true,
      );
    }
    const message =
      err instanceof gamesim.GamesimApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to submit the decision to the simulation server.';
    throw new GamesimSyncError(message, err);
  }
}

/** Has this team already submitted for the round? Used to lock the UI on load
 *  (a fresh browser has no local memory of an earlier submission). */
export async function fetchSubmittedDecision(ctx: {
  simulationId: Id;
  teamId: Id;
  roundNumber: number;
}): Promise<DecisionDto | null> {
  try {
    const decisions = await gamesim.getDecisions(ctx);
    return decisions[0] ?? null;
  } catch (err) {
    console.warn('[gamesim] failed to check for an existing decision', err);
    return null;
  }
}

// ── Official results ────────────────────────────────────────────────────

/** This team's slice of a round's official results, product by product. */
export interface OfficialProductResult {
  productId: Id;
  segmentId: Id;
  /** This team's market share for the product (fraction), from calcMarketModel. */
  marketShare: number;
  /** This team's weighted score for the product. */
  weightedScore: number;
  /** 1-based rank among the teams scored on this product. */
  rank: number;
  teamsScored: number;
}

export interface OfficialRoundResults {
  roundNumber: number;
  byProduct: OfficialProductResult[];
  /** Mean share across products, for a single headline number. */
  averageMarketShare: number;
  /** Every team's total weighted score, for a leaderboard. */
  leaderboard: Array<{ teamId: Id; totalWeightedScore: number; averageMarketShare: number }>;
  /** Raw documents, in case a screen needs more than the summary. */
  raw: ResultDto[];
}

/**
 * Official cross-team results for a round, read from GET /results. Returns null
 * while the operator has not run the round's calculation yet (no documents).
 */
export async function fetchOfficialResults(args: {
  simulationId: Id;
  teamId: Id;
  roundNumber: number;
}): Promise<OfficialRoundResults | null> {
  const raw = await gamesim.getResults({
    simulationId: args.simulationId,
    roundNumber: args.roundNumber,
  });
  if (!raw || raw.length === 0) return null;
  return summarizeResults(raw, args.teamId, args.roundNumber);
}

export function summarizeResults(raw: ResultDto[], teamId: Id, roundNumber: number): OfficialRoundResults {
  const byProduct: OfficialProductResult[] = raw.map((doc) => {
    const scores = Object.entries(doc.weightedScores ?? {});
    const ranked = [...scores].sort((a, b) => b[1] - a[1]);
    const rank = ranked.findIndex(([id]) => id === teamId);
    return {
      productId: doc.productId,
      segmentId: doc.segmentId,
      marketShare: doc.marketShares?.[teamId] ?? 0,
      weightedScore: doc.weightedScores?.[teamId] ?? 0,
      rank: rank >= 0 ? rank + 1 : ranked.length,
      teamsScored: ranked.length,
    };
  });

  const totals = new Map<Id, { score: number; share: number; n: number }>();
  for (const doc of raw) {
    for (const [id, score] of Object.entries(doc.weightedScores ?? {})) {
      const t = totals.get(id) ?? { score: 0, share: 0, n: 0 };
      t.score += score;
      t.share += doc.marketShares?.[id] ?? 0;
      t.n += 1;
      totals.set(id, t);
    }
  }

  const leaderboard = [...totals.entries()]
    .map(([id, t]) => ({
      teamId: id,
      totalWeightedScore: t.score,
      averageMarketShare: t.n ? t.share / t.n : 0,
    }))
    .sort((a, b) => b.totalWeightedScore - a.totalWeightedScore);

  const averageMarketShare = byProduct.length
    ? byProduct.reduce((a, p) => a + p.marketShare, 0) / byProduct.length
    : 0;

  return { roundNumber, byProduct, averageMarketShare, leaderboard, raw };
}

// ── Official financials (own team) ──────────────────────────────────────

export interface OfficialFinancials {
  roundNumber: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  customersObtained: number;
  byProduct: ServerProductProjection[];
  raw: ProjectionDto;
}

/**
 * The team's own official financials for a round, read from GET /projections.
 * These are the server's numbers — the game's local P&L is NOT the same model
 * and will differ; show these whenever they exist.
 */
export async function fetchOfficialFinancials(args: {
  simulationId: Id;
  teamId: Id;
  roundNumber: number;
  productNames?: Record<Id, string>;
}): Promise<OfficialFinancials | null> {
  const docs = await gamesim.getProjections({
    simulationId: args.simulationId,
    teamId: args.teamId,
    roundNumber: args.roundNumber,
  });
  const raw = docs?.[0];
  if (!raw) return null;

  const byProduct: ServerProductProjection[] = Object.entries(raw.projections ?? {}).map(
    ([productId, metrics]) => ({
      productId,
      productName: args.productNames?.[productId] ?? productId,
      ...metrics,
    }),
  );
  const sum = (pick: (p: ProductProjectionDto) => number | undefined) =>
    byProduct.reduce((a, p) => a + (pick(p) ?? 0), 0);

  return {
    roundNumber: args.roundNumber,
    revenue: sum((p) => p.revenue),
    cogs: sum((p) => p.COGS),
    grossProfit: sum((p) => p.grossProfit),
    customersObtained: sum((p) => p.customersObtained),
    byProduct,
    raw,
  };
}
