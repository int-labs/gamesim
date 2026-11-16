import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useId, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from "react";
import { tv } from "../../lib/tv";
import { Button, type ButtonStatus } from "../../primitives/button/Button";
import { TextField } from "../../primitives/text-field/TextField";

/**
 * The Figma modal, measured: 520 px, white, 24 px corners with a pale lime 2 px edge inside and no
 * shadow, 32 px of padding, over the page dimmed to black 64% and blurred. A Poppins SemiBold 30
 * title (red 500 when the action destroys something: large text, 3.8:1), 12 px to the 18/23
 * message, 32 px to the actions at the right, Cancel first: 24 px apart beside a text Cancel,
 * 8 px beside an outlined one.
 */
export const dialogVariants = tv({
  slots: {
    backdrop: "fixed inset-0 z-modal scrim bg-surface-overlay backdrop-blur-overlay motion-reduce:transition-none",
    viewport: "fixed inset-0 z-modal flex items-center justify-center overflow-y-auto p-4",
    popup: [
      "relative flex max-h-full w-full flex-col gap-(--modal-gap) overflow-y-auto rounded-(--modal-radius) bg-surface-card p-(--modal-padding)",
      "inset-ring-(length:--modal-edge-width) inset-ring-(--modal-edge) outline-none dialog-motion motion-reduce:transition-none",
    ],
    header: "flex flex-col gap-3",
    title: "type-modal-title text-fg-primary",
    description: "type-modal-body text-fg-primary",
    footer: "flex flex-wrap items-center justify-end",
  },
  variants: {
    size: {
      md: { popup: "max-w-(--modal-width)" },
      lg: { popup: "max-w-(--modal-width-lg)" },
    },
    tone: {
      default: { footer: "gap-6" },
      danger: { title: "text-danger", footer: "gap-2" },
    },
  },
  defaultVariants: { size: "md", tone: "default" },
});

type DialogTone = "default" | "danger";

/** A dialog: open state, trigger and popup. Controlled with `open` and `onOpenChange`, or not. */
export const Dialog = BaseDialog.Root;
/** The button that opens a Dialog: render your own with `render={<Button>...}`. */
export const DialogTrigger = BaseDialog.Trigger;
/** A button that closes the Dialog it is in: `render={<Button variant="text">Cancel</Button>}`. */
export const DialogClose = BaseDialog.Close;

export interface DialogPopupProps {
  title: ReactNode;
  description?: ReactNode;
  /** The form or content between the message and the actions. */
  children?: ReactNode;
  /** The actions, Cancel first: Figma puts them at the right. */
  footer?: ReactNode;
  /** `lg` is the player's event modal. Default `md` (520 px). */
  size?: "md" | "lg";
  tone?: DialogTone;
  /** Where focus lands when the dialog opens. Default: the first control. */
  initialFocus?: RefObject<HTMLElement | null>;
}

/** The dialog itself, portalled over the page with its backdrop. Focus stays inside; Escape closes it. */
export function DialogPopup({ title, description, children, footer, size, tone, initialFocus }: DialogPopupProps) {
  const slots = dialogVariants({ size, tone });
  return (
    <BaseDialog.Portal data-ds-root="">
      <BaseDialog.Backdrop className={slots.backdrop()} />
      <BaseDialog.Viewport className={slots.viewport()}>
        <BaseDialog.Popup className={slots.popup()} initialFocus={initialFocus}>
          <div className={slots.header()}>
            <BaseDialog.Title className={slots.title()}>{title}</BaseDialog.Title>
            {description ? <BaseDialog.Description className={slots.description()}>{description}</BaseDialog.Description> : null}
          </div>
          {children}
          {footer ? <div className={slots.footer()}>{footer}</div> : null}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

export interface ConfirmDialogProps {
  /** Controlled open state; or leave it out and pass a `trigger`. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** "Start Round?", "Delete Event?". */
  title: ReactNode;
  /** What happens, and whether it can be undone. */
  description: ReactNode;
  /** The action ("Start Round", "Delete"). */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for an action that destroys something: red title and button, and focus starts on Cancel. */
  tone?: DialogTone;
  /**
   * Runs the action. The dialog closes when it resolves; while it runs the button shows its
   * spinner; if it throws, the dialog stays open for another try.
   */
  onConfirm: () => void | Promise<void>;
  /** Asks for this text to be typed before the action is allowed (a simulation's name, for deleting it). */
  confirmationText?: string;
  /** The label of that field. Default "Type {text} to confirm". */
  confirmationLabel?: string;
  /** The element that opens the dialog, when it is not controlled: a Button. */
  trigger?: ComponentProps<typeof AlertDialog.Trigger>["render"];
}

/**
 * A confirmation before an action that matters (start or end a round, suspend, revoke, delete).
 * It cannot be dismissed by clicking outside; Escape and Cancel close it.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  confirmationText,
  confirmationLabel,
  trigger,
  open,
  defaultOpen,
  onOpenChange,
}: ConfirmDialogProps) {
  const slots = dialogVariants({ tone });
  const cancelRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    // Not while the action runs: its result decides.
    if (!next && status === "loading") return;
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) setTyped("");
  };
  const confirmed = confirmationText === undefined || typed.trim() === confirmationText;
  const confirm = async () => {
    if (!confirmed || status === "loading") return;
    setStatus("loading");
    try {
      await onConfirm();
    } catch {
      // The dialog stays open so the action can be tried again; the caller shows the error.
      setStatus("idle");
      return;
    }
    setStatus("idle");
    if (open === undefined) setUncontrolledOpen(false);
    onOpenChange?.(false);
    setTyped("");
  };
  // Focus: the typed-name field when there is one; Cancel for a destructive action.
  const initialFocus = confirmationText !== undefined ? fieldRef : tone === "danger" ? cancelRef : undefined;
  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(next) => setOpen(next)}>
      {trigger ? <AlertDialog.Trigger render={trigger} /> : null}
      <AlertDialog.Portal data-ds-root="">
        <AlertDialog.Backdrop className={slots.backdrop()} />
        <AlertDialog.Viewport className={slots.viewport()}>
          <AlertDialog.Popup className={slots.popup()} initialFocus={initialFocus}>
            <div className={slots.header()}>
              <AlertDialog.Title className={slots.title()}>{title}</AlertDialog.Title>
              <AlertDialog.Description className={slots.description()}>{description}</AlertDialog.Description>
            </div>
            {confirmationText !== undefined ? (
              <TextField
                ref={fieldRef}
                id={fieldId}
                label={confirmationLabel ?? `Type ${confirmationText} to confirm`}
                value={typed}
                onChange={(event) => setTyped(event.currentTarget.value)}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void confirm();
                }}
              />
            ) : null}
            <div className={slots.footer()}>
              {/* Figma: a text Cancel beside the pink primary; an outlined Cancel beside the flat red Delete (both 40 px, 8 px corners). */}
              <AlertDialog.Close
                render={
                  tone === "danger" ? (
                    <Button ref={cancelRef} variant="outline" size="md" className="min-w-(--modal-action-width) rounded-lg">
                      {cancelLabel}
                    </Button>
                  ) : (
                    <Button ref={cancelRef} variant="text">
                      {cancelLabel}
                    </Button>
                  )
                }
              />
              {tone === "danger" ? (
                <Button
                  variant="flat"
                  tone="danger"
                  status={status}
                  disabled={!confirmed}
                  onClick={() => void confirm()}
                  className="min-w-(--modal-action-width)"
                >
                  {confirmLabel}
                </Button>
              ) : (
                <Button status={status} disabled={!confirmed} onClick={() => void confirm()} className="min-w-(--modal-confirm-width)">
                  {confirmLabel}
                </Button>
              )}
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export interface NoticeDialogProps {
  /** Controlled: the game decides when the notice shows. */
  open: boolean;
  /** "Round Ended". */
  title: ReactNode;
  /** What happened, and what it means for the player. */
  description: ReactNode;
  /** The one action: "Close", "See final results". Escape takes it too. */
  actionLabel: string;
  onAction: () => void;
}

/**
 * A notice the player takes in before going on (Figma's Round Ended, 2546:398382): the modal with
 * one pink action at the right. Clicking outside leaves it open; the action and Escape both take
 * the action, so the player is never left on a page the notice has already changed.
 */
export function NoticeDialog({ open, title, description, actionLabel, onAction }: NoticeDialogProps) {
  const slots = dialogVariants();
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onAction();
      }}
    >
      <AlertDialog.Portal data-ds-root="">
        <AlertDialog.Backdrop className={slots.backdrop()} />
        <AlertDialog.Viewport className={slots.viewport()}>
          <AlertDialog.Popup className={slots.popup()}>
            <div className={slots.header()}>
              <AlertDialog.Title className={slots.title()}>{title}</AlertDialog.Title>
              <AlertDialog.Description className={slots.description()}>{description}</AlertDialog.Description>
            </div>
            <div className={slots.footer()}>
              <Button onClick={onAction} className="min-w-(--modal-confirm-width)">
                {actionLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
