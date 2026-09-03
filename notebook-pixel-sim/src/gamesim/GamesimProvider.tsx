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
import { hydrateFieldConfig } from '@/engine/finlit/core/config/fieldConfig';
import { hydrateChannels } from '@/engine/finlit/core/config/channels';
import { useGame } from '@/state/store';
import { computeFinalScore } from '@/engine/mockEngine';
import { PassKeyScreen } from '@/components/passkey/PassKeyScreen';
import { devSkip } from '@/access/passkey';
import { GamesimStatusScreen } from '@/components/gamesim/GamesimStatusScreen';
import {
  fetchAllOfficialFinancials,
  fetchAllOfficialResults,
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
  SimulationMode,
} from './types';

type Status = 'checking' | 'login' | 'loading' | 'no-simulation' | 'ready' | 'error' | 'standalone';

/** Everything the player needs about its simulation, assembled from main's
 *  generic routes (main has no single /player/bootstrap endpoint). */
export interface GamesimBootstrap {
  teamId: Id;
  /** Who this team is — name + generated avatar, from the passkey login. */
  teamName?: string;
  teamAvatarUrl?: string | null;
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
  /**
   * How this simulation is run. Decides whether confirming a round enters a WAIT
   * for the operator's calculation, or resolves immediately from the team's own
   * projections. Compare it directly — there is deliberately no `isSinglePlayer`
   * companion, which would be a second name for the same fact.
   */
  mode: SimulationMode;
  /** May this team POST a decision now? Once per round, Active only. */
  canSubmit: boolean;
  /** May the player run their own phase locally? */
  canAdvance: boolean;
  refetchBootstrap: () => void;
  /** Re-read official results/financials for EVERY round up to the current one,
   *  so the P&L keeps its earlier columns across a reload. */
  refreshOfficial: () => Promise<void>;
  /**
   * Report this team's progress to the facilitator console. EVENT-DRIVEN — there
   * is no interval. Called on every decision (via `useLiveProjection.recalc`),
   * when the tab loses focus, and at each milestone.
   */
  reportProgress: () => void;
  logout: () => void;
}

const GamesimContext = createContext<GamesimSessionValue | null>(null);

export function useGamesimSession(): GamesimSessionValue {
  const ctx = useContext(GamesimContext);
  if (!ctx) throw new Error('useGamesimSession must be used within GamesimProvider');
  return ctx;
}

/**
 * THE round-numbering seam, and the ONLY place the conversion happens.
 * Server round numbers are 0-BASED; the player reads 1-based phases, so P1 is
 * round 0. Anything keyed by the server is indexed by ROUND NUMBER.
 * See ../../../server/README.md#round-numbering
 */
export const phaseFromRoundNumber = (roundNumber: number): number => roundNumber + 1;
export const roundNumberFromPhase = (phase: number): number => phase - 1;

/**
 * The operator's round count, or `undefined` when it is not known — standalone
 * play with no server, or a simulation configured before the field existed.
 *
 * NOTE this is a COUNT, not an index: `totalRounds: 3` means round numbers 0-2,
 * i.e. phases 1-3. So `phase >= totalRounds` is the correct final-phase test,
 * while a round-number test needs `roundNumber >= totalRounds - 1`.
 *
 * It lives on `simulation.config`, NOT on the round: `RoundDto` carries only
 * `roundNumber`, because a round does not know how many siblings it has.
 *
 * `undefined` is deliberately not defaulted to 3 here. Three callers want
 * different things from a missing value — a loop bound wants 0, a "N of M"
 * label wants to omit the M rather than assert a wrong one — and a default
 * buried in this hook would reinstate the hardcoded 3 it replaced.
 */
export function useTotalRounds(): number | undefined {
  const { bootstrap } = useGamesimSession();
  const n = bootstrap?.simulation.config?.totalRounds;
  return typeof n === 'number' && n > 0 ? n : undefined;
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

// No POLL_MS. Nothing in this provider polls: round state and official numbers
// are re-read when the player returns to the tab, and team progress is reported
// on decisions, tab blur and milestones. The sim runs locally and is
// authoritative — there is no server tick to stay in step with, so a timer only
// ever reported that the tab was open.

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
      // Dev escape hatch, and the ONLY place it is honoured besides
      // <PassKeyGate>. `VITE_SKIP_PASSKEY=1` used to clear the outer gate and
      // then land here with no session, where `setStatus('login')` rendered
      // the very same <PassKeyScreen> the flag had just dismissed — so the
      // documented bypass looked completely broken. There is no session to
      // bootstrap from in that mode, so drop straight to standalone play:
      // bundled game data, no server, no team context.
      if (devSkip() && !gamesim.getStoredSession()) {
        setStatus('standalone');
        return;
      }
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
        hydrateFieldConfig(products);
        useGame.getState().setAvailableGlobalInputs(globalInputs);
        // No hiring hydration: the UI reads the hiring container straight out of
        // `availableGlobalInputs` (set above), so there is no local candidate
        // table left to fill. Only presentation — the candidate images — is
        // overlaid, and configHydrator does that from PlayerConfig.
        // No vendor hydration either — the UI reads the supply_chain container
        // straight out of `availableGlobalInputs`.
        const channelInput = globalInputs.find((g) => g.key === 'channel');
        if (channelInput) hydrateChannels(channelInput.inputs, products);

        setBootstrap({
          teamId: session.teamId,
          teamName: session.teamName,
          teamAvatarUrl: session.avatarUrl ?? null,
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

  // ── Official numbers (every scored round) + this round's submission ───
  const refreshOfficial = useCallback(async () => {
    if (!bootstrap?.round) return;
    const args = {
      simulationId: bootstrap.simulation._id,
      teamId: bootstrap.teamId,
    };

    // The submitted decision is a CURRENT-round question — only this round can
    // still be submitted to.
    const decision = await fetchSubmittedDecision({
      ...args,
      roundNumber: bootstrap.round.roundNumber,
    });
    setSubmittedDecision(decision);

    // EVERY scored round, in TWO requests — not one pair per round. Both
    // endpoints filter by `roundNumber` only when it is given, and every
    // document carries its own, which is what backfills the P&L's phase
    // columns. Asking per round also meant the map only ever held rounds this
    // session was live for, so a reload emptied every earlier column.
    const [financials, results] = await Promise.all([
      fetchAllOfficialFinancials({ ...args, productNames }),
      fetchAllOfficialResults(args),
    ]);
    // REPLACE, not merge: this is the complete history, so a stale key here
    // would be a round the server no longer scores (an operator reset).
    setFinancialsByRound(financials);
    setResultsByRound(results);
  }, [bootstrap, productNames]);

  // ── NO POLLING ────────────────────────────────────────────────────────────
  // This used to refetch the round list and the official numbers every 20s, to
  // notice an operator activating or finalising a round. Nothing needed it:
  //
  //   • Submitting into a closed round already fails cleanly — the server
  //     answers 409 and `submitRoundDecision` surfaces it. Stale `canSubmit`
  //     costs a failed POST with a clear message, not a corrupt state.
  //   • `canAdvance` gates the LOCAL phase run, which touches no server.
  //   • The one moment official numbers must be current is straight after a
  //     submission, and `PhaseSequenceModal` already calls `refreshOfficial()`
  //     there explicitly.
  //
  // And it was not free: `refetchBootstrap()` replaced `bootstrap`, whose
  // identity `useLiveProjection`'s recalc effect keyed off — so the poll was
  // itself firing projection recalcs against an endpoint that upserts.
  //
  // Refreshed instead when the player RETURNS to the tab — the mirror of the
  // progress beat on blur. Someone who has been away is exactly who needs the
  // current round status; someone staring at the page has not missed anything
  // that a stale status would mislead them about.
  useEffect(() => {
    if (status !== 'ready' || !bootstrap?.round) return undefined;

    void refreshOfficial();

    const onShow = () => {
      if (document.visibilityState !== 'visible') return;
      refetchBootstrap();
      void refreshOfficial();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, bootstrap?.round?._id, refreshOfficial, refetchBootstrap]);

  // ── Progress heartbeat ────────────────────────────────────────────────
  //
  // Tells the facilitator where this team has got to, so the console can show
  // who is playing, who is stuck and who has finished. It is a one-way report:
  // nothing here is read back, and nothing about the run depends on it.
  //
  // ── EVENT-DRIVEN, NOT POLLED ─────────────────────────────────────────────
  // There is no interval. This sim is local and authoritative — there is no
  // connection to maintain and no server-side tick to stay in step with, so a
  // timer only ever reported "the JS is running", which is not the same as
  // "someone is playing". It fired for every open tab forever, per team.
  //
  // It beats on the three things that actually mean something:
  //   • a DECISION — `useLiveProjection.recalc` calls `reportProgress`, so the
  //     roster is fresh whenever the player does anything. Decisions otherwise
  //     write only `Projections`, which carries none of the roster fields.
  //   • the tab LOSING FOCUS — a final, accurate "they stopped looking" mark.
  //   • a MILESTONE — phase rollover or run end.
  //
  // What this gives up: a team sitting on a focused tab doing nothing looks
  // idle. That is correct — the round timer is what forces a decision, so
  // deliberating without acting is indistinguishable from not acting, and the
  // console should say so.
  const runPhase = useGame((s) => s.meta.phase);
  const runEnded = useGame((s) => s.meta.ended);

  // The round counter has ONE owner: the server. Corrections DOWNWARD are
  // valid too (an operator resetting a round must pull the client back).
  const serverRoundNumber = bootstrap?.round?.roundNumber;
  const applyToStore = useGame((s) => s.apply);
  useEffect(() => {
    if (serverRoundNumber === undefined) return;
    const phase = phaseFromRoundNumber(serverRoundNumber);
    if (useGame.getState().meta.phase === phase) return;
    applyToStore((s) => {
      s.meta.phase = phase;
    });
  }, [serverRoundNumber, applyToStore]);

  const reportProgress = useCallback(() => {
    if (status !== 'ready' || !bootstrap?.round) return;
    // Read at call time rather than closing over the values, so every path
    // sends the CURRENT state and not the state at mount.
    const s = useGame.getState();
    void gamesim.reportTeamProgress({
      roundNumber: bootstrap.round.roundNumber,
      day: s.meta.day,
      phase: s.meta.phase,
      cash: s.player.cash,
      energy: s.player.energy,
      lines: s.portfolio.productLines.length,
      shopName: s.meta.shopName,
      ended: s.meta.ended,
    });
  }, [status, bootstrap?.round?.roundNumber]);

  // Session start, and each milestone.
  useEffect(() => {
    reportProgress();
    // `runPhase` / `runEnded` are triggers, not values the body reads. No
    // eslint-disable needed: every dep is listed, so the rule is satisfied.
  }, [reportProgress, runPhase, runEnded]);

  // Tab hidden or window blurred — the honest "stopped looking" signal.
  // `visibilitychange` covers tab switches and minimising; `blur` covers moving
  // to another window with this tab still visible.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') reportProgress();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', reportProgress);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', reportProgress);
    };
  }, [reportProgress]);

  // ── Run report ────────────────────────────────────────────────────────
  //
  // Filed once, when the team's own 90-day run finishes. This is the player's
  // rubric (Net Profit 50 · Inventory 25 · Insight 25), NOT the competitive
  // score — `Results` and `Projections` remain authoritative for anything
  // teams are ranked on. It exists so the debrief can show what a team
  // actually experienced rather than only where it placed.
  const filedFor = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'ready' || !bootstrap?.round || !runEnded) return;

    const round = bootstrap.round.roundNumber;
    // Once per round: `ended` stays true for the rest of the session, and this
    // effect re-runs on every unrelated dependency change.
    if (filedFor.current === round) return;
    filedFor.current = round;

    const s = useGame.getState();
    const score = computeFinalScore(s);
    void gamesim.reportRunResult({
      roundNumber: round,
      total: score.total,
      netProfit: score.netProfit,
      inventory: score.inventory,
      insight: score.insight,
      netDollar: score.netDollar,
      cleanliness: score.cleanliness,
      route: s.meta.route,
      obligationMet: score.obligationMet,
      insightsCorrect: s.insights.score.correct,
      insightsTotal: s.insights.score.total,
      shopName: s.meta.shopName,
    });
  }, [status, bootstrap?.round?._id, runEnded]);

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
  // The console writes this from a SELECT, so a stored value is always one of
  // the two. The `?? 'competitive'` covers only a simulation configured before
  // the field existed — operator-run, so that is the correct reading.
  const mode: SimulationMode = bootstrap?.simulation.config?.mode ?? 'competitive';

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
    mode,
    canSubmit,
    canAdvance,
    refetchBootstrap,
    refreshOfficial,
    reportProgress,
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
  //
  // `standalone` bypasses this too — it has no bootstrap by definition, and
  // gating it here would just swap the pass-key wall for a "waiting for
  // round" one. Every consumer already tolerates a null bootstrap (that is
  // what makes demo play work), so the app renders on bundled data alone.
  if (status !== 'standalone' && (!bootstrap?.round || bootstrap.round.status === 'Pending')) {
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
