import { Copy, Eye, KeyRound } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * Pass keys unmask only while held for 400 ms — deliberate friction against
 * shoulder-surfing and accidental screenshots (spec §10.6). Copy is offered
 * only once revealed, so a masked value can never be lifted blindly.
 */
export function PasskeyCell({
  passkey,
  missingLabel = "No pass key",
  className,
}: {
  passkey?: string | null;
  missingLabel?: string;
  className?: string;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();

  const start = () => {
    timer.current = setTimeout(() => setRevealed(true), 400);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    setRevealed(false);
  };

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  if (!passkey) {
    return (
      <Badge tone="warning" size="sm" className="gap-1">
        <KeyRound className="size-3" />
        {missingLabel}
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onKeyDown={(e) => e.key === "Enter" && setRevealed(true)}
        onKeyUp={stop}
        aria-label={revealed ? `Pass key ${passkey}` : "Hold to reveal pass key"}
        className="inline-flex h-[26px] items-center gap-1.5 rounded-xs border border-border bg-muted px-2 font-mono text-[12px] text-foreground transition-colors hover:border-primary/40"
      >
        {revealed ? passkey : "••••••••"}
        <Eye className="size-3 text-muted-foreground" />
      </button>
      {revealed && (
        <IconButton
          label="Copy pass key"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(passkey);
            toast.success("Pass key copied");
          }}
        >
          <Copy />
        </IconButton>
      )}
    </div>
  );
}
