import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as gamesim from './client';
import { PasskeyLoginScreen } from './PasskeyLoginScreen';
import {
  fetchOfficialFinancials,
  fetchOfficialResults,
  fetchSubmittedDecision,
  type OfficialFinancials,
  type OfficialRoundResults,
  type RoundContext,
} from './sync';
import type {
  BaseDataDto,
  DecisionDto,
  GlobalInputDto,
  Id,
  ProductDto,
  RoundDto,
  SimulationDto,
} from './types';

type Status = 'checking' | 'login' | 'loading' | 'no-simulation' | 'ready' | 'error';

/** Everything the player needs about its simulation, assembled from main's
 *  generic routes (main has no single /player/bootstrap endpoint). */
export interface GamesimBootstrap {
  teamId: Id;
  simulation: SimulationDto;
  /** Highest Active round, else the highest-numbered round, else null. */
  round: RoundDto | null;
  rounds: RoundDto[];
  /** Product configuration = the decision form's schema (field ids live here). */
  products: ProductDto[];
  baseData: BaseDataDto | null;
  globalInputs: GlobalInputDto[];
}

interface GamesimSessionValue {
  status: Status;
  bootstrap: GamesimBootstrap | null;
  error: string | null;
  /** Ids every sync call needs; null until a round is known. */
  roundContext: RoundContext | null;
  /** The round's submitted decision, if this team already sent one. */
  submittedDecision: DecisionDto | null;
  /** Official cross-team results per round — server-authoritative. */
  resultsByRound: Record<number, OfficialRoundResults>;
  /** Official own-team financials per round — server-authoritative. */
  financialsByRound: Record<number, OfficialFinancials>;
  latestResults: OfficialRoundResults | null;
  latestFinancials: OfficialFinancials | null;
  /** productId → productName, for labelling server numbers. */
  productNames: Record<Id, string>;
  /** Round is Active and this team has not submitted yet. */
  canPlay: boolean;
  refetchBootstrap: () => void;
  /** Re-read official results/financials for the current round. */
  refreshOfficial: () => Promise<void>;
  logout: () => void;
}

const GamesimContext = createContext<GamesimSessionValue | null>(null);

export function useGamesimSession(): GamesimSessionValue {
  const ctx = useContext(GamesimContext);
  if (!ctx) throw new Error('useGamesimSession must be used within GamesimProvider');
  return ctx;
}

const pickCurrentRound = (rounds: RoundDto[]): RoundDto | null => {
  if (rounds.length === 0) return null;
  const byNumber = [...rounds].sort((a, b) => b.roundNumber - a.roundNumber);
  return byNumber.find((r) => r.status === 'Active') ?? byNumber[0];
};

/** How often the app re-reads round state + official numbers. main's Socket.IO
 *  server emits no round/result events, so this is a plain poll — deliberately
 *  slow, since every tick is a handful of GETs. */
const POLL_MS = 20_000;

/**
 * Gates the app behind a gamesim team session: passkey login, then assembles the
 * simulation context from main's routes (simulation → rounds → products /
 * base-data / global-inputs) and keeps the official numbers fresh by polling.
 */
export function GamesimProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [bootstrap, setBootstrap] = useState<GamesimBootstrap | null>(null);
  const [submittedDecision, setSubmittedDecision] = useState<DecisionDto | null>(null);
  const [resultsByRound, setResultsByRound] = useState<Record<number, OfficialRoundResults>>({});
  const [financialsByRound, setFinancialsByRound] = useState<Record<number, OfficialFinancials>>({});
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetchBootstrap = useCallback(() => setReloadToken((n) => n + 1), []);

  const logout = useCallback(() => {
    gamesim.clearGamesimSession();
    setBootstrap(null);
    setSubmittedDecision(null);
    setResultsByRound({});
    setFinancialsByRound({});
    setStatus('login');
  }, []);

  const productNames = useMemo(() => {
    const map: Record<Id, string> = {};
    for (const p of bootstrap?.products ?? []) map[p._id] = p.productName;
    return map;
  }, [bootstrap?.products]);

  const roundContext: RoundContext | null = useMemo(() => {
    if (!bootstrap?.round) return null;
    return {
      simulationId: bootstrap.simulation._id,
      simulationTypeId: bootstrap.simulation.simulationTypeId,
      teamId: bootstrap.teamId,
      roundNumber: bootstrap.round.roundNumber,
    };
  }, [bootstrap]);

  // ── Bootstrap ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = gamesim.getStoredSession();
      if (!session) {
        setStatus('login');
        return;
      }
      setStatus('loading');
      try {
        const simulation = await gamesim.getSimulation(session.simulationId);
        const rounds = await gamesim.getRounds(session.simulationId);
        const [products, baseData, globalInputs] = await Promise.all([
          gamesim.getProducts(simulation.simulationTypeId),
          gamesim.getBaseData(simulation.simulationTypeId).catch(() => []),
          gamesim.getGlobalInputs(simulation.simulationTypeId).catch(() => []),
        ]);
        if (cancelled) return;

        setBootstrap({
          teamId: session.teamId,
          simulation,
          rounds,
          round: pickCurrentRound(rounds),
          products,
          baseData: baseData[0] ?? null,
          globalInputs,
        });
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof gamesim.GamesimApiError) {
          if (err.status === 401 || err.status === 403) {
            gamesim.clearGamesimSession();
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
  }, [reloadToken]);

  // ── Official numbers + submission state for the current round ─────────
  const refreshOfficial = useCallback(async () => {
    if (!bootstrap?.round) return;
    const args = {
      simulationId: bootstrap.simulation._id,
      teamId: bootstrap.teamId,
      roundNumber: bootstrap.round.roundNumber,
    };
    const [decision, results, financials] = await Promise.all([
      fetchSubmittedDecision(args),
      fetchOfficialResults(args).catch(() => null),
      fetchOfficialFinancials({ ...args, productNames }).catch(() => null),
    ]);
    setSubmittedDecision(decision);
    if (results) setResultsByRound((prev) => ({ ...prev, [results.roundNumber]: results }));
    if (financials) setFinancialsByRound((prev) => ({ ...prev, [financials.roundNumber]: financials }));
  }, [bootstrap, productNames]);

  useEffect(() => {
    if (status !== 'ready' || !bootstrap?.round) return undefined;
    void refreshOfficial();
    const timer = window.setInterval(() => {
      // Re-read the round list too: an operator activating the next round or
      // finalizing this one is only visible over HTTP.
      refetchBootstrap();
      void refreshOfficial();
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, bootstrap?.round?._id, refreshOfficial, refetchBootstrap]);

  const latestOf = <T extends { roundNumber: number }>(byRound: Record<number, T>): T | null => {
    const rounds = Object.keys(byRound).map(Number);
    if (rounds.length === 0) return null;
    return byRound[Math.max(...rounds)] ?? null;
  };

  const latestResults = useMemo(() => latestOf(resultsByRound), [resultsByRound]);
  const latestFinancials = useMemo(() => latestOf(financialsByRound), [financialsByRound]);

  const canPlay = !!bootstrap?.round && bootstrap.round.status === 'Active' && !submittedDecision;

  const value: GamesimSessionValue = {
    status,
    bootstrap,
    error,
    roundContext,
    submittedDecision,
    resultsByRound,
    financialsByRound,
    latestResults,
    latestFinancials,
    productNames,
    canPlay,
    refetchBootstrap,
    refreshOfficial,
    logout,
  };

  if (status === 'checking' || status === 'loading') {
    return <FullScreenMessage title="Loading your team's simulation..." />;
  }
  if (status === 'login') {
    return <PasskeyLoginScreen onSuccess={refetchBootstrap} />;
  }
  if (status === 'no-simulation') {
    return (
      <FullScreenMessage
        title="No active simulation"
        subtitle={error ?? 'Ask your facilitator to set up a simulation for your team.'}
        retry={refetchBootstrap}
      />
    );
  }
  if (status === 'error') {
    return (
      <FullScreenMessage
        title="Couldn't reach the simulation server"
        subtitle={error ?? undefined}
        retry={refetchBootstrap}
      />
    );
  }

  // No round yet, or the only round is still Pending — block gameplay until an
  // operator activates a round. Completed rounds still render the app so
  // official results stay visible; submit is gated on `canPlay` separately.
  if (!bootstrap?.round || bootstrap.round.status === 'Pending') {
    return (
      <GamesimContext.Provider value={value}>
        <FullScreenMessage
          title="Waiting for round"
          subtitle={
            !bootstrap?.round
              ? 'Ask your facilitator to open a round for your team.'
              : `Round ${bootstrap.round.roundNumber} is pending. Waiting for the facilitator to activate it.`
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
