import NumberFlow from "@number-flow/react";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * O10 ArcGauge — 270° arc, rounded caps, hatched "missing" remainder.
 * Hand-rolled SVG (spec §8.4): a chart library buys nothing here.
 */
export function ArcGauge({
  value,
  total,
  size = 190,
  label,
  className,
}: {
  value: number;
  total: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const fraction = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const pct = Math.round(fraction * 100);

  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 270° sweep starting bottom-left
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.75;

  const tone =
    fraction >= 1 ? "var(--color-success)" : fraction >= 0.5 ? "var(--color-chart-2)" : "var(--color-warning)";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-[225deg]" role="img" aria-label={`${pct}% ${label ?? ""}`}>
        <defs>
          <pattern id="gauge-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border)" strokeWidth="3" />
          </pattern>
        </defs>
        {/* Track — hatched, because the remainder is "not yet real" */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#gauge-hatch)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={{ strokeDashoffset: reduced ? arcLength * (1 - fraction) : arcLength }}
          animate={{ strokeDashoffset: arcLength * (1 - fraction) }}
          transition={reduced ? { duration: 0 } : SPRING.gentle}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[30px] font-semibold leading-none tracking-tight tnum text-foreground">
          <NumberFlow value={pct} suffix="%" />
        </span>
        {label && <span className="mt-1.5 text-[12px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
