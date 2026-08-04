import { AlertCircle, ArrowRight, Info, TriangleAlert, X } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ======================================================== M14 EmptyState
   "The empty state is the onboarding" (spec §1.2 r10): say what the thing is,
   why it's empty, and the one action that fills it. */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  kind = "no-data",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  kind?: "no-data" | "no-results" | "error";
  className?: string;
}) {
  const tone =
    kind === "error"
      ? "bg-destructive-tint text-destructive"
      : kind === "no-results"
        ? "bg-neutral-tint text-neutral"
        : "bg-accent text-accent-foreground";

  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div
        className={cn(
          "mb-4 flex size-14 items-center justify-center rounded-full [&_svg]:size-6",
          tone,
          "motion-safe:animate-float-y"
        )}
        aria-hidden
      >
        {icon ?? (kind === "error" ? <AlertCircle /> : <Info />)}
      </div>
      <h3 className="font-sans text-[16px] font-semibold text-foreground">{title}</h3>
      {hint && <p className="mt-1.5 max-w-[320px] text-[13px] leading-5 text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ============================================================ M13 Banner */

const BANNER_TONES = {
  info: { wrap: "bg-info-tint text-info", Icon: Info },
  warning: { wrap: "bg-warning-tint text-warning", Icon: TriangleAlert },
  danger: { wrap: "bg-destructive-tint text-destructive", Icon: AlertCircle },
  brand: { wrap: "bg-accent text-accent-foreground", Icon: Info },
} as const;

export function Banner({
  tone = "info",
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: keyof typeof BANNER_TONES;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}) {
  const { wrap, Icon } = BANNER_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className={cn("flex items-center gap-3 rounded-lg p-4", wrap, className)}>
        <Icon className="size-5 shrink-0" />
        <div className="min-w-0 flex-1 text-[13px] font-medium leading-5">{children}</div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="group/act inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold underline-offset-4 hover:underline"
          >
            {action.label}
            <ArrowRight className="size-3.5 transition-transform group-hover/act:translate-x-0.5" />
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ================================================== Query-state wrapper
   Every list/chart gets the loading → empty → error triad (§19). */

export function QueryState({
  isLoading,
  isError,
  isEmpty,
  skeleton,
  empty,
  onRetry,
  children,
}: {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  skeleton: React.ReactNode;
  empty: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) return <>{skeleton}</>;
  if (isError)
    return (
      <EmptyState
        kind="error"
        title="Couldn't load this"
        hint="The request failed. The API may be down or unreachable."
        action={
          onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      />
    );
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}
