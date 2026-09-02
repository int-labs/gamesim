// Live server projection hook.
//
// ── TRIGGERED ON INTERACTION END, NOT ON STATE CHANGE ───────────────────────
// This used to `useGame.subscribe(...)` and fire a 200ms debounce on every
// mutation of `portfolio.productLines` or `globalInputSelections`. Dragging a
// slider is dozens of mutations, so a single gesture produced a burst of
// requests to an endpoint that UPSERTS the team's projection document — and the
// debounce only collapsed the tail of the burst, not the gesture.
//
// Callers now say when a decision is FINISHED:
//   • <input type="range">  → onPointerUp (and onKeyUp for keyboard dragging)
//   • text / number inputs  → onKeyUp + onBlur
//   • selects and buttons   → onChange / onClick (no separate "end" exists)
//   • modals                → onSubmit / commit
// with a short trailing delay so a rapid sequence of commits still coalesces.
//
// Always live — never frozen, even after submission. Components that need a
// frozen snapshot (e.g. PhaseSequenceModal) snapshot the value themselves when
// submittedDecision becomes truthy.
//
// Return shape:
//   liveProjection — latest ServerProjectionResult from the server, or null
//   loading        — true while a recalc request is in flight
//   recalc         — call at the END of a decision interaction

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '@/state/store';
import { useGamesimSession } from './GamesimProvider';
import { fetchServerProjection, type ServerProjectionResult } from './sync';

/** Trailing delay after an interaction ends, so a rapid run of commits — four
 *  spec selects in a row, say — coalesces into one request. */
const COMMIT_DELAY_MS = 150;

export interface LiveProjectionState {
  liveProjection: ServerProjectionResult | null;
  loading: boolean;
  /**
   * Call when a decision interaction ENDS — pointer up on a slider, blur on an
   * input, a button click, a modal commit. `reason` is logged so a stray
   * trigger is traceable to its control.
   */
  recalc: (reason: string) => void;
}

export function useLiveProjection(): LiveProjectionState {
  const { roundContext, bootstrap, reportProgress } = useGamesimSession();

  const [liveProjection, setLiveProjection] = useState<ServerProjectionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runRecalc = useCallback(async (reason: string) => {
    if (!roundContext) return;

    const gs = useGame.getState();
    const products = bootstrap?.products ?? [];
    if (products.length === 0) return;

    console.log(`[useLiveProjection] recalc triggered — ${reason}`);
    setLoading(true);

    try {
      const result = await fetchServerProjection(roundContext, {
        state: gs as any,
        products,
        availableGlobalInputs: gs.availableGlobalInputs,
      });
      console.log('[useLiveProjection] recalc complete', result);
      setLiveProjection(result);
    } catch (err) {
      console.warn('[useLiveProjection] recalc failed, liveProjection unchanged', err);
    } finally {
      setLoading(false);
    }

    // A decision was committed, so the facilitator's roster is stale. Reported
    // HERE rather than at each of the eight control sites: this is already the
    // single place every decision funnels through, and duplicating the call
    // per control is one more thing to forget.
    reportProgress();
  }, [roundContext, bootstrap?.products, reportProgress]);

  /**
   * The public trigger. Coalesces on a short trailing delay: the LAST call in a
   * burst wins, so committing four spec axes in quick succession is one request.
   *
   * There is deliberately no state subscription behind this. A caller that
   * forgets to call it leaves a stale projection — visible, and traceable from
   * the absent `reason` in the log — which is preferable to the previous
   * behaviour, where a single slider drag fired a burst of upserts at an
   * endpoint that rewrites the team's projection document.
   */
  const recalc = useCallback((reason: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void runRecalc(reason);
    }, COMMIT_DELAY_MS);
  }, [runRecalc]);

  // Fire once per ROUND, so the panels have figures before the player touches
  // anything.
  //
  // ── LATCHED PER ROUND, NOT PER `bootstrap` IDENTITY ──────────────────────
  // `runRecalc` is memoised on `[roundContext, bootstrap?.products]`, and
  // `roundContext` is memoised on `[bootstrap]`. The provider's 20s poll calls
  // `refetchBootstrap()`, which replaces `bootstrap` — so with `runRecalc` in
  // the deps and no guard, every poll re-fired this as a REAL request to an
  // endpoint that upserts the team's projection. That defeated the entire
  // interaction-end model: the page recalculated on a timer while sitting idle.
  //
  // The effect may still re-run; the ref is what stops it acting.
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!roundContext) return;
    // Latch only once products exist. `runRecalc` returns early on an empty
    // products array, so latching before bootstrap finishes loading would mark
    // the round as fired without ever having fired it.
    if ((bootstrap?.products?.length ?? 0) === 0) return;

    const key = `${roundContext.simulationId}:${roundContext.roundNumber}`;
    if (firedFor.current === key) return;
    firedFor.current = key;
    void runRecalc('initial load');
  }, [
    roundContext?.simulationId,
    roundContext?.roundNumber,
    bootstrap?.products?.length,
    runRecalc,
  ]);

  // Timer cleanup on its own, so it is not tied to the guarded effect above —
  // returning it from that one would clear a pending commit on every re-run.
  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  return { liveProjection, loading, recalc };
}
