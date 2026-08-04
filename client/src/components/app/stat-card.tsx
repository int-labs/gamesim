import NumberFlow from "@number-flow/react";
import * as React from "react";
import { Card } from "@/components/app/card";
import { DeltaChip, Sparkline } from "@/components/app/bits";
import { CardArrow } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * M1 StatCard — "numbers are the product" (spec §1.2 r3).
 * The value rolls on mount and on every live change via NumberFlow.
 * `hero` renders the navy inverted card; max two per screen.
 */
export function StatCard({
  label,
  value,
  format,
  delta,

  deltaLabel,
  footnote,
  sparkline,
  hero = false,
  compact = false,
  onOpen,
  openLabel,
  icon,
  className,
}: {
  label: React.ReactNode;
  value: number;
  /** NumberFlow narrows Intl's options (no scientific/engineering notation). */
  format?: React.ComponentProps<typeof NumberFlow>["format"];
  delta?: number | null;
  deltaLabel?: React.ReactNode;
  footnote?: React.ReactNode;
  sparkline?: number[];
  hero?: boolean;
  compact?: boolean;
  onOpen?: () => void;
  openLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      hero={hero}
      interactive={!!onOpen}
      className={cn(
        "flex flex-col justify-between",
        compact ? "min-h-[100px] p-5" : "min-h-[148px]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span
            className={cn(
              "truncate text-[13px] font-medium",
              hero ? "text-hero-muted" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
        </div>
        {onOpen && <CardArrow onClick={onOpen} label={openLabel ?? "Open"} onDark={hero} />}
      </div>

      <div className={cn(compact ? "mt-3" : "mt-4")}>
        <div
          className={cn(
            "font-display font-semibold leading-none tracking-tight tnum",
            compact ? "text-[28px]" : "text-[40px]",
            hero ? "text-hero-fg" : "text-foreground"
          )}
        >
          <NumberFlow value={value} format={format} />
        </div>

        {(delta != null || footnote || sparkline) && (
          <div className="mt-3 flex items-center gap-2">
            {delta != null && <DeltaChip value={delta} onDark={hero} />}
            {footnote && (
              <span
                className={cn(
                  "truncate text-[12px]",
                  hero ? "text-hero-muted" : "text-muted-foreground"
                )}
              >
                {footnote}
              </span>
            )}
            {deltaLabel && !footnote && (
              <span
                className={cn("truncate text-[12px]", hero ? "text-hero-muted" : "text-muted-foreground")}
              >
                {deltaLabel}
              </span>
            )}
            {sparkline && (
              <div className="ml-auto shrink-0">
                <Sparkline
                  data={sparkline}
                  tone={hero ? "var(--color-hero-accent)" : "var(--color-chart-2)"}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Skeleton must match the final box exactly — zero layout shift (§4.2 #12). */
export function StatCardSkeleton({ hero = false, compact = false }: { hero?: boolean; compact?: boolean }) {
  return (
    <Card hero={hero} className={cn("flex flex-col justify-between", compact ? "min-h-[100px] p-5" : "min-h-[148px]")}>
      <div className="flex items-start justify-between">
        <Skeleton className={cn("h-3 w-20", hero && "bg-white/10")} />
        <Skeleton className={cn("size-8 rounded-full", hero && "bg-white/10")} />
      </div>
      <div className={cn(compact ? "mt-3" : "mt-4")}>
        <Skeleton className={cn(compact ? "h-7 w-24" : "h-9 w-32", hero && "bg-white/10")} />
        <Skeleton className={cn("mt-3 h-5 w-36 rounded-full", hero && "bg-white/10")} />
      </div>
    </Card>
  );
}
