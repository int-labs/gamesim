import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface Row {
  teamId: string;
  teamName: string;
  index: number;
  score: number;
}

/**
 * Cohort standings — the thing a facilitator actually puts on the projector.
 *
 * The column is called "Strength", not "Market share", on purpose: the engine
 * multiplies each team's competed share by its own declared target, so the
 * values rank teams correctly but do not partition the market and will not sum
 * to 100%. Labelling them as a share of the market would be a lie an operator
 * would repeat out loud to a room. The bar is drawn relative to the leader,
 * which is what makes the ranking legible without implying a percentage.
 */
export function StandingsTable({
  rows,
  previous,
  max = 8,
}: {
  rows: Row[];
  /** Previous round's order, for movement arrows. */
  previous?: Row[];
  max?: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        No scored rounds yet — standings appear once you end a round.
      </p>
    );
  }

  const leader = rows[0]?.index || 1;
  const prevRank = new Map((previous ?? []).map((r, i) => [r.teamId, i]));

  return (
    <ol className="space-y-1">
      {rows.slice(0, max).map((r, i) => {
        const was = prevRank.get(r.teamId);
        const move = was === undefined ? 0 : was - i;
        const Trend = move > 0 ? TrendingUp : move < 0 ? TrendingDown : Minus;

        return (
          <li key={r.teamId} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
            <span
              className={cn(
                "w-6 shrink-0 text-center font-display text-[15px] font-semibold tnum",
                i === 0 ? "text-primary" : "text-muted-foreground"
              )}
            >
              {i + 1}
            </span>

            <Avatar name={r.teamName} size="sm" />

            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
              {r.teamName}
            </span>

            {previous && previous.length > 0 && (
              <span
                className={cn(
                  "flex w-10 shrink-0 items-center justify-end gap-0.5 text-[11.5px] font-semibold tnum",
                  move > 0 ? "text-success" : move < 0 ? "text-destructive" : "text-muted-foreground/60"
                )}
                title={move === 0 ? "No change" : `${Math.abs(move)} place${Math.abs(move) === 1 ? "" : "s"} ${move > 0 ? "up" : "down"}`}
              >
                <Trend className="size-3" />
                {move !== 0 && Math.abs(move)}
              </span>
            )}

            <div className="hidden w-32 shrink-0 sm:block">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-navy-300")}
                  style={{ width: `${Math.max(4, (r.index / leader) * 100)}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
