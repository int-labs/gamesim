import type { ColumnDef } from "@tanstack/react-table";
import { Copy, KeyRound, MoreHorizontal, Pencil, Plus, Trash2, Users, UsersRound } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { CopyChip, EntityCell, ProgressLinear, ScoreBar } from "@/components/app/bits";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { PasskeyCell } from "@/components/app/passkey-cell";
import { MemberStack, RosterDialog } from "@/features/teams/roster";
import { ResourceFormDialog, type FormField } from "@/components/app/resource-form";
import { ScopeGuard } from "@/components/app/scope-guard";
import { StatCard } from "@/components/app/stat-card";
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
import { Avatar, Label } from "@/components/ui/primitives";
import {
  useCreateTeam,
  useDeleteTeam,
  teamCrud,
  useIssueTeamPasskey,
  useTeams,
  useUsers,
} from "@/lib/api-hooks";
import { percent, relativeTime } from "@/lib/format";
import { useScope } from "@/lib/scope-store";

/** Shown right after creation — the pass key is the one thing the operator
 *  must actually carry away, so it is revealed once, in full, and copyable. */
function PasskeyIssuedDialog({
  result,
  onClose,
}: {
  result: { teamName: string; passkey?: string | null } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!result} onOpenChange={(v) => !v && onClose()}>
      <DialogContent width="max-w-[440px]">
        <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-accent">
          <KeyRound className="size-5 text-accent-foreground" />
        </div>
        <DialogTitle>{result?.teamName} is ready</DialogTitle>
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
          Share this pass key with the team — they enter it in the player app to join. You can find
          it again on this page at any time.
        </p>

        {result?.passkey ? (
          <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-muted p-3">
            <code className="flex-1 font-mono text-[16px] font-semibold text-foreground">
              {result.passkey}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(result.passkey!);
                toast.success("Pass key copied");
              }}
            >
              <Copy /> Copy
            </Button>
          </div>
        ) : (
          <div className="mt-5 rounded-md bg-warning-tint p-3 text-[13px] text-warning">
            The team was created but no pass key could be issued. Use “Issue pass key” on its row
            before the round opens.
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTeamDialog({
  open,
  onOpenChange,
  simulationId,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  simulationId: string;
  onIssued: (r: { teamName: string; passkey?: string | null }) => void;
}) {
  const create = useCreateTeam();
  const [teamName, setTeamName] = React.useState("");
  const [teamLeader, setTeamLeader] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTeamName("");
      setTeamLeader("");
      setError("");
    }
  }, [open]);

  const submit = () => {
    if (!teamName.trim()) return setError("Team name is required");
    create.mutate(
      { simulationId, teamName: teamName.trim(), teamLeader: teamLeader.trim() || undefined },
      {
        onSuccess: (res) => {
          onOpenChange(false);
          onIssued({ teamName: res.team.teamName, passkey: res.user?.passkey });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="max-w-[440px]">
        <DialogTitle>Create team</DialogTitle>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          A pass key is generated automatically so the team can sign in to the player app.
        </p>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={teamName}
              error={!!error}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team Alpha"
            />
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-leader">Team leader (optional)</Label>
            <Input
              id="team-leader"
              value={teamLeader}
              onChange={(e) => setTeamLeader(e.target.value)}
              placeholder="Alpha Leader"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TEAM_FIELDS: FormField[] = [
  {
    key: "teamName",
    label: "Team name",
    required: true,
    help: "What players see on the leaderboard and what the facilitator calls them in the room.",
  },
  {
    key: "teamLeader",
    label: "Team lead",
    help: "Who speaks for the team. Optional, and separate from the roster.",
  },
];

function TeamsTable() {
  const { simulationId } = useScope();
  const { data = [], isLoading, isError, refetch } = useTeams(simulationId ?? undefined);
  const { data: users = [] } = useUsers();
  const del = useDeleteTeam();
  const [editTeam, setEditTeam] = React.useState<any>(null);
  const renameTeam = teamCrud.useUpdate();
  const issue = useIssueTeamPasskey();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<any>(null);
  const [rosterTeam, setRosterTeam] = React.useState<any>(null);
  const [issued, setIssued] = React.useState<{ teamName: string; passkey?: string | null } | null>(
    null
  );

  /** A team's credential is the role:"team" user pointing at it. */
  const passkeyFor = React.useCallback(
    (teamId: string) =>
      users.find((u: any) => u.role === "team" && String(u.teamId) === String(teamId))?.passkey ??
      null,
    [users]
  );

  const withoutLogin = data.filter((t: any) => !passkeyFor(t._id)).length;

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "teamName",
        header: "Team",
        cell: ({ row }) => (
          <EntityCell
            leading={
              row.original.avatar?.url ? (
                <img
                  src={row.original.avatar.url}
                  alt={row.original.teamName}
                  className="size-9 shrink-0 rounded-full bg-muted object-cover"
                />
              ) : (
                <Avatar name={row.original.teamName} src={row.original.avatar?.url} size="lg" />
              )
            }
            primary={row.original.teamName}
            secondary={row.original.teamLeader ?? <CopyChip value={row.original._id} />}
          />
        ),
      },
      {
        id: "passkey",
        header: "Pass key",
        size: 180,
        enableSorting: false,
        accessorFn: (r) => passkeyFor(r._id) ?? "",
        cell: ({ row }) => <PasskeyCell passkey={passkeyFor(row.original._id)} />,
      },
      {
        id: "members",
        header: "Members",
        size: 150,
        enableSorting: false,
        cell: ({ row }) => <MemberStack members={row.original.members} />,
      },
      {
        accessorKey: "score",
        header: "Score",
        size: 160,
        cell: ({ row }) => <ScoreBar value={(row.original.score ?? 0) / 10} />,
      },
      {
        accessorKey: "marketShare",
        header: "Market share",
        size: 170,
        cell: ({ row }) => {
          const ms = row.original.marketShare ?? 0;
          return (
            <div className="w-32">
              <div className="mb-1 text-[13px] font-semibold tnum text-foreground">{percent(ms)}</div>
              <ProgressLinear thin value={ms <= 1 ? ms * 100 : ms} tone="primary" />
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        size: 120,
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 56,
        enableSorting: false,
        cell: ({ row }) => {
          const hasKey = !!passkeyFor(row.original._id);
          return (
            <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label="Team actions" size="sm">
                    <MoreHorizontal />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditTeam(row.original)}>
                    <Pencil /> Rename team
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRosterTeam(row.original)}>
                    <UsersRound /> Edit roster & avatars
                  </DropdownMenuItem>
                  {!hasKey && (
                    <DropdownMenuItem
                      onSelect={() =>
                        issue.mutate(row.original._id, {
                          onSuccess: (res: any) =>
                            setIssued({
                              teamName: row.original.teamName,
                              passkey: res?.data?.passkey,
                            }),
                        })
                      }
                    >
                      <KeyRound /> Issue pass key
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setPendingDelete(row.original)}>
                    <Trash2 /> Delete team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [passkeyFor, issue]
  );

  const avgScore = data.length
    ? data.reduce((a: number, t: any) => a + (t.score ?? 0), 0) / data.length
    : 0;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard compact label="Teams" value={data.length} />
        <StatCard compact label="Average score" value={Math.round(avgScore)} />
        <StatCard
          compact
          label="Without a pass key"
          value={withoutLogin}
          footnote={withoutLogin > 0 ? "these teams can't sign in" : "every team can sign in"}
        />
      </div>

      <div className="mb-4 flex justify-end">
        <Button shape="pill" onClick={() => setCreateOpen(true)}>
          <Plus /> Create team
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search teams…"
        initialSorting={[{ id: "score", desc: true }]}
        empty={
          <EmptyState
            icon={<Users />}
            title="No teams yet"
            hint="Each team gets a pass key so it can sign in to the player app and submit decisions."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Create team
              </Button>
            }
          />
        }
      />

      {simulationId && (
        <CreateTeamDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          simulationId={simulationId}
          onIssued={setIssued}
        />
      )}

      <ResourceFormDialog
        open={!!editTeam}
        onOpenChange={(v) => !v && setEditTeam(null)}
        title={`Rename ${editTeam?.teamName ?? "team"}`}
        description="The pass key and everything the team has already submitted are unaffected."
        fields={TEAM_FIELDS}
        initial={editTeam}
        submitting={renameTeam.isPending}
        onSubmit={(values) =>
          renameTeam.mutate(
            { id: editTeam._id, data: values },
            { onSuccess: () => setEditTeam(null) }
          )
        }
      />

      <RosterDialog
        team={rosterTeam}
        open={!!rosterTeam}
        onOpenChange={(v) => !v && setRosterTeam(null)}
      />

      <PasskeyIssuedDialog result={issued} onClose={() => setIssued(null)} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.teamName}?`}
        description="Their decisions and results stay in the database, but the team immediately loses access to the player app."
        confirmLabel="Delete team"
        loading={del.isPending}
        onConfirm={() => del.mutate(pendingDelete._id, { onSuccess: () => setPendingDelete(null) })}
      />
    </>
  );
}

export default function TeamsPage() {
  const { simulationName } = useScope();
  return (
    <>
      <PageHeader
        title="Teams"
        subtitle={
          simulationName
            ? `The competitors in ${simulationName}. Each team signs in with its own pass key; scores and share come from the round calculation.`
            : "The competitors in the active simulation."
        }
      />
      <ScopeGuard>
        <TeamsTable />
      </ScopeGuard>
    </>
  );
}
