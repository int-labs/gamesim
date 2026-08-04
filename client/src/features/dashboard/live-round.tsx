import { CheckCircle2, Clock, Play, Square, Users } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The live-round strip: the one thing an operator looks at while running a room.
 *
 * It answers, in reading order — which round, how long is left, how many teams
 * are in, and what do I press next — without needing a second glance anywhere
 * else on the page.
 */

function useCountdown(endDate?: string | null) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!endDate) return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [endDate]);

  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - now;
  const over = ms <= 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  return {
    over,
    // Hours only appear once they exist — "04:31" reads faster than "00:04:31".
    label: (h > 0 ? [h, m, s] : [m, s]).map((n) => String(n).padStart(2, "0")).join(":"),
  };
}

export function LiveRoundStrip({
  round,
  totalRounds,
  teamCount,
  submittedCount,
  busy,
  onEnd,
  onActivate,
}: {
  round: any | undefined;
  totalRounds: number;
  teamCount: number;
  submittedCount: number;
  busy?: boolean;
  onEnd: () => void;
  onActivate: () => void;
}) {
  const countdown = useCountdown(round?.timer?.endDate);
  const pct = teamCount === 0 ? 0 : Math.round((submittedCount / teamCount) * 100);
  const allIn = teamCount > 0 && submittedCount >= teamCount;

  if (!round) {
    return (
      <div className="rounded-card border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow text-muted-foreground">No round is open</div>
            <p className="mt-1 text-[15px] font-semibold text-foreground">
              Teams can't submit anything right now.
            </p>
          </div>
          <Button onClick={onActivate} loading={busy}>
            <Play /> Open the next round
          </Button>
        </div>
      </div>
    );
  }

  const isActive = round.status === "Active";

  return (
    <div
      className={cn(
        "rounded-card border p-6 transition-colors",
        isActive ? "border-primary/30 bg-accent" : "border-border bg-card"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        {/* Which round */}
        <div className="min-w-[190px]">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-muted-foreground">Live now</span>
            <Badge tone={isActive ? "success" : "outline"} size="sm">
              {round.status}
            </Badge>
          </div>
          <div className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground">
            Round {round.roundNumber}
            {totalRounds > 0 && (
              <span className="text-[18px] font-medium text-muted-foreground"> of {totalRounds}</span>
            )}
          </div>
        </div>

        {/* Time left */}
        <div className="min-w-[140px]">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="eyebrow text-muted-foreground">
              {countdown?.over ? "Over by" : "Time left"}
            </span>
          </div>
          <div
            className={cn(
              "mt-1 font-display text-[28px] font-semibold leading-none tnum",
              countdown?.over ? "text-destructive" : "text-foreground"
            )}
          >
            {countdown?.label ?? "—"}
          </div>
        </div>

        {/* Submissions */}
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" />
            <span className="eyebrow text-muted-foreground">Submitted</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-[28px] font-semibold leading-none tnum text-foreground">
              {submittedCount}
              <span className="text-[18px] font-medium text-muted-foreground">/{teamCount}</span>
            </span>
            {allIn && (
              <span className="flex items-center gap-1 text-[12.5px] font-semibold text-success">
                <CheckCircle2 className="size-3.5" /> all in
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                allIn ? "bg-success" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* The next press */}
        <div className="flex items-center gap-2 self-center">
          {isActive ? (
            <Button size="lg" onClick={onEnd} loading={busy}>
              <Square /> End round {round.roundNumber}
            </Button>
          ) : (
            <Button size="lg" onClick={onActivate} loading={busy}>
              <Play /> Open round {round.roundNumber}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
