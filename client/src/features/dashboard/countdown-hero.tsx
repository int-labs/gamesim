import NumberFlow from "@number-flow/react";
import { Calculator, IterationCw, Play } from "lucide-react";
import * as React from "react";
import { Card } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/primitives";
import { countdownParts } from "@/lib/format";

function Pad({ value }: { value: number }) {
  return (
    <NumberFlow
      value={value}
      format={{ minimumIntegerDigits: 2 }}
      className="text-hero-fg"
    />
  );
}

/**
 * O11 CountdownHeroCard. One interval for the whole card; NumberFlow re-renders
 * only the digits that change (spec §16 timer discipline).
 */
export function CountdownHero({
  round,
  onStart,
  onCalculate,
}: {
  round?: any;
  onStart?: () => void;
  onCalculate?: () => void;
}) {
  const endsAt = round?.timer?.endDate ? new Date(round.timer.endDate).getTime() : null;
  const startedAt = round?.timer?.startDate ? new Date(round.timer.startDate).getTime() : null;

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!round) {
    return (
      <Card className="flex min-h-[220px] flex-col justify-between">
        <div>
          <div className="eyebrow text-muted-foreground">Round status</div>
          <h3 className="mt-2 font-display text-[20px] font-semibold text-foreground">
            No active round
          </h3>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Start the next round to open decision submissions for teams.
          </p>
        </div>
        {onStart && (
          <Button className="mt-5 w-full" onClick={onStart}>
            <Play /> Start next round
          </Button>
        )}
      </Card>
    );
  }

  const remaining = endsAt ? endsAt - now : 0;
  const { hours, minutes, seconds, urgent, expired } = countdownParts(remaining);
  const total = startedAt && endsAt ? endsAt - startedAt : 0;
  const elapsedPct = total > 0 ? Math.min(100, Math.max(0, ((now - startedAt!) / total) * 100)) : 0;

  return (
    <Card hero className="flex min-h-[220px] flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <StatusDot tone="success" live />
          <span className="eyebrow text-hero-muted">
            Round {round.roundNumber} · {round.status}
          </span>
        </div>
        <IterationCw className="size-4 text-hero-muted" />
      </div>

      <div className="mt-5">
        <div className="font-display text-[42px] font-semibold leading-none tracking-tight tnum text-hero-fg">
          {expired ? (
            <span className="text-hero-accent">Time&apos;s up</span>
          ) : (
            <>
              <Pad value={hours} />
              <span className="animate-blink text-hero-muted">:</span>
              <Pad value={minutes} />
              <span className="animate-blink text-hero-muted">:</span>
              <Pad value={seconds} />
            </>
          )}
        </div>
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${elapsedPct}%`,
                background: urgent ? "var(--color-warning)" : "var(--color-hero-accent)",
              }}
            />
          </div>
          <p className="mt-2 text-[12px] text-hero-muted">
            {Math.round(elapsedPct)}% elapsed
            {expired ? " — ready to calculate" : urgent ? " — closing soon" : ""}
          </p>
        </div>
      </div>

      {onCalculate && (
        <Button variant="onDark" className="mt-5 w-full" onClick={onCalculate}>
          <Calculator /> Calculate round {round.roundNumber}
        </Button>
      )}
    </Card>
  );
}
