import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as gamesim from './client';
import { connectGamesimSocket, disconnectGamesimSocket, onGamesimEvent } from './socket';
import { hydrateDraftFromGamesim } from './sync';
import { useGame } from '@/state/store';
import type { BootstrapResponse, TeamRoundResultDto } from './types';
import { PasskeyLoginScreen } from './PasskeyLoginScreen';

type Status = 'checking' | 'login' | 'loading' | 'no-simulation' | 'ready' | 'error';

interface GamesimSessionValue {
  status: Status;
  bootstrap: BootstrapResponse | null;
  error: string | null;
  /** The current round's finalized result, once an operator has published it —
   *  null until then, or if the current round hasn't been finalized yet.
   *  Refreshed automatically on the `result.published` socket event. */
  latestResult: TeamRoundResultDto | null;
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
  const [latestResult, setLatestResult] = useState<TeamRoundResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetchBootstrap = useCallback(() => setReloadToken((n) => n + 1), []);

  const refetchResult = useCallback(async () => {
    try {
      const result = await gamesim.getCurrentResult();
      setLatestResult(result);
    } catch (err) {
      // 404 just means the current round hasn't been finalized yet — not an error state.
      if (!(err instanceof gamesim.GamesimApiError && err.status === 404)) {
        console.warn('[gamesim] failed to load current result', err);
      }
      setLatestResult(null);
    }
  }, []);

  const logout = useCallback(() => {
    void gamesim.logoutFromGamesim();
    gamesim.clearGamesimToken();
    disconnectGamesimSocket();
    setBootstrap(null);
    setLatestResult(null);
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
        // A successful bootstrap always carries a simulation (resolvePlayerContext
        // 404s otherwise, caught below) — `round` may still be null pre-launch.
        setStatus('ready');
        connectGamesimSocket();
        if (data.permissions.canViewResult) void refetchResult();
        else setLatestResult(null);
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
  }, [reloadToken, refetchResult]);

  // Hydrate the saved draft once per round — not on every reload/socket
  // refetch, which would otherwise clobber in-progress local edits with
  // whatever was last saved (autosave only happens at phase-confirm today,
  // not per keystroke, so "last saved" can lag behind what's on screen).
  const hydratedRoundRef = useRef<string | null>(null);
  useEffect(() => {
    const roundId = bootstrap?.round?.id ?? null;
    if (status !== 'ready' || !roundId || hydratedRoundRef.current === roundId) return;
    hydratedRoundRef.current = roundId;
    void hydrateDraftFromGamesim(useGame.getState().apply);
  }, [status, bootstrap?.round?.id]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    const unsubscribers = [
      onGamesimEvent('round.started', () => refetchBootstrap()),
      onGamesimEvent('round.completed', () => refetchBootstrap()),
      onGamesimEvent('decision.submitted', () => refetchBootstrap()),
      // A published result doesn't change round/permissions in a way
      // refetchBootstrap alone would surface promptly — fetch it directly.
      onGamesimEvent('result.published', () => {
        refetchBootstrap();
        void refetchResult();
      }),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [status, refetchBootstrap, refetchResult]);

  const value: GamesimSessionValue = { status, bootstrap, latestResult, error, refetchBootstrap, logout };

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
