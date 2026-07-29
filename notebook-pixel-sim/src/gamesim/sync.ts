// Bridges the Zustand GameState to the gamesim decision/preview API. Reuses
// engine/finlit/adapter.ts's existing store->engine mapping (the same one
// storeRun.ts uses for the local run) instead of re-deriving FinlitLine[]/
// FinlitDecisions from scratch, so the payload sent to gamesim always
// matches what the local engine would compute for the same state.
import type { GameState } from '@/state/store';
import { toFinlitLines, toFinlitDecisions, fromFinlitLine, fromFinlitDecisions, type LineInput } from '@/engine/finlit/adapter';
import type { FinlitDecisionPayload } from '@gamesim/api-contract';
import { FINLIT_CONFIG_VERSION } from '@gamesim/finlit-engine';
import * as gamesim from './client';

export class GamesimSyncError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

function lineInput(l: GameState['portfolio']['productLines'][number]): LineInput {
  return {
    id: l.id,
    name: l.name,
    price: l.price,
    genre: l.genre,
    finlitSpec: l.finlitSpec,
    channels: l.channels,
    vendor: l.vendor,
    targetPerDay: l.targetPerDay,
    finished: l.inventory.finished,
    targetSegment: l.targetSegment,
  };
}

export function buildFinlitPayload(s: GameState): FinlitDecisionPayload {
  return {
    lines: toFinlitLines(s.portfolio.productLines.map(lineInput)),
    decisions: toFinlitDecisions({
      route: s.meta.route ?? 'self',
      hire: s.finlit.hire,
      marketingBudget: s.finlit.marketingBudget,
      salesBudget: s.finlit.salesBudget,
      demandMult: s.finlit.demandMult,
      sellMult: s.finlit.sellMult,
    }),
  };
}

/** Non-persistent canonical preview from gamesim, for comparison against the
 *  local `previewFinlitPhase`. Never throws — callers treat a null return as
 *  "server preview unavailable", falling back to the local number. */
export async function fetchCanonicalPreview(s: GameState) {
  try {
    const payload = buildFinlitPayload(s);
    return await gamesim.postPreview({ decisionVersion: null, payload });
  } catch (err) {
    console.warn('[gamesim] canonical preview unavailable, using local engine result', err);
    return null;
  }
}

/**
 * Save-then-submit the current phase's decision to gamesim. Throws
 * GamesimSyncError on failure so the UI can surface the error and offer retry —
 * callers must not treat the phase as synced until this resolves successfully.
 */
export async function saveDraftAndSubmit(s: GameState): Promise<gamesim.TeamRoundDecisionDto> {
  try {
    const { decision: existing } = await gamesim.getCurrentDecision();
    const payload = buildFinlitPayload(s);
    const saved = await gamesim.putCurrentDecision({
      version: existing?.version ?? 0,
      configVersion: FINLIT_CONFIG_VERSION,
      payload,
    });
    return await gamesim.submitCurrentDecision({ version: saved.version });
  } catch (err) {
    const message =
      err instanceof gamesim.GamesimApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to sync decision with the simulation server.';
    throw new GamesimSyncError(message, err);
  }
}

/**
 * Overlays a gamesim-persisted decision onto the current draft (Immer
 * mutator, call via `apply()`). The server is authoritative whenever a draft
 * exists there — this REPLACES local values for every field it carries, it
 * does not merge/prefer local. Only overlays lines that already exist
 * locally (matched by id): FinlitLine carries no archetype/cover/binding/
 * size/paperQuality/pricePoint/addOnsByArchetype/quantityTarget, so a line
 * the player has never seen on this device can't be reconstructed from
 * server data alone — synthesizing one with invented defaults is a real
 * product decision, not something to do silently here.
 */
export function applyFinlitDraft(s: GameState, payload: FinlitDecisionPayload): void {
  const overlayById = new Map(payload.lines.map((l) => [l.id, fromFinlitLine(l)] as const));
  for (const line of s.portfolio.productLines) {
    const overlay = overlayById.get(line.id);
    if (!overlay) continue;
    line.name = overlay.name;
    line.genre = overlay.genre;
    line.finlitSpec = overlay.finlitSpec;
    line.price = overlay.price;
    line.channels = overlay.channels;
    line.vendor = overlay.vendor;
    line.targetPerDay = overlay.targetPerDay;
    line.inventory.finished = overlay.finished;
  }

  const decisions = fromFinlitDecisions(payload.decisions);
  s.meta.route = decisions.route;
  s.finlit.hire = decisions.hire ?? null;
  s.finlit.marketingBudget = decisions.marketingBudget ?? 0;
  s.finlit.salesBudget = decisions.salesBudget ?? 0;
  s.finlit.demandMult = decisions.demandMult ?? 1;
  s.finlit.sellMult = decisions.sellMult ?? 1;
}

/** Fetches the current round's saved decision from gamesim and, if one
 *  exists, overlays it onto local state via `applyFinlitDraft`. Safe to call
 *  on every bootstrap — a 404/no-draft response is a no-op, not an error. */
export async function hydrateDraftFromGamesim(
  apply: (mut: (s: GameState) => void) => void,
): Promise<void> {
  try {
    const { decision } = await gamesim.getCurrentDecision();
    if (!decision) return;
    apply((draft) => applyFinlitDraft(draft, decision.payload));
  } catch (err) {
    console.warn('[gamesim] failed to hydrate saved draft', err);
  }
}
