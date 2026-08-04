import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as gamesim from './client';
import { hydratePlayerConfig } from './configHydrator';
import { PassKeyScreen } from '@/components/passkey/PassKeyScreen';
import { GamesimStatusScreen } from '@/components/gamesim/GamesimStatusScreen';
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
  /** May this team POST a decision now? Once per round, Active only. */
  canSubmit: boolean;
  /** May the player run their own phase locally? */
  canAdvance: boolean;
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

/**
 * Raw network errors are not player-facing copy. `fetch` rejects with the
 * literal string "Failed to fetch" when the API is unreachable, which told a
 * student nothing and looked like a crash. Anything we don't recognise is
 * dropped rather than shown verbatim.
 */
function playerFacingError(raw: string | null): string {
  if (!raw) return 'The simulation server is not responding right now.';
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'The simulation server is not responding. It may be starting up, or your connection dropped.';
  }
  // Server-authored messages are written for humans; pass those through.
  return raw;
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
  /**
   * True once a bootstrap has succeeded. The 20s poll calls refetchBootstrap()
   * to notice an operator opening/closing a round, which re-runs the bootstrap
   * effect below — but that effect BLOCKS the whole app while `status` is
   * 'loading' (see the early return near the bottom of this file). Without
   * this flag every poll tore the running game down to the loading screen and
   * remounted it, which read as the simulation reloading itself every 20s and
   * wiped all component-local state (in-progress form input, the Amelia intro
   * guard, open panels). Background refreshes must stay silent.
   */
  const hasLoadedRef = useRef(false);

  const refetchBootstrap = useCallback(() => setReloadToken((n) => n + 1), []);

  const logout = useCallback(() => {
    gamesim.clearGamesimSession();
    hasLoadedRef.current = false;
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
      // Only the FIRST load may block the app. A background refetch keeps the
      // game mounted and swaps the context in underneath it.
      if (!hasLoadedRef.current) setStatus('loading');
      try {
        const simulation = await gamesim.getSimulation(session.simulationId);

        // Overlay the operator's published game content before the app
        // un-blocks — while `status` is 'loading' nothing below this provider
        // is mounted, so no component can render bundled values and then see
        // them change. Never throws and never rejects the bootstrap: with no
        // config, an unreachable server, or a payload it won't accept, the
        // bundled data stands and the game plays exactly as it shipped.
        if (!hasLoadedRef.current) {
          const report = await hydratePlayerConfig(simulation.simulationTypeId);
          if ((import.meta as any).env?.DEV) console.info('[gamesim] player config', report);
        }

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
        hasLoadedRef.current = true;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof gamesim.GamesimApiError) {
          if (err.status === 401 || err.status === 403) {
            // A genuinely expired/revoked team token — re-auth is the only
            // way forward, so this one does evict, first load or not.
            gamesim.clearGamesimSession();
            hasLoadedRef.current = false;
            setStatus('login');
            return;
          }
        }
        // Past the first load, a failed BACKGROUND refresh must not throw the
        // player out of a run they're mid-way through: one flaky poll would
        // otherwise replace the game with a full-screen error. Keep the last
        // good context and let the next poll recover.
        if (hasLoadedRef.current) return;
        if (err instanceof gamesim.GamesimApiError && err.status === 404) {
          setError(err.message);
          setStatus('no-simulation');
          return;
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

  // Two DIFFERENT questions, previously answered by one flag:
  //
  //   canSubmit  — may this team POST a decision right now? Once per round,
  //                only while the round is Active. `/decisions` is insert-only
  //                and 409s on a resubmit, so this has to stay strict.
  //   canAdvance — may the player run their own phase? The local FinLit engine
  //                drives gameplay; the server is authoritative for scoring,
  //                not for whether the player is allowed to keep playing.
  //
  // Conflating them meant that the moment a decision was sent, Confirm went
  // permanently disabled: the player sat at the phase boundary with a greyed
  // button and no way to reach their own evaluation. Sending the decision has
  // to stop the POST, not the game.
  const roundIsActive = !!bootstrap?.round && bootstrap.round.status === 'Active';
  const canSubmit = roundIsActive && !submittedDecision;
  const canAdvance = roundIsActive || !!submittedDecision;

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
    canSubmit,
    canAdvance,
    refetchBootstrap,
    refreshOfficial,
    logout,
  };

  if (status === 'checking' || status === 'loading') {
    return (
      <GamesimStatusScreen
        title="Opening your studio"
        subtitle="Fetching your team, your round and the market data."
      />
    );
  }
  if (status === 'login') {
    // The V3 Academy gate IS the login: PassKeyPanel calls verifyPassKey
    // (src/access/passkey.ts), which signs in against the gamesim API and
    // stores the session, then hands off here to load the simulation context.
    return <PassKeyScreen onEnter={refetchBootstrap} />;
  }
  if (status === 'no-simulation') {
    return (
      <GamesimStatusScreen
        tone="waiting"
        title="No active simulation"
        subtitle={error ?? 'Ask your facilitator to set up a simulation for your team.'}
        retry={refetchBootstrap}
      />
    );
  }
  if (status === 'error') {
    return (
      <GamesimStatusScreen
        tone="error"
        title="Can't reach the server"
        subtitle={playerFacingError(error)}
        retry={refetchBootstrap}
      />
    );
  }

  // No round yet, or the only round is still Pending — block gameplay until an
  // operator activates a round. Completed rounds still render the app so
  // official results stay visible; submit is gated on `canSubmit` separately.
  if (!bootstrap?.round || bootstrap.round.status === 'Pending') {
    return (
      <GamesimContext.Provider value={value}>
        <GamesimStatusScreen
          tone="waiting"
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
