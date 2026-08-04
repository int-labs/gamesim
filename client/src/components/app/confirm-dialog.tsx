import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/overlays";
import { Label } from "@/components/ui/primitives";

/**
 * M11 ConfirmDialog. Copy states the consequence, not ceremony (§14).
 * `confirmText` forces type-to-confirm for cascading deletes.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  confirmText,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  loading?: boolean;
  /** May return a promise; the dialog closes when it resolves, stays open if
   *  it rejects so the failure message isn't hidden behind a closing dialog. */
  onConfirm: () => void | Promise<unknown>;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const blocked = !!confirmText && typed.trim() !== confirmText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="max-w-[460px]">
        <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-destructive-tint">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>

        {confirmText && (
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="confirm-input">
              Type <span className="font-mono text-destructive">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={blocked}
            loading={loading}
            onClick={async () => {
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* the mutation layer already surfaced why */
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
