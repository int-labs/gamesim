import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as gamesim from './client';
import { connectGamesimSocket, disconnectGamesimSocket, onGamesimEvent } from './socket';
import { hydrateDraftFromGamesim } from './sync';
import { useGame } from '@/state/store';
import type { BootstrapResponse, ResultPublishedPayload, TeamRoundResultDto } from '@gamesim/api-contract';
import { PasskeyLoginScreen } from './PasskeyLoginScreen';

type Status = 'checking' | 'login' | 'loading' | 'no-simulation' | 'ready' | 'error';

interface GamesimSessionValue {
  status: Status;
  bootstrap: BootstrapResponse | null;
  error: string | null;
  /** Finalized results keyed by round number — survives next-round activation. */
  resultsByRound: Record<number, TeamRoundResultDto>;
  /** Highest-numbered finalized result currently held in UI state. */
  latestResult: TeamRoundResultDto | null;
  /** True when the current round is Active and the team may edit/submit. */
  canPlay: boolean;
  refetchBootstrap: () => void;
  logout: () => void;
}

const GamesimContext = createContext<GamesimSessionValue | null>(null);

export function useGamesimSession(): GamesimSessionValue {
  const ctx = useContext(GamesimContext);
  if (!ctx) throw new Error('useGamesimSession must be used within GamesimProvider');
  return ctx;
}

/**
 * Gates the app behind a gamesim session: shows a passkey login screen if no
 * token is stored, loads /player/bootstrap once authenticated, and re-fetches
 * on round/result socket events (post-commit notifications trigger an
 * authoritative HTTP refetch — the socket payload itself is never trusted as
 * the data). Renders `children` once a round/simulation context is available.
 */
export function GamesimProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [resultsByRound, setResultsByRound] = useState<Record<number, TeamRoundResultDto>>({});
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetchBootstrap = useCallback(() => setReloadToken((n) => n + 1), []);

  const mergeResult = useCallback((result: TeamRoundResultDto) => {
    setResultsByRound((prev) => {
      if (prev[result.roundNumber]?.id === result.id) return prev;
      return { ...prev, [result.roundNumber]: result };
    });
  }, []);

  const loadAllResults = useCallback(async () => {
    try {
      const { results } = await gamesim.getResults();
      setResultsByRound((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.roundNumber] = r;
        return next;
      });
    } catch (err) {
      console.warn('[gamesim] failed to load results list', err);
    }
  }, []);

  const fetchResultForRound = useCallback(async (roundNumber: number) => {
    try {
      const result = await gamesim.getResultByRoundNumber(roundNumber);
      mergeResult(result);
      return result;
    } catch (err) {
      if (!(err instanceof gamesim.GamesimApiError && err.status === 404)) {
        console.warn(`[gamesim] failed to load result for round ${roundNumber}`, err);
      }
      return null;
    }
  }, [mergeResult]);

  const logout = useCallback(() => {
    gamesim.clearGamesimToken();
    disconnectGamesimSocket();
    setBootstrap(null);
    setResultsByRound({});
    setStatus('login');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gamesim.getGamesimToken()) {
        setStatus('login');
        return;
      }
      setStatus('loading');
      try {
        const data = await gamesim.getBootstrap();
        if (cancelled) return;
        setBootstrap(data);
        setStatus('ready');
        connectGamesimSocket();
        // Always hydrate the full results list so a previously finalized round
        // remains visible after the next round becomes Active.
        await loadAllResults();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof gamesim.GamesimApiError) {
          if (err.status === 401 || err.status === 403) {
            gamesim.clearGamesimToken();
            setStatus('login');
            return;
          }
          if (err.status === 404) {
            setError(err.message);
            setStatus('no-simulation');
            return;
          }
        }
        setError(err instanceof Error ? err.message : 'Failed to load simulation context.');
        setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, loadAllResults]);

  // Hydrate the saved draft once per round — not on every reload/socket
  // refetch, which would otherwise clobber in-progress local edits with
  // whatever was last saved (autosave only happens at phase-confirm today,
  // not per keystroke, so "last saved" can lag behind what's on screen).
  const hydratedRoundRef = useRef<string | null>(null);
  useEffect(() => {
    const roundId = bootstrap?.round?.id ?? null;
    if (status !== 'ready' || !roundId || hydratedRoundRef.current === roundId) return;
    if (!bootstrap?.permissions.canEditDecision) return;
    hydratedRoundRef.current = roundId;
    void hydrateDraftFromGamesim(useGame.getState().apply);
  }, [status, bootstrap?.round?.id, bootstrap?.permissions.canEditDecision]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    const unsubscribers = [
      onGamesimEvent('round.started', () => refetchBootstrap()),
      onGamesimEvent('round.completed', () => refetchBootstrap()),
      onGamesimEvent('decision.submitted', () => refetchBootstrap()),
      // Fetch the finalized result by the roundNumber in the event — never
      // /results/current, which would point at the next Active round once
      // finalization auto-activates it and would appear to "lose" the result.
      onGamesimEvent('result.published', (raw) => {
        const payload = raw as ResultPublishedPayload;
        refetchBootstrap();
        if (typeof payload?.roundNumber === 'number') {
          void fetchResultForRound(payload.roundNumber);
        } else {
          void loadAllResults();
        }
      }),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [status, refetchBootstrap, fetchResultForRound, loadAllResults]);

  const latestResult = useMemo(() => {
    const rounds = Object.keys(resultsByRound).map(Number);
    if (rounds.length === 0) return null;
    const maxRound = Math.max(...rounds);
    return resultsByRound[maxRound] ?? null;
  }, [resultsByRound]);

  const canPlay = !!bootstrap
    && bootstrap.round?.status === 'Active'
    && bootstrap.permissions.canEditDecision
    && bootstrap.permissions.canSubmitDecision;

  const value: GamesimSessionValue = {
    status,
    bootstrap,
    latestResult,
    resultsByRound,
    canPlay,
    error,
    refetchBootstrap,
    logout,
  };

  if (status === 'checking' || status === 'loading') {
    return <FullScreenMessage title="Loading your team's simulation..." />;
  }
  if (status === 'login') {
    return <PasskeyLoginScreen onSuccess={refetchBootstrap} />;
  }
  if (status === 'no-simulation') {
    return <FullScreenMessage title="No active simulation" subtitle={error ?? 'Ask your facilitator to activate a round for your team.'} />;
  }
  if (status === 'error') {
    return <FullScreenMessage title="Couldn't reach the simulation server" subtitle={error ?? undefined} retry={refetchBootstrap} />;
  }

  // No round yet, or the only round is still Pending — block gameplay until
  // an operator activates a round. Completed/submitted states still render the
  // app so local results + finalized payloads remain visible; PhaseSequenceModal
  // enforces canPlay for confirm/submit separately.
  if (!bootstrap?.round || bootstrap.round.status === 'Pending') {
    return (
      <GamesimContext.Provider value={value}>
        <FullScreenMessage
          title="Waiting for round"
          subtitle={
            !bootstrap?.round
              ? 'Ask your facilitator to open a round for your team.'
              : `Round ${bootstrap.round.number} is pending. Waiting for the facilitator to activate it.`
          }
          retry={refetchBootstrap}
        />
      </GamesimContext.Provider>
    );
  }

  return <GamesimContext.Provider value={value}>{children}</GamesimContext.Provider>;
}

function FullScreenMessage({ title, subtitle, retry }: { title: string; subtitle?: string; retry?: () => void }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, fontFamily: 'sans-serif', padding: 24, textAlign: 'center', background: '#fdf6ec', color: '#241c12' }}>
      <h2>{title}</h2>
      {subtitle && <p style={{ opacity: 0.7 }}>{subtitle}</p>}
      {retry && (
        <button onClick={retry} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Retry
        </button>
      )}
    </div>
  );
}
