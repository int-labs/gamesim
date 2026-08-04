import { CheckCircle2, CircleDashed, MonitorPlay } from "lucide-react";
import { IconTile } from "@/components/app/bits";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/app/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardArrow } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/primitives";
import { AttentionList } from "@/features/dashboard/attention-list";
import { buildAttention, standings, submissionState } from "@/features/dashboard/attention";
import { LiveRoundStrip } from "@/features/dashboard/live-round";
import { StandingsTable } from "@/features/dashboard/standings";
import {
  useActiveSimulationTypeId,
  useBaseData,
  useDecisions,
  useEndRound,
  useProducts,
  useResults,
  useRounds,
  useSimulations,
  useStorageStatus,
  useTeams,
  useUpdateRoundStatus,
  useUsers,
} from "@/lib/api-hooks";
import { usePlayerConfig } from "@/lib/player-config-hooks";
import { useScope } from "@/lib/scope-store";
import { cn } from "@/lib/utils";

/**
 * The operator console's home.
 *
 * Structured as the three questions someone running a live session actually
 * asks, in that order: what is happening right now (the round strip), what
 * needs me (the attention list), and how is the cohort doing (standings and
 * submissions). The raw inventory counts that used to lead the page are gone —
 * "Users: 4" is a fact, not an answer, and it was the first thing you saw.
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { simulationId, simulationName } = useScope();
  const typeId = useActiveSimulationTypeId();

  const sims = useSimulations();
  const users = useUsers();
  const teams = useTeams(simulationId ?? undefined);
  const rounds = useRounds(simulationId ?? undefined);
  const products = useProducts();
  const baseData = useBaseData();
  const storage = useStorageStatus();
  const config = usePlayerConfig(typeId ?? undefined);

  // `?? []` allocates a fresh array whenever the query is still loading, which
  // invalidates every useMemo below it on every render — the memos were doing
  // nothing. Memoising the fallback gives them a stable identity to key on.
  const roundList: any[] = React.useMemo(() => rounds.data ?? [], [rounds.data]);
  const teamList: any[] = React.useMemo(() => teams.data ?? [], [teams.data]);

  const sorted = React.useMemo(
    () => [...roundList].sort((a, b) => b.roundNumber - a.roundNumber),
    [roundList]
  );
  const activeRound = sorted.find((r) => r.status === "Active");
  const nextPending = [...roundList]
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .find((r) => r.status === "Pending");
  const completed = sorted.filter((r) => r.status === "Completed");
  const lastScored = completed[0];

  const decisions = useDecisions(
    simulationId ?? undefined,
    activeRound?.roundNumber ?? nextPending?.roundNumber
  );
  const results = useResults(simulationId ?? undefined);

  const endRound = useEndRound();
  const setStatus = useUpdateRoundStatus();
  const [confirmEnd, setConfirmEnd] = React.useState(false);

  // ── Derived ───────────────────────────────────────────────────────────
  const decisionList: any[] = React.useMemo(() => decisions.data ?? [], [decisions.data]);
  const resultList: any[] = React.useMemo(() => results.data ?? [], [results.data]);

  const sub = React.useMemo(
    () => submissionState(activeRound, teamList, decisionList),
    [activeRound, teamList, decisionList]
  );

  // A team with no role:"team" user has no pass key and cannot sign in at all.
  const teamsWithoutLogin = React.useMemo(() => {
    const raw = users.data as any;
    const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
    const withLogin = new Set(
      list.filter((u) => u.role === "team" && u.teamId).map((u) => String(u.teamId))
    );
    return teamList.filter((t) => !withLogin.has(String(t._id))).length;
  }, [users.data, teamList]);

  const attention = React.useMemo(
    () =>
      buildAttention({
        simulationId,
        rounds: roundList,
        teams: teamList,
        decisions: decisionList,
        teamsWithoutLogin,
        playerConfig: (config.data as any) ?? null,
        storage: (storage.data as any) ?? null,
        products: products.data ?? [],
        baseDataMissing: !baseData.isLoading && !baseData.data,
      }),
    [
      simulationId, roundList, teamList, decisionList, teamsWithoutLogin,
      config.data, storage.data, products.data, baseData.isLoading, baseData.data,
    ]
  );

  const currentStandings = React.useMemo(
    () => standings(resultList, teamList, lastScored?.roundNumber),
    [resultList, teamList, lastScored]
  );
  const previousStandings = React.useMemo(
    () => (completed[1] ? standings(resultList, teamList, completed[1].roundNumber) : undefined),
    [resultList, teamList, completed]
  );

  const busy = endRound.isPending || setStatus.isPending;

  // ── Actions ───────────────────────────────────────────────────────────
  const doEnd = () => {
    if (!activeRound) return;
    endRound.mutate(
      { roundId: activeRound._id },
      {
        onSuccess: () => {
          setConfirmEnd(false);
          toast.success(`Round ${activeRound.roundNumber} scored`);
        },
        onError: (e: any) =>
          toast.error(e?.response?.data?.message ?? "Couldn't end the round"),
      }
    );
  };

  const doActivate = () => {
    const target = nextPending;
    if (!target) {
      toast.error("No pending round to open — create one first.");
      navigate("/rounds");
      return;
    }
    setStatus.mutate({ id: target._id, status: "Active", timer: { durationMinutes: 25 } });
  };

  // ── Empty state ───────────────────────────────────────────────────────
  if (!sims.isLoading && (sims.data ?? []).length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Run a session and see how the cohort is doing." />
        <Card padded={false}>
          <EmptyState
            icon={<MonitorPlay />}
            title="No simulations yet"
            hint="A simulation holds the teams and the rounds. Create one to get started."
            action={<Button onClick={() => navigate("/simulations")}>Create a simulation</Button>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          simulationName
            ? `Running “${simulationName}” · ${teamList.length} teams`
            : "Pick a simulation from the top bar to begin."
        }
      />

      {/* 1 ── What is happening right now */}
      {rounds.isLoading ? (
        <Skeleton className="h-[132px] rounded-xl" />
      ) : (
        <LiveRoundStrip
          round={activeRound ?? nextPending}
          totalRounds={roundList.length}
          teamCount={teamList.length}
          submittedCount={sub.submitted.length}
          busy={busy}
          onEnd={() => setConfirmEnd(true)}
          onActivate={doActivate}
        />
      )}

      {/* 2 ── What needs me */}
      <section className="mt-6">
        <h2 className="eyebrow mb-2.5 block text-muted-foreground">Needs your attention</h2>
        <AttentionList
          items={attention}
          busy={busy}
          onEndRound={() => setConfirmEnd(true)}
          onActivateRound={doActivate}
        />
      </section>

      {/* 3 ── How is the cohort doing */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Standings"
            subtitle={lastScored ? `After round ${lastScored.roundNumber}` : "No round scored yet"}
            action={<CardArrow label="Open results" onClick={() => navigate("/results")} />}
          />
          <div className="mt-3">
            <StandingsTable rows={currentStandings} previous={previousStandings} max={8} />
          </div>
          {currentStandings.length > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-4 text-muted-foreground">
              <span className="font-semibold text-foreground">Strength</span> ranks teams against
              each other. It is not a share of the market — the engine scales each team's competed
              share by the share that team declared, so these do not sum to 100%.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Submissions"
            subtitle={
              activeRound
                ? `Round ${activeRound.roundNumber} · ${sub.submitted.length} of ${teamList.length} in`
                : "No round is open"
            }
            action={<CardArrow label="Open decisions" onClick={() => navigate("/decisions")} />}
          />
          {teamList.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No teams in this simulation yet.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {/* Missing first — the gaps are the actionable part. */}
              {[...sub.missing, ...sub.submitted].map((t) => {
                const isIn = !sub.missing.includes(t);
                return (
                  <span
                    key={t._id}
                    title={isIn ? "Submitted" : "Not submitted yet"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium",
                      isIn
                        ? "border-success/25 bg-success-tint text-success"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {isIn ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
                    {t.teamName}
                  </span>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 4 ── Session shape */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Rounds" subtitle="Progress through the session" />
          <ol className="mt-3 space-y-1.5">
            {[...roundList]
              .sort((a, b) => a.roundNumber - b.roundNumber)
              .map((r) => (
                <li key={r._id} className="flex items-center gap-3 text-[13px]">
                  <span className="w-16 shrink-0 font-medium text-muted-foreground">
                    Round {r.roundNumber}
                  </span>
                  <Badge
                    tone={r.status === "Completed" ? "success" : r.status === "Active" ? "brand" : "outline"}
                    size="sm"
                  >
                    {r.status}
                  </Badge>
                </li>
              ))}
            {roundList.length === 0 && (
              <li className="py-4 text-[13px] text-muted-foreground">No rounds created yet.</li>
            )}
          </ol>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Simulations"
            subtitle="Every cohort on the platform"
            action={<CardArrow label="Open simulations" onClick={() => navigate("/simulations")} />}
          />
          <ul className="mt-3 space-y-1">
            {(sims.data ?? []).slice(0, 5).map((s: any) => (
              <li key={s._id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
                {/* A simulation is not a person: initials in an avatar circle
                    beside real generated faces read as a broken image. */}
                <IconTile icon={<MonitorPlay />} tone="brand" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
                  {s.simulationName}
                </span>
                {s._id === simulationId && (
                  <Badge tone="brand" size="sm">
                    Current
                  </Badge>
                )}
                <Badge tone={s.status === "Active" ? "success" : "outline"} size="sm">
                  {s.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={`End round ${activeRound?.roundNumber}?`}
        description={
          <>
            Every team is scored against the others and their results are published.
            {sub.missing.length > 0 && (
              <>
                <br />
                <br />
                <span className="font-semibold text-warning">
                  {sub.missing.length} team{sub.missing.length === 1 ? "" : "s"} have not submitted
                </span>{" "}
                ({sub.missing.map((t) => t.teamName).join(", ")}). They are scored on whatever the
                engine reads as their inputs.
              </>
            )}
          </>
        }
        confirmLabel="End round"
        loading={endRound.isPending}
        onConfirm={doEnd}
      />
    </>
  );
}
