import type { ColumnDef } from "@tanstack/react-table";
import {
  Calculator,
  IterationCw,
  MoreHorizontal,
  NotebookPen,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ProgressLinear, RoundStatusChip } from "@/components/app/bits";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ScopeGuard } from "@/components/app/scope-guard";
import { RoundNotesDialog } from "@/features/notes/round-notes";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Label } from "@/components/ui/primitives";
import {
  useCalculateRound,
  useCreateRound,
  useDecisions,
  useDeleteRound,
  useEndRound,
  useRounds,
  useTeams,
  useUpdateRoundStatus,
} from "@/lib/api-hooks";
import { absoluteTime, duration, relativeTime } from "@/lib/format";
import { useScope } from "@/lib/scope-store";

function CreateRoundDialog({
  open,
  onOpenChange,
  simulationId,
  nextNumber,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  simulationId: string;
  nextNumber: number;
}) {
  const create = useCreateRound();
  const [roundNumber, setRoundNumber] = React.useState(nextNumber);
  const [minutes, setMinutes] = React.useState(120);

  React.useEffect(() => {
    if (open) {
      setRoundNumber(nextNumber);
      setMinutes(120);
    }
  }, [open, nextNumber]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="max-w-[440px]">
        <DialogTitle>Create round</DialogTitle>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          New rounds start as <strong>Pending</strong>. Start them when teams are ready.
        </p>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="round-number">Round number</Label>
            <Input
              id="round-number"
              type="number"
              min={1}
              className="tnum"
              value={roundNumber}
              onChange={(e) => setRoundNumber(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="round-duration">Duration (minutes)</Label>
            <Input
              id="round-duration"
              type="number"
              min={1}
              className="tnum"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
            <p className="text-[12px] text-muted-foreground">
              The countdown starts when you start the round — {duration(minutes)}.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            onClick={() =>
              create.mutate(
                {
                  simulationId,
                  roundNumber,
                  status: "Pending",
                  timer: { durationMinutes: minutes },
                },
                { onSuccess: () => onOpenChange(false) }
              )
            }
          >
            Create round
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoundsTable() {
  const { simulationId } = useScope();
  const { data: rounds = [], isLoading, isError, refetch } = useRounds(simulationId ?? undefined);
  const { data: teams = [] } = useTeams(simulationId ?? undefined);

  const updateStatus = useUpdateRoundStatus();
  const calculate = useCalculateRound();
  const endRound = useEndRound();
  const del = useDeleteRound();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<any>(null);
  const [pendingCalc, setPendingCalc] = React.useState<any>(null);
  const [pendingEnd, setPendingEnd] = React.useState<any>(null);
  const [notesRound, setNotesRound] = React.useState<any>(null);

  const nextNumber =
    rounds.reduce((max: number, r: any) => Math.max(max, r.roundNumber ?? 0), 0) + 1;

  // Referenced from inside the columns memo, so it needs a stable identity —
  // otherwise the whole column definition rebuilds on every render.
  const startRound = React.useCallback(
    (round: any) =>
      updateStatus.mutate({
        id: round._id,
        status: "Active",
        timer: { durationMinutes: round.timer?.durationMinutes ?? 120 },
      }),
    [updateStatus]
  );

  const runCalculation = (round: any) => {
    toast.promise(calculate.mutateAsync(round._id), {
      loading: `Calculating round ${round.roundNumber}…`,
      success: `Round ${round.roundNumber} calculated — results and projections written`,
      error: (e: any) => e?.response?.data?.message ?? "Calculation failed",
    });
    setPendingCalc(null);
  };

  const runEndRound = (round: any) => {
    toast.promise(endRound.mutateAsync({ roundId: round._id }), {
      loading: `Ending round ${round.roundNumber}…`,
      success: (res: any) => {
        const d = res?.data ?? {};
        return d.isLastRound
          ? `Round ${round.roundNumber} ended — simulation complete`
          : `Round ${round.roundNumber} ended — ${d.resultsWritten ?? 0} results written`;
      },
      error: (e: any) => e?.response?.data?.message ?? "Couldn't end the round",
    });
    setPendingEnd(null);
  };

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "roundNumber",
        header: "Round",
        size: 100,
        cell: ({ row }) => (
          <span className="font-display text-[18px] font-semibold tnum text-foreground">
            {row.original.roundNumber}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 130,
        cell: ({ row }) => <RoundStatusChip status={row.original.status} />,
      },
      {
        id: "window",
        header: "Window",
        size: 220,
        cell: ({ row }) => {
          const t = row.original.timer;
          if (!t?.startDate)
            return <span className="text-[13px] text-muted-foreground">Not started</span>;
          return (
            <div className="text-[13px] leading-4">
              <div className="text-body">{absoluteTime(t.startDate)}</div>
              <div className="text-[12px] text-muted-foreground">
                ends {relativeTime(t.endDate)}
              </div>
            </div>
          );
        },
      },
      {
        id: "duration",
        header: "Duration",
        size: 110,
        accessorFn: (r) => r.timer?.durationMinutes ?? 0,
        cell: ({ row }) => (
          <span className="text-[13px] tnum text-body">
            {duration(row.original.timer?.durationMinutes)}
          </span>
        ),
      },
      {
        id: "submissions",
        header: "Submissions",
        size: 160,
        cell: ({ row }) => <SubmissionCell roundNumber={row.original.roundNumber} teams={teams.length} />,
      },
      {
        id: "actions",
        header: "",
        size: 56,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label="Round actions" size="sm">
                    <MoreHorizontal />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setNotesRound(r)}>
                    <NotebookPen /> Notes
                  </DropdownMenuItem>
                  {r.status === "Pending" && (
                    <DropdownMenuItem onSelect={() => startRound(r)}>
                      <Play /> Start round
                    </DropdownMenuItem>
                  )}
                  {r.status === "Active" && (
                    <>
                      {/* One action, one transaction. Closing and calculating
                          used to be separate items — and closing first left the
                          round permanently uncalculable. */}
                      <DropdownMenuItem onSelect={() => setPendingEnd(r)}>
                        <Square /> End round
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setPendingCalc(r)}>
                        <Calculator /> Recalculate (keep open)
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setPendingDelete(r)}>
                    <Trash2 /> Delete round
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [teams.length, startRound]
  );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button shape="pill" onClick={() => setCreateOpen(true)}>
          <Plus /> Create round
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rounds}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search rounds…"
        groupBy="status"
        groupLabel={(k) => <span>{k}</span>}
        initialSorting={[{ id: "roundNumber", desc: false }]}
        empty={
          <EmptyState
            icon={<IterationCw />}
            title="No rounds yet"
            hint="Create round 1 to open the simulation for team decisions."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Create round
              </Button>
            }
          />
        }
      />

      <RoundNotesDialog
        open={!!notesRound}
        onOpenChange={(v) => !v && setNotesRound(null)}
        simulationId={simulationId ?? undefined}
        roundNumber={notesRound?.roundNumber}
        teams={teams as any}
      />

      {simulationId && (
        <CreateRoundDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          simulationId={simulationId}
          nextNumber={nextNumber}
        />
      )}

      <ConfirmDialog
        open={!!pendingCalc}
        onOpenChange={(v) => !v && setPendingCalc(null)}
        title={`Recalculate round ${pendingCalc?.roundNumber}?`}
        description="Re-runs the market model and overwrites this round's results, leaving the round open for further submissions."
        confirmLabel="Recalculate"
        onConfirm={() => runCalculation(pendingCalc)}
      />

      <ConfirmDialog
        open={!!pendingEnd}
        onOpenChange={(v) => !v && setPendingEnd(null)}
        title={`End round ${pendingEnd?.roundNumber}?`}
        description="Closes the round to submissions, calculates every team's results and financials, and advances the simulation — all in one step. If the calculation fails, nothing changes."
        confirmLabel="End round"
        onConfirm={() => runEndRound(pendingEnd)}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete round ${pendingDelete?.roundNumber}?`}
        description="Teams lose their submissions for this round and will need to resubmit."
        confirmLabel="Delete round"
        loading={del.isPending}
        onConfirm={() => del.mutate(pendingDelete._id, { onSuccess: () => setPendingDelete(null) })}
      />
    </>
  );
}

function SubmissionCell({ roundNumber, teams }: { roundNumber: number; teams: number }) {
  const { simulationId } = useScope();
  const { data: decisions = [] } = useDecisions(simulationId ?? undefined, roundNumber);
  const submitted = new Set(decisions.map((d: any) => String(d.teamId))).size;

  return (
    <div className="w-32">
      <div className="mb-1 text-[12px] font-semibold tnum text-foreground">
        {submitted}
        <span className="text-muted-foreground"> / {teams}</span>
      </div>
      <ProgressLinear thin value={submitted} total={Math.max(teams, 1)} tone="success" />
    </div>
  );
}

export default function RoundsPage() {
  const { simulationName } = useScope();
  return (
    <>
      <PageHeader
        title="Rounds"
        subtitle={
          simulationName
            ? `Decision windows for ${simulationName}. Starting a round opens it for team submissions.`
            : "Decision windows for the active simulation."
        }
      />
      <ScopeGuard>
        <RoundsTable />
      </ScopeGuard>
    </>
  );
}
