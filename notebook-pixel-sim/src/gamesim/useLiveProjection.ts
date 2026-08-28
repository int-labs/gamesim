// Live server projection hook.
//
// Subscribes to game state changes and calls POST /projections/recalc on every
// decision edit (debounced). Always live — never frozen, even after submission.
// Components that need to show a frozen snapshot (e.g. PhaseSequenceModal)
// should snapshot the value themselves when submittedDecision becomes truthy.
//
// Return shape:
//   liveProjection — latest ServerProjectionResult from the server, or null
//   loading        — true while a recalc request is in flight

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '@/state/store';
import { useGamesimSession } from './GamesimProvider';
import { fetchServerProjection, type ServerProjectionResult } from './sync';

const DEBOUNCE_MS = 200;

export interface LiveProjectionState {
  liveProjection: ServerProjectionResult | null;
  loading: boolean;
}

export function useLiveProjection(): LiveProjectionState {
  const { roundContext, bootstrap } = useGamesimSession();

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
  }, [roundContext, bootstrap?.products]);

  // ── Subscribe to game state changes ────────────────────────────────────
  //
  // Watch portfolio.productLines (price, finlitSpec, archetype, addOns) and
  // globalInputSelections. Both are the inputs toDecisionInputs() reads, so
  // any change here means the projection is stale.
  useEffect(() => {
    if (!roundContext) return;

    const schedule = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void runRecalc('game state change');
      }, DEBOUNCE_MS);
    };

    // Fire once on mount / roundContext or bootstrap becoming available.
    void runRecalc('initial load');

    let prev = {
      lines: useGame.getState().portfolio.productLines,
      selections: useGame.getState().globalInputSelections,
    };

    const unsub = useGame.subscribe((s) => {
      const next = {
        lines: s.portfolio.productLines,
        selections: s.globalInputSelections,
      };
      const linesChanged = next.lines !== prev.lines;
      const selectionsChanged = next.selections !== prev.selections;
      if (linesChanged || selectionsChanged) {
        console.log('[useLiveProjection] state changed →', { linesChanged, selectionsChanged, selectionsLen: next.selections.length });
        prev = next;
        schedule();
      }
    });

    return () => {
      unsub();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  // runRecalc is memoised on roundContext + bootstrap.products — adding it here
  // ensures the effect re-runs when bootstrap finishes loading.
  }, [roundContext?.simulationId, roundContext?.roundNumber, runRecalc]);

  return { liveProjection, loading };
}
