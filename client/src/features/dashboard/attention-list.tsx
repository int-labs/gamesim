import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Info, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AttentionItem, Severity } from "@/features/dashboard/attention";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOOK: Record<
  Severity,
  { icon: typeof Info; tint: string; fg: string; label: string }
> = {
  blocked: { icon: AlertOctagon, tint: "bg-destructive-tint", fg: "text-destructive", label: "Blocked" },
  action: { icon: Zap, tint: "bg-accent", fg: "text-primary", label: "Ready" },
  warning: { icon: AlertTriangle, tint: "bg-warning-tint", fg: "text-warning", label: "Check" },
  info: { icon: Info, tint: "bg-muted", fg: "text-muted-foreground", label: "Note" },
};

/**
 * The to-do list, in severity order.
 *
 * Every row states a consequence rather than a status, because "3 teams cannot
 * sign in" is actionable and "teams: 12" is not. An empty list is a real
 * answer and says so.
 */
export function AttentionList({
  items,
  busy,
  onEndRound,
  onActivateRound,
}: {
  items: AttentionItem[];
  busy?: boolean;
  onEndRound: () => void;
  onActivateRound: () => void;
}) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-border bg-card px-5 py-4">
        <CheckCircle2 className="size-5 shrink-0 text-success" />
        <div>
          <p className="text-[14px] font-semibold text-foreground">Nothing needs you right now</p>
          <p className="text-[12.5px] text-muted-foreground">
            The session is set up and the current round is running normally.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const look = LOOK[item.severity];
        const Icon = look.icon;
        const run =
          item.action === "endRound"
            ? onEndRound
            : item.action === "activateRound"
              ? onActivateRound
              : item.to
                ? () => navigate(item.to!)
                : undefined;

        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card px-4 py-3.5"
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                look.tint,
                look.fg
              )}
            >
              <Icon className="size-4.5" />
            </span>

            <div className="min-w-[240px] flex-1">
              <p className="text-[14px] font-semibold leading-5 text-foreground">{item.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-4 text-muted-foreground">{item.detail}</p>
            </div>

            {item.actionLabel && run && (
              <Button
                variant={item.severity === "blocked" || item.severity === "action" ? "primary" : "outline"}
                size="sm"
                onClick={run}
                loading={busy && !!item.action}
              >
                {item.actionLabel} <ArrowRight />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
