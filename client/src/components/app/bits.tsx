import { Check, Copy, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { WithTooltip } from "@/components/ui/tooltip";
import { SPRING } from "@/lib/motion";
import { cn, hashIndex, shortId } from "@/lib/utils";

/* ============================================================ Entity tile hues
   Deterministic per entity type so a "product" is the same jade everywhere
   (spec §5). All six draw from the brand palette. */
export const TILE_TONES = {
  brand: "bg-pink-50 text-pink-600 dark:bg-accent dark:text-pink-300",
  navy: "bg-navy-50 text-navy-700 dark:bg-navy-900/70 dark:text-navy-100",
  peri: "bg-peri-50 text-peri-600 dark:bg-info-tint dark:text-info",
  gold: "bg-yellow-100 text-yellow-700 dark:bg-warning-tint dark:text-warning",
  success: "bg-success-tint text-success",
  neutral: "bg-neutral-tint text-neutral",
} as const;

export type TileTone = keyof typeof TILE_TONES;

export function IconTile({
  icon,
  tone = "neutral",
  size = "md",
  className,
}: {
  icon: React.ReactNode;
  tone?: TileTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizing = {
    sm: "size-7 rounded-sm [&_svg]:size-3.5",
    md: "size-9 rounded-md [&_svg]:size-[18px]",
    lg: "size-10 rounded-md [&_svg]:size-5",
  }[size];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", sizing, TILE_TONES[tone], className)}
      aria-hidden
    >
      {icon}
    </span>
  );
}

/* ======================================================== M15 EntityCell */

export function EntityCell({
  leading,
  primary,
  secondary,
  trailing,
  className,
}: {
  leading?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold leading-5 text-foreground">{primary}</div>
        {secondary && (
          <div className="truncate text-[12px] leading-4 text-muted-foreground">{secondary}</div>
        )}
      </div>
      {trailing}
    </div>
  );
}

/* ========================================================= §9.10 CopyChip
   Mongo ObjectIds are 24 chars — always truncated, click to copy. */

export function CopyChip({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1400);
      } catch {
        toast.error("Couldn't copy — clipboard unavailable");
      }
    },
    [value]
  );

  return (
    <WithTooltip label={value}>
      <button
        type="button"
        onClick={copy}
        className={cn(
          "group/copy inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-xs border border-border bg-muted px-1.5",
          "font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
          className
        )}
      >
        <span className="truncate">{label ?? shortId(value)}</span>
        {copied ? (
          <Check className="size-3 shrink-0 text-success" />
        ) : (
          <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-100" />
        )}
      </button>
    </WithTooltip>
  );
}

/* ======================================================= A4 DeltaChip */

export function DeltaChip({
  value,
  suffix = "%",
  onDark = false,
  className,
}: {
  value: number | null | undefined;
  suffix?: string;
  onDark?: boolean;
  className?: string;
}) {
  if (value == null) return null;
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;

  const tone = onDark
    ? "bg-white/12 text-hero-accent"
    : dir === "up"
      ? "bg-success-tint text-success"
      : dir === "down"
        ? "bg-destructive-tint text-destructive"
        : "bg-neutral-tint text-neutral";

  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[12px] font-semibold tnum",
        tone,
        className
      )}
    >
      <Icon className="size-3" />
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

/* ================================================== Canonical status chips
   Mapping from spec §3.3 — the single source of truth for gamesim states. */

export function RoundStatusChip({ status, size }: { status?: string; size?: "sm" | "md" }) {
  const s = status ?? "Pending";
  if (s === "Active")
    return (
      <Badge tone="success" size={size} className="gap-1.5">
        <span className="relative inline-flex size-1.5">
          <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          <span
            className="absolute inset-0 rounded-full bg-success motion-reduce:hidden"
            style={{ animation: "pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite" }}
            aria-hidden
          />
        </span>
        Active
      </Badge>
    );
  if (s === "Completed")
    return (
      <Badge tone="brand" size={size}>
        Completed
      </Badge>
    );
  return (
    <Badge tone="neutral" size={size} dot>
      {s}
    </Badge>
  );
}

export function SimulationStatusChip({ status, size }: { status?: string; size?: "sm" | "md" }) {
  const tone = status === "Active" ? "success" : status === "Completed" ? "brand" : "neutral";
  return (
    <Badge tone={tone} size={size} dot={tone === "neutral"}>
      {status ?? "Unknown"}
    </Badge>
  );
}

export function RoleChip({ role, size }: { role?: string; size?: "sm" | "md" }) {
  const tone =
    role === "admin" ? "brand" : role === "operator" ? "info" : role === "team" ? "warning" : "neutral";
  return (
    <Badge tone={tone} size={size}>
      {role ?? "—"}
    </Badge>
  );
}

export function ActiveChip({ active, size }: { active?: boolean; size?: "sm" | "md" }) {
  return (
    <Badge tone={active ? "success" : "neutral"} size={size} dot>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

/* ====================================================== A19 ScoreBar */

export function ScoreBar({
  value,
  max = 10,
  showLabel = true,
  className,
}: {
  value: number | null | undefined;
  max?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const v = value ?? 0;
  const scaled = max === 10 ? v : (v / max) * 10;
  const filled = Math.max(0, Math.min(10, Math.round(scaled)));
  const tone = filled <= 3 ? "bg-destructive" : filled <= 6 ? "bg-warning" : "bg-success";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-[2px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scaleY: 0.4, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: i * 0.02, duration: 0.15 }}
            className={cn("h-3 w-[3px] rounded-full", i < filled ? tone : "bg-border")}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-[12px] font-semibold tnum text-muted-foreground">
          {filled}/10
        </span>
      )}
    </div>
  );
}

/* ================================================= A14 ProgressLinear */

export function ProgressLinear({
  value,
  total = 100,
  thin = false,
  tone = "primary",
  hatchRemainder = false,
  className,
}: {
  value: number;
  total?: number;
  thin?: boolean;
  tone?: "primary" | "success" | "warning" | "navy";
  hatchRemainder?: boolean;
  className?: string;
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  const fill = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    navy: "bg-navy-700",
  }[tone];

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full",
        thin ? "h-1" : "h-2",
        hatchRemainder ? "hatch bg-card" : "bg-neutral-tint",
        className
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn("h-full rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={SPRING.smooth}
      />
    </div>
  );
}

/* ============================================ A12 SegmentedControl (FLIP) */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className,
}: {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-full bg-muted p-1", className)} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              "[&_svg]:size-4"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING.snappy}
                className="absolute inset-0 rounded-full bg-card shadow-sm"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ==================================================== A16 Sparkline */

export function Sparkline({
  data,
  width = 84,
  height = 24,
  tone = "var(--color-chart-2)",
  fill = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: string;
  fill?: boolean;
  className?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? 100 / (data.length - 1) : 0;

  const points = data.map((d, i) => [i * step, 24 - ((d - min) / span) * 20 - 2] as const);
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `0,24 ${line} 100,24`;

  return (
    <svg
      viewBox="0 0 100 24"
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      {fill && <polygon points={area} fill={tone} opacity={0.12} />}
      <motion.polyline
        points={line}
        fill="none"
        stroke={tone}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

/* ========================================================= A20 Tag */

export function Tag({
  label,
  onRemove,
  tone = "neutral",
}: {
  label: React.ReactNode;
  onRemove?: () => void;
  tone?: "neutral" | "brand";
}) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING.snappy}
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold",
        tone === "brand" ? "bg-accent text-accent-foreground" : "bg-neutral-tint text-neutral"
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="-mr-1 flex size-4 items-center justify-center rounded-full transition-colors hover:bg-destructive-tint hover:text-destructive"
        >
          <svg viewBox="0 0 8 8" className="size-2" aria-hidden>
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </motion.span>
  );
}

/** Deterministic tile tone by entity name — keeps lists visually stable. */
export function toneFor(name: string): TileTone {
  const tones: TileTone[] = ["brand", "navy", "peri", "gold", "success", "neutral"];
  return tones[hashIndex(name, tones.length)];
}
