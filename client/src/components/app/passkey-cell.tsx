import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

/**
 * A team's pass key: masked by default, revealed on click, re-masked on its own.
 *
 * ── WHY THIS WAS REWRITTEN ──────────────────────────────────────────────────
 * The previous version unmasked only while the button was held for 400 ms, and
 * that made it unusable in three compounding ways:
 *
 *   1. Nothing said "hold" — it looked like an ordinary button.
 *   2. `onPointerLeave` cancelled the hold, so a pixel of mouse drift re-masked it.
 *   3. Copy rendered only while revealed, and revealing ended on pointer-UP —
 *      so Copy appeared and vanished in the same instant and could never
 *      actually be clicked.
 *
 * The friction it was buying (against shoulder-surfing and screenshots) is kept,
 * just built from things that work: masked until asked, one click to show, and
 * an automatic re-mask so a key is never left on screen at the front of a room.
 */

/** Long enough to read aloud to a team, short enough not to linger. */
const AUTO_HIDE_MS = 10_000;

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
  const [copied, setCopied] = React.useState(false);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout>>();
  const copyTimer = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const toggle = () => {
    setRevealed((was) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (was) return false;
      hideTimer.current = setTimeout(() => setRevealed(false), AUTO_HIDE_MS);
      return true;
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(passkey!);
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
      toast.success("Pass key copied");
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // Reveal instead of failing silently, so the key can still be read out.
      setRevealed(true);
      toast.error("Couldn't copy — showing the key instead");
    }
  };

  if (!passkey) {
    return (
      <Badge tone="warning" size="sm" className="gap-1">
        <KeyRound className="size-3" />
        {missingLabel}
      </Badge>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      // The cell sits in a clickable row; revealing a key must not also
      // navigate away from the page showing it.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={toggle}
        title={revealed ? "Hide pass key" : "Show pass key"}
        aria-label={revealed ? `Pass key ${passkey}. Click to hide.` : "Show pass key"}
        className="inline-flex h-[26px] items-center gap-1.5 rounded-xs border border-border bg-muted px-2 font-mono text-[12px] text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {revealed ? passkey : "••••••••"}
        {revealed ? (
          <EyeOff className="size-3 text-muted-foreground" />
        ) : (
          <Eye className="size-3 text-muted-foreground" />
        )}
      </button>

      {/* Always available — copying hands the key over without anyone having to
          read it aloud, which is the safer of the two ways to share it. */}
      <IconButton label="Copy pass key" size="sm" onClick={copy}>
        {copied ? <Check className="text-success" /> : <Copy />}
      </IconButton>
    </div>
  );
}
