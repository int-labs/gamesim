import type { ColumnDef } from "@tanstack/react-table";
import NumberFlow from "@number-flow/react";
import { Calculator, Trophy } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";
import { ProgressLinear, ScoreBar } from "@/components/app/bits";
import { Card } from "@/components/app/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ScopeGuard } from "@/components/app/scope-guard";
import { NotesList, useRoundNotes } from "@/features/notes/round-notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Avatar } from "@/components/ui/primitives";
import { useCalculateRound, useResults, useRounds, useTeams } from "@/lib/api-hooks";
import { percent } from "@/lib/format";
import { SPRING } from "@/lib/motion";
import { useScope } from "@/lib/scope-store";

const MEDAL = ["bg-yellow-500 text-signal-ink", "bg-neutral-tint text-neutral", "bg-warning-tint text-warning"];

function ResultsInner() {
  const { simulationId } = useScope();
  const { data: rounds = [] } = useRounds(simulationId ?? undefined);
  const { data: teams = [] } = useTeams(simulationId ?? undefined);
  const calculate = useCalculateRound();

  const [round, setRound] = React.useState<string>("");
  const [confirmCalc, setConfirmCalc] = React.useState(false);

  React.useEffect(() => {
    if (round || rounds.length === 0) return;
    const sorted = [...rounds].sort((a: any, b: any) => b.roundNumber - a.roundNumber);
    setRound(String((sorted.find((r: any) => r.status === "Completed") ?? sorted[0]).roundNumber));
  }, [rounds, round]);

  const roundNumber = round ? Number(round) : undefined;
  const { data = [], isLoading, isError, refetch } = useResults(simulationId ?? undefined, roundNumber);
  const roundDoc = rounds.find((r: any) => r.roundNumber === roundNumber);
  const notes = useRoundNotes(simulationId ?? undefined, roundNumber);

  const teamName = React.useCallback(
    (id: string) => teams.find((t: any) => t._id === id)?.teamName ?? "Unknown team",
    [teams]
  );

  const teamAvatar = React.useCallback(
    (id: string) => teams.find((t: any) => t._id === id)?.avatar?.url ?? null,
    [teams]
  );

  /** Results are per product×segment; aggregate to a per-team leaderboard. */
  const leaderboard = React.useMemo(() => {
    const acc = new Map<string, { teamId: string; score: number; share: number; n: number }>();
    for (const doc of data as any[]) {
      for (const [teamId, score] of Object.entries(doc.weightedScores ?? {})) {
        const e = acc.get(teamId) ?? { teamId, score: 0, share: 0, n: 0 };
        e.score += Number(score) || 0;
        acc.set(teamId, e);
      }
      for (const [teamId, share] of Object.entries(doc.marketShares ?? {})) {
        const e = acc.get(teamId) ?? { teamId, score: 0, share: 0, n: 0 };
        e.share += Number(share) || 0;
        e.n += 1;
        acc.set(teamId, e);
      }
    }
    return [...acc.values()]
      .map((e) => ({
        _id: e.teamId,
        teamId: e.teamId,
        teamName: teamName(e.teamId),
        avatarUrl: teamAvatar(e.teamId),
        score: e.score,
        marketShare: e.n > 0 ? e.share / e.n : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [data, teamName, teamAvatar]);

  const runCalculation = () => {
    if (!roundDoc) return;
    toast.promise(calculate.mutateAsync(roundDoc._id), {
      loading: `Calculating round ${roundNumber}…`,
      success: `Round ${roundNumber} calculated`,
      error: (e: any) => e?.response?.data?.message ?? "Calculation failed",
    });
    setConfirmCalc(false);
  };

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "Rank",
        size: 80,
        cell: ({ row }) => (
          <span
            className={`inline-flex size-7 items-center justify-center rounded-full text-[13px] font-bold tnum ${
              row.original.rank <= 3 ? MEDAL[row.original.rank - 1] : "bg-muted text-muted-foreground"
            }`}
          >
            {row.original.rank}
          </span>
        ),
      },
      {
        accessorKey: "teamName",
        header: "Team",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.original.teamName} src={row.original.avatarUrl} size="lg" />
            <span className="text-[14px] font-semibold text-foreground">{row.original.teamName}</span>
          </div>
        ),
      },
      {
        accessorKey: "score",
        header: "Weighted score",
        size: 200,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="w-14 text-[13px] font-semibold tnum text-foreground">
              {row.original.score.toFixed(2)}
            </span>
            <ScoreBar value={row.original.score} showLabel={false} />
          </div>
        ),
      },
      {
        accessorKey: "marketShare",
        // "Strength", NOT "Market share". calcMarketModel computes a properly
        // competed share and then multiplies it by each team's OWN declared
        // projected_market_share, so the values rank teams correctly but are
        // NOT a partition of the market — twelve teams declaring 1/12 each sum
        // to ~175%. Labelling it a share is the one thing that must not happen
        // here, because an operator reads this column out to a room.
        header: "Strength",
        size: 190,
        cell: ({ row }) => (
          <div className="w-36">
            <div className="mb-1 text-[13px] font-semibold tnum text-foreground">
              {percent(row.original.marketShare)}
            </div>
            <ProgressLinear thin value={row.original.marketShare * 100} tone="primary" />
          </div>
        ),
      },
    ],
    []
  );

  const podium = leaderboard.slice(0, 3);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-[190px]">
          <Select value={round} onValueChange={setRound}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Pick a round" />
            </SelectTrigger>
            <SelectContent>
              {[...rounds]
                .sort((a: any, b: any) => a.roundNumber - b.roundNumber)
                .map((r: any) => (
                  <SelectItem key={r._id} value={String(r.roundNumber)}>
                    Round {r.roundNumber} · {r.status}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Badge tone="count">{data.length} product results</Badge>
        <div className="ml-auto">
          <Button
            variant="outline"
            disabled={!roundDoc || roundDoc.status !== "Active"}
            onClick={() => setConfirmCalc(true)}
          >
            <Calculator /> Recalculate round
          </Button>
        </div>
      </div>

      {podium.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {podium.map((t, i) => (
            <motion.div
              key={t.teamId}
              layout
              transition={SPRING.smooth}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card hero={i === 0} className="min-h-[140px]">
                <div className="flex items-start justify-between">
                  <span
                    className={`inline-flex size-8 items-center justify-center rounded-full text-[14px] font-bold tnum ${MEDAL[i]}`}
                  >
                    {i + 1}
                  </span>
                  <Avatar name={t.teamName} src={t.avatarUrl} size="lg" />
                </div>
                <div className="mt-4">
                  <div
                    className={`truncate text-[13px] font-medium ${i === 0 ? "text-hero-muted" : "text-muted-foreground"}`}
                  >
                    {t.teamName}
                  </div>
                  <div
                    className={`font-display text-[32px] font-semibold leading-none tracking-tight tnum ${
                      i === 0 ? "text-hero-fg" : "text-foreground"
                    }`}
                  >
                    <NumberFlow value={Number(t.score.toFixed(2))} />
                  </div>
                  <div className={`mt-2 text-[12px] ${i === 0 ? "text-hero-muted" : "text-muted-foreground"}`}>
                    {percent(t.marketShare)} strength
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Explains the column name where an operator actually reads it. */}
      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        <strong>Strength</strong> ranks teams against each other; it is not a share of
        the market and the column does not sum to 100%. Each team&rsquo;s competed
        score is scaled by the market share it declared, so a full cohort can total
        well above 100%.
      </p>

      <DataTable
        columns={columns}
        data={leaderboard}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search teams…"
        empty={
          <EmptyState
            icon={<Trophy />}
            title={`No results for round ${round || "—"} yet`}
            hint="Results appear once an operator calculates the round from the Rounds page."
          />
        }
      />

      {(notes.data ?? []).length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-[17px] font-semibold text-foreground">
            Facilitator notes
          </h2>
          <NotesList
            notes={notes.data ?? []}
            teamName={(id) => teams.find((t: any) => t._id === id)?.teamName ?? "One team"}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmCalc}
        onOpenChange={setConfirmCalc}
        title={`Recalculate round ${roundNumber}?`}
        description="This re-runs the competitive market model for every team and overwrites the stored results and projections for this round."
        confirmLabel="Recalculate"
        onConfirm={runCalculation}
      />
    </>
  );
}

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        title="Results"
        subtitle="The authoritative leaderboard — weighted scores and competitive strength per round."
      />
      <ScopeGuard>
        <ResultsInner />
      </ScopeGuard>
    </>
  );
}
