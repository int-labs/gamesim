import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, MonitorPlay, Search, UserRound } from "lucide-react";
import * as React from "react";
import { getSimulations } from "@/api";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { useSession } from "@/features/auth/auth-gate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Avatar, Kbd, Separator } from "@/components/ui/primitives";
import { qk } from "@/lib/query-client";
import { useScope } from "@/lib/scope-store";
import { cn } from "@/lib/utils";

/** The active-simulation picker. Scoped pages are meaningless without it. */
function ScopePicker() {
  const { simulationId, simulationName, setScope } = useScope();
  const { data } = useQuery({
    queryKey: qk.simulations(),
    queryFn: async () => (await getSimulations()).data as any[],
  });

  // Stable identity, or the auto-select effect below re-runs every render.
  const sims: any[] = React.useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Auto-select the first Active simulation once, so the console is never
  // stuck showing "no scope" on a fresh browser.
  React.useEffect(() => {
    if (simulationId || sims.length === 0) return;
    const preferred = sims.find((s) => s.status === "Active") ?? sims[0];
    if (preferred) setScope(preferred._id, preferred.simulationName);
  }, [simulationId, sims, setScope]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 max-w-[260px] items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          <MonitorPlay className="size-4 shrink-0 text-primary" />
          <span className="truncate">{simulationName ?? "Select simulation"}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Active simulation</DropdownMenuLabel>
        {sims.length === 0 && (
          <div className="px-2.5 py-3 text-[13px] text-muted-foreground">No simulations yet</div>
        )}
        {sims.map((s) => (
          <DropdownMenuItem key={s._id} onSelect={() => setScope(s._id, s.simulationName)}>
            <MonitorPlay />
            <span className="flex-1 truncate">{s.simulationName}</span>
            {s._id === simulationId && <Badge tone="brand" size="sm">Current</Badge>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({
  onOpenPalette,
  onOpenMobileNav,
  className,
}: {
  onOpenPalette: () => void;
  onOpenMobileNav?: () => void;
  className?: string;
}) {
  const { user, signOut } = useSession();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-md",
        className
      )}
    >
      {onOpenMobileNav && (
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="lg:hidden"
        >
          <UserRound className="size-5" />
        </button>
      )}

      {/* M2 SearchPill — readonly, opens the palette (spec §7.2) */}
      <button
        type="button"
        onClick={onOpenPalette}
        className="group flex h-9 w-full max-w-[380px] items-center gap-2.5 rounded-full border border-border bg-card px-3.5 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-[13px] text-muted-foreground">Search anything…</span>
        <span className="flex shrink-0 items-center gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ScopePicker />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <IconButton label="Notifications">
          <Bell />
        </IconButton>
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              <Avatar name={user.email} size="lg" />
              <div className="hidden text-left lg:block">
                <div className="max-w-[180px] truncate text-[12.5px] font-semibold leading-4 text-foreground">
                  {user.email}
                </div>
                <div className="text-[11px] capitalize leading-3 text-muted-foreground">
                  {user.role}
                </div>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Signed in as {user.role}</DropdownMenuLabel>
            <DropdownMenuItem disabled>
              <UserRound /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
