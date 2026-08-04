import type { ColumnDef } from "@tanstack/react-table";
import { GitBranch, Trash2 } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EntityCell, IconTile, ProgressLinear } from "@/components/app/bits";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { ScopeGuard } from "@/components/app/scope-guard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Avatar } from "@/components/ui/primitives";
import { useDecisions, useDeleteDecisionsByRound, useRounds, useTeams } from "@/lib/api-hooks";
import { relativeTime } from "@/lib/format";
import { useScope } from "@/lib/scope-store";

/**
 * Decisions written before the `inputs[].fields` flattening fix are stored
 * doubly-nested and are unreadable by both calculators. Detect and label them
 * rather than crashing (spec §20 pitfall 14).
 */
function isLegacyShape(input: any): boolean {
  const fields = input?.fields;
  if (!Array.isArray(fields) || fields.length === 0) return false;
  return Array.isArray(fields[0]);
}

function DecisionsTable() {
  const { simulationId } = useScope();
  const { data: rounds = [] } = useRounds(simulationId ?? undefined);
  const { data: teams = [] } = useTeams(simulationId ?? undefined);

  const [round, setRound] = React.useState<string>("");

  // Default to the highest Active round, else the highest-numbered.
  React.useEffect(() => {
    if (round || rounds.length === 0) return;
    const sorted = [...rounds].sort((a: any, b: any) => b.roundNumber - a.roundNumber);
    const active = sorted.find((r: any) => r.status === "Active") ?? sorted[0];
    if (active) setRound(String(active.roundNumber));
  }, [rounds, round]);

  const roundNumber = round ? Number(round) : undefined;
  const { data = [], isLoading, isError, refetch } = useDecisions(simulationId ?? undefined, roundNumber);
  const delByRound = useDeleteDecisionsByRound();
  const [confirmClear, setConfirmClear] = React.useState(false);

  const teamName = React.useCallback(
    (id: string) => teams.find((t: any) => t._id === id)?.teamName ?? "Unknown team",
    [teams]
  );

  // One row per product decision, flattened out of each team's document.
  const rows = React.useMemo(
    () =>
      data.flatMap((d: any) =>
        (d.inputs ?? []).map((input: any, i: number) => ({
          _id: `${d._id}-${i}`,
          teamId: d.teamId,
          teamName: teamName(String(d.teamId)),
          productName: input.productName ?? "Unnamed product",
          fieldCount: Array.isArray(input.fields) ? input.fields.length : 0,
          globalInputs: (d.globalInputs ?? []).length,
          legacy: isLegacyShape(input),
          submittedAt: d.createdAt,
        }))
      ),
    [data, teamName]
  );

  const submittedTeams = new Set(data.map((d: any) => String(d.teamId))).size;

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Product decision",
        cell: ({ row }) => (
          <EntityCell
            leading={<IconTile icon={<GitBranch />} tone="brand" />}
            primary={row.original.productName}
            secondary={row.original.legacy ? undefined : `${row.original.fieldCount} fields submitted`}
            trailing={
              row.original.legacy ? (
                <Badge tone="danger" size="sm">
                  Legacy format
                </Badge>
              ) : undefined
            }
          />
        ),
      },
      {
        accessorKey: "teamName",
        header: "Team",
        size: 200,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.original.teamName} src={row.original.avatar?.url} size="md" />
            <span className="text-[13px] font-semibold text-foreground">{row.original.teamName}</span>
          </div>
        ),
      },
      {
        accessorKey: "globalInputs",
        header: "Global inputs",
        size: 140,
        cell: ({ row }) => <Badge tone="count">{row.original.globalInputs}</Badge>,
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">{relativeTime(row.original.submittedAt)}</span>
        ),
      },
    ],
    []
  );

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

        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="font-semibold tnum text-foreground">
            {submittedTeams}/{teams.length}
          </span>
          teams submitted
          <div className="w-24">
            <ProgressLinear
              thin
              value={submittedTeams}
              total={Math.max(teams.length, 1)}
              tone="success"
            />
          </div>
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive-tint"
            disabled={rows.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 /> Clear round decisions
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search decisions…"
        groupBy="teamName"
        empty={
          <EmptyState
            icon={<GitBranch />}
            title={`No decisions for round ${round || "—"} yet`}
            hint="Teams submit from the player app. Rows appear here the moment they do."
          />
        }
      />

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={`Clear all decisions for round ${round}?`}
        description={`This deletes every team's submission for round ${round}. They will need to resubmit from the player app. Use this to clear decisions stored in the old nested format.`}
        confirmText={`round ${round}`}
        confirmLabel="Delete decisions"
        loading={delByRound.isPending}
        onConfirm={async () => {
          if (!simulationId || roundNumber == null) return;
          // The dialog closes itself once this resolves.
          await delByRound.mutateAsync({ simulationId, roundNumber });
        }}
      />
    </>
  );
}

export default function DecisionsPage() {
  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle="What each team submitted this round — the raw input to the market model."
      />
      <ScopeGuard>
        <DecisionsTable />
      </ScopeGuard>
    </>
  );
}
