import { CircleDot, Clock, Flag, MinusCircle } from "lucide-react";
import * as React from "react";
import { Avatar } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { ProgressLinear } from "@/components/app/bits";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Who is actually playing, right now.
 *
 * The console could always see submitted decisions — which answers "who is
 * finished" and nothing else. A facilitator walking the room needs the other
 * question: *who is stuck*. A team on day 12 with no product lines and $180
 * left looked, from here, exactly like a team that never opened the app.
 *
 * Teams heartbeat this while they play (see the player's GamesimProvider), so
 * the three states below are readable at a glance and, critically, are three
 * DIFFERENT states rather than "submitted / not submitted":
 *
 *   playing   — seen within the last couple of minutes and moving
 *   idle      — app open but the day hasn't moved, or gone quiet
 *   done      — their local run reached the end
 *
 * A team with no row at all has never signed in this round; that is shown too,
 * because "no data" is the most actionable state of the three.
 */

const IDLE_AFTER_MS = 2 * 60 * 1000;

export interface ProgressRow {
  teamId: string;
  day: number;
  phase: number;
  cash: number;
  energy: number;
  lines: number;
  shopName?: string | null;
  ended?: boolean;
  lastSeenAt: string;
}

export interface TeamRow {
  _id: string;
  teamName: string;
  avatar?: { url?: string } | null;
}

type State = "done" | "playing" | "idle" | "absent";

const STATE_META: Record<State, { label: string; tone: any; icon: React.ElementType }> = {
  done: { label: "Finished", tone: "success", icon: Flag },
  playing: { label: "Playing", tone: "brand", icon: CircleDot },
  idle: { label: "Idle", tone: "warning", icon: Clock },
  absent: { label: "Not started", tone: "outline", icon: MinusCircle },
};

function stateOf(row: ProgressRow | undefined, now: number): State {
  if (!row) return "absent";
  if (row.ended) return "done";
  return now - new Date(row.lastSeenAt).getTime() > IDLE_AFTER_MS ? "idle" : "playing";
}

export function LiveTeams({
  teams,
  progress,
  totalDays = 90,
}: {
  teams: TeamRow[];
  progress: ProgressRow[];
  /** The run's length, so the bar means something without a legend. */
  totalDays?: number;
}) {
  // Re-render on a timer so "playing" decays to "idle" on screen without a
  // refetch — otherwise a team that closed their laptop stays green until the
  // next poll happens to land.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const byTeam = React.useMemo(
    () => new Map(progress.map((p) => [String(p.teamId), p])),
    [progress]
  );

  const rows = React.useMemo(
    () =>
      teams
        .map((t) => {
          const p = byTeam.get(String(t._id));
          return { team: t, p, state: stateOf(p, now) };
        })
        // Whoever needs attention first: not started, then idle, then playing,
        // then finished. Within a state, the least far along comes first.
        .sort((a, b) => {
          const order: State[] = ["absent", "idle", "playing", "done"];
          const d = order.indexOf(a.state) - order.indexOf(b.state);
          return d !== 0 ? d : (a.p?.day ?? 0) - (b.p?.day ?? 0);
        }),
    [teams, byTeam, now]
  );

  if (teams.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        No teams in this simulation yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {rows.map(({ team, p, state }) => {
        const meta = STATE_META[state];
        const Icon = meta.icon;
        return (
          <li
            key={team._id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
          >
            <Avatar name={team.teamName} src={team.avatar?.url} size="sm" />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[13.5px] font-medium text-foreground">
                  {team.teamName}
                </span>
                {p?.shopName && (
                  <span className="truncate text-[11.5px] text-muted-foreground">
                    {p.shopName}
                  </span>
                )}
              </div>
              <div className="mt-1">
                <ProgressLinear
                  thin
                  value={p?.day ?? 0}
                  total={totalDays}
                  tone={state === "idle" ? "warning" : state === "done" ? "success" : "primary"}
                />
              </div>
            </div>

            <span className="w-16 shrink-0 text-right text-[12px] tnum text-muted-foreground">
              {p ? `day ${p.day}` : "—"}
            </span>
            <span className="w-20 shrink-0 text-right text-[12px] tnum text-body">
              {p ? money(p.cash) : "—"}
            </span>
            <span
              className={cn(
                "w-12 shrink-0 text-right text-[12px] tnum",
                (p?.energy ?? 0) <= 10 ? "font-semibold text-warning" : "text-muted-foreground"
              )}
              title="Energy left"
            >
              {p ? `${p.energy}⚡` : "—"}
            </span>

            <Badge tone={meta.tone} size="sm" className="w-[92px] shrink-0 justify-center">
              <Icon className="size-3" />
              {meta.label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
