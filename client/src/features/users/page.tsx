import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, MoreHorizontal, RefreshCw, Trash2, UserRound } from "lucide-react";
import * as React from "react";
import { CopyChip, EntityCell, IconTile, RoleChip } from "@/components/app/bits";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { PasskeyCell } from "@/components/app/passkey-cell";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Avatar } from "@/components/ui/primitives";
import { useDeleteUser, useRegeneratePasskey, useSimulations, useTeams, useUsers } from "@/lib/api-hooks";
import { relativeTime } from "@/lib/format";

/**
 * Role semantics, per the definitions in the Stratagem user model:
 *   admin    — superadmin
 *   operator — Int Labs staff; manages simulations only
 *   client   — customer user; sees their own simulations
 *   team     — limited to playing a single simulation, signs in by pass key
 */
const ROLE_HINT: Record<string, string> = {
  admin: "Full access to every simulation and setting",
  operator: "Int Labs staff — runs simulations, can't change billing or roles",
  client: "Customer user — sees only their own simulations",
  team: "Plays one simulation, signs in with a pass key",
};

export default function UsersPage() {
  const { data: allUsers = [], isLoading, isError, refetch } = useUsers();

  /**
   * Staff only.
   *
   * A `role:"team"` user is not a person — it is the row that carries a team's
   * pass key, one per team, with no email and no password. Listing them here
   * meant 88 credential rows burying the 2 accounts that belong to actual
   * people. Team logins live on the Teams page, next to the team they open.
   */
  const data = React.useMemo(() => allUsers.filter((u: any) => u.role !== "team"), [allUsers]);
  const teamLoginCount = allUsers.length - data.length;
  const { data: teams = [] } = useTeams();
  const { data: sims = [] } = useSimulations();
  const del = useDeleteUser();
  const regen = useRegeneratePasskey();
  const [pendingDelete, setPendingDelete] = React.useState<any>(null);

  const teamName = React.useCallback(
    (id?: string) => teams.find((t: any) => t._id === id)?.teamName,
    [teams]
  );
  const simName = React.useCallback(
    (id?: string) => sims.find((s: any) => s._id === id)?.simulationName,
    [sims]
  );

  const columns = React.useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        id: "identity",
        header: "User",
        accessorFn: (r) => r.email ?? r.passkey ?? r._id,
        cell: ({ row }) => {
          const u = row.original;
          const display = u.email ?? teamName(u.teamId) ?? "Pass-key user";
          return (
            <EntityCell
              leading={
                u.role === "team" ? (
                  <Avatar name={display} src={row.original.avatar?.url} size="lg" />
                ) : (
                  <IconTile icon={<UserRound />} tone={u.role === "admin" ? "brand" : "peri"} />
                )
              }
              primary={display}
              secondary={<CopyChip value={u._id} />}
            />
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        size: 110,
        cell: ({ row }) => <RoleChip role={row.original.role} />,
      },
      {
        id: "simulation",
        header: "Simulation",
        size: 190,
        accessorFn: (r) => simName(r.simulationId) ?? "",
        cell: ({ row }) => {
          const n = simName(row.original.simulationId);
          return n ? (
            <Badge tone="navy" size="sm">
              {n}
            </Badge>
          ) : (
            <span className="text-[13px] text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "passkey",
        header: "Pass key",
        size: 180,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.role === "team" ? (
            <PasskeyCell passkey={row.original.passkey} />
          ) : (
            <span className="text-[13px] text-muted-foreground">Signs in by email</span>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[13px] text-muted-foreground">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 56,
        enableSorting: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="User actions" size="sm">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.original.role === "team" && (
                  <DropdownMenuItem onSelect={() => regen.mutate(row.original._id)}>
                    <RefreshCw /> Regenerate pass key
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setPendingDelete(row.original)}>
                  <Trash2 /> Delete user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [teamName, simName, regen]
  );

  return (
    <>
      <PageHeader
        title="Staff access"
        count={data.length}
        subtitle={
          teamLoginCount > 0
            ? `People who sign in with an email and password. The ${teamLoginCount} team pass keys are on the Teams page, next to the team each one opens.`
            : "People who sign in with an email and password. Teams use pass keys instead, shown on the Teams page."
        }
      />

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        searchPlaceholder="Search users…"
        groupBy="role"
        groupLabel={(k) => (
          <span className="flex items-baseline gap-2">
            <span className="capitalize">{k}</span>
            <span className="text-[11px] font-normal text-muted-foreground">{ROLE_HINT[k]}</span>
          </span>
        )}
        empty={
          <EmptyState
            icon={<KeyRound />}
            title="No users yet"
            hint="Team users are created alongside teams and carry the pass key players log in with."
          />
        }
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="Delete this user?"
        description="If this is a team user, that team immediately loses access to the player app."
        confirmLabel="Delete user"
        loading={del.isPending}
        onConfirm={() => del.mutate(pendingDelete._id, { onSuccess: () => setPendingDelete(null) })}
      />
    </>
  );
}
