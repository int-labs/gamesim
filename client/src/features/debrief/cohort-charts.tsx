import * as React from "react";
import { Avatar } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TeamMoney, TeamStrength } from "./cohort-data";

/**
 * The debrief's evidence.
 *
 * Hand-built SVG rather than a chart library, matching the rest of the console
 * — these are small, fixed-purpose figures, and a dependency would buy tooltips
 * and axis machinery nobody needs on a projector at the front of a room.
 *
 * Every figure here answers one question a facilitator asks out loud. Anything
 * that does not is left out, because a debrief slide with six charts is a slide
 * nobody reads.
 */

/* ─────────────────────── Revenue vs what you kept ─────────────────────── */

/**
 * The central chart, and the reason the debrief exists.
 *
 * Two bars per team on a shared scale: revenue, and the gross profit inside it.
 * Sorted by profit, so the ordering is the lesson — a team can be third on
 * revenue and first on what it kept, and that inversion is visible without
 * anyone explaining it.
 */
export function RevenueVsProfit({ money: rows }: { money: TeamMoney[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        No scored rounds yet — the figures appear once you end a round.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.teamId} className="flex items-center gap-3">
          <Avatar name={r.teamName} src={r.avatarUrl} size="sm" />
          <span className="w-32 shrink-0 truncate text-[13px] font-medium text-foreground">
            {r.teamName}
          </span>

          <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
            {/* Revenue is the full bar; profit is the part of it they kept. */}
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-navy-200/70"
              style={{ width: `${(r.revenue / max) * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-success"
              style={{ width: `${(Math.max(0, r.grossProfit) / max) * 100}%` }}
            />
          </div>

          <span className="w-20 shrink-0 text-right text-[12.5px] tnum text-muted-foreground">
            {money(r.revenue)}
          </span>
          <span className="w-20 shrink-0 text-right text-[12.5px] font-semibold tnum text-foreground">
            {money(r.grossProfit)}
          </span>
          <Badge
            tone={r.margin >= 0.35 ? "success" : r.margin >= 0.2 ? "outline" : "warning"}
            size="sm"
            className="w-14 shrink-0 justify-center"
          >
            {Math.round(r.margin * 100)}%
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────── Standings movement ────────────────────────── */

/**
 * Rank per round, drawn as a bump chart.
 *
 * Rank rather than raw strength on purpose: the strength values do not sum to
 * anything meaningful (the engine scales each team's competed share by the
 * share it declared), so plotting them invites the reading "we had 18% of the
 * market". Rank is the honest form of the same information.
 */
export function StandingsBump({
  strength,
  max = 8,
}: {
  strength: TeamStrength[];
  max?: number;
}) {
  const shown = strength.slice(0, max);
  const rounds = React.useMemo(
    () => [...new Set(shown.flatMap((t) => t.points.map((p) => p.roundNumber)))].sort((a, b) => a - b),
    [shown]
  );

  if (rounds.length < 2) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        Movement needs at least two scored rounds.
      </p>
    );
  }

  const W = 520;
  const H = 30 + shown.length * 26;
  const padX = 90;
  const x = (round: number) =>
    padX + ((round - rounds[0]) / Math.max(1, rounds.at(-1)! - rounds[0])) * (W - padX - 30);
  const y = (rank: number) => 18 + (rank - 1) * 26;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[460px]" role="img"
           aria-label="Team rank by round">
        {rounds.map((r) => (
          <text
            key={r}
            x={x(r)}
            y={10}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            R{r}
          </text>
        ))}

        {shown.map((t, i) => {
          const pts = t.points.filter((p) => p.rank > 0);
          if (pts.length === 0) return null;
          const d = pts.map((p, j) => `${j === 0 ? "M" : "L"}${x(p.roundNumber)},${y(p.rank)}`).join(" ");
          const last = pts.at(-1)!;
          const first = pts[0];
          const moved = first.rank - last.rank;
          return (
            <g key={t.teamId}>
              <path
                d={d}
                fill="none"
                strokeWidth={i === 0 ? 2.5 : 1.75}
                className={cn(i === 0 ? "stroke-primary" : "stroke-navy-300")}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pts.map((p) => (
                <circle
                  key={p.roundNumber}
                  cx={x(p.roundNumber)}
                  cy={y(p.rank)}
                  r={i === 0 ? 3.5 : 2.5}
                  className={cn(i === 0 ? "fill-primary" : "fill-navy-300")}
                />
              ))}
              <text
                x={padX - 8}
                y={y(first.rank) + 3}
                textAnchor="end"
                className={cn(
                  "text-[10px]",
                  i === 0 ? "fill-foreground font-semibold" : "fill-muted-foreground"
                )}
              >
                {t.teamName.length > 14 ? `${t.teamName.slice(0, 13)}…` : t.teamName}
              </text>
              {moved !== 0 && (
                <text
                  x={x(last.roundNumber) + 8}
                  y={y(last.rank) + 3}
                  className={cn("text-[9px] font-semibold", moved > 0 ? "fill-success" : "fill-destructive")}
                >
                  {moved > 0 ? `▲${moved}` : `▼${Math.abs(moved)}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
