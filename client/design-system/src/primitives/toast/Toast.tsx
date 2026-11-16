import { Toast, type ToastManager } from "@base-ui/react/toast";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { tokens } from "../../tokens";
import { IconButton } from "../icon-button/IconButton";

export type ToastTone = "info" | "success" | "warning" | "danger";

/**
 * `admin`: the Preline soft alert of the Admin screens. `player`: the bolder pill of the player
 * screens, its icon in a ringed circle and its message semibold.
 */
export type ToastVariant = "admin" | "player";

/**
 * How long a toast stays: the Figma note says two seconds, which suits news; warnings and errors
 * stay five, long enough to read and act. A toast never leaves while it is hovered or focused.
 */
const durations: Record<ToastTone, number> = {
  info: parseFloat(tokens.component.toast.duration),
  success: parseFloat(tokens.component.toast.duration),
  warning: 5000,
  danger: 5000,
};

const icons: Record<ToastVariant, Record<ToastTone, LucideIcon>> = {
  admin: { info: Info, success: CircleCheck, warning: TriangleAlert, danger: TriangleAlert },
  player: { info: Info, success: CircleCheck, warning: CircleAlert, danger: CircleAlert },
};

/** The Figma toasts, measured on the Admin and player screens (component.toast tokens). */
export const toastVariants = tv({
  slots: {
    root: [
      "pointer-events-auto flex max-w-(--toast-max-width) gap-(--toast-gap) rounded-(--toast-radius)",
      "toast-motion motion-reduce:transition-none data-limited:hidden",
    ],
    icon: "flex shrink-0 items-center justify-center",
    body: "flex min-w-0 flex-col",
    title: "type-body-lg",
    description: "type-body",
    close: "-my-1 -me-2 self-center text-current not-data-disabled:hover:bg-current/8 not-data-disabled:hover:text-current",
  },
  variants: {
    variant: {
      // The strokes are inset rings, as Figma's inside strokes: they take nothing from the padding.
      admin: { root: "items-start p-(--toast-padding) inset-ring", icon: "h-6" },
      player: {
        root: "items-center px-(--toast-padding) py-(--toast-padding-y-player) inset-ring-(length:--toast-border-width-player)",
        icon: "size-(--toast-ring-size) rounded-full border-(length:--toast-ring-width)",
        title: "font-semibold",
      },
    },
    tone: {
      info: { root: "bg-info-soft text-(--toast-info-text) inset-ring-line-info-soft", icon: "text-fg-info border-(--toast-info-ring)" },
      success: {
        root: "bg-success-soft text-(--toast-success-text) inset-ring-line-success-soft",
        icon: "text-success-soft-fg border-(--toast-success-ring)",
      },
      warning: {
        root: "bg-warning-soft text-(--toast-warning-text) inset-ring-line-warning-soft",
        icon: "text-warning-soft-fg border-(--toast-warning-ring)",
      },
      danger: { root: "bg-danger-soft text-(--toast-danger-text) inset-ring-line-danger-soft", icon: "text-danger-soft-fg border-(--toast-danger-ring)" },
    },
  },
  compoundVariants: [
    // The player's success toast has a strong teal edge; its other tones keep the soft one.
    { variant: "player", tone: "success", class: { root: "inset-ring-(--toast-success-border-player)" } },
  ],
  defaultVariants: { variant: "admin", tone: "info" },
});

export interface ToastOptions {
  /** A second line under the message. */
  description?: ReactNode;
  /** In milliseconds; 0 keeps the toast, with a close button, until it is closed. */
  duration?: number;
  /** Replaces the kind's icon, as the Figma "Downloading..." toast does with its download arrow. */
  icon?: LucideIcon;
}

/** What each toast carries besides its text. */
interface ToastData {
  icon?: LucideIcon;
}

export interface Toaster {
  show: (tone: ToastTone, message: ReactNode, options?: ToastOptions) => string;
  info: (message: ReactNode, options?: ToastOptions) => string;
  success: (message: ReactNode, options?: ToastOptions) => string;
  warning: (message: ReactNode, options?: ToastOptions) => string;
  error: (message: ReactNode, options?: ToastOptions) => string;
  close: (id: string) => void;
}

type Manager = Pick<ToastManager<ToastData>, "add" | "close">;

function toasterFor(manager: Manager): Toaster {
  const show = (tone: ToastTone, message: ReactNode, options: ToastOptions = {}) =>
    manager.add({
      type: tone,
      title: message,
      description: options.description,
      timeout: options.duration ?? durations[tone],
      // Errors and warnings are announced at once, other news politely.
      priority: tone === "danger" || tone === "warning" ? "high" : "low",
      data: { icon: options.icon },
    });
  return {
    show,
    info: (message, options) => show("info", message, options),
    success: (message, options) => show("success", message, options),
    warning: (message, options) => show("warning", message, options),
    error: (message, options) => show("danger", message, options),
    close: (id) => manager.close(id),
  };
}

/**
 * A toaster that works outside React too (an API client, for example). Pass `manager` to
 * ToastProvider so its toasts appear on the page.
 */
export function createToaster(): Toaster & { manager: ToastManager<ToastData> } {
  const manager = Toast.createToastManager<ToastData>();
  return { ...toasterFor(manager), manager };
}

/**
 * Shows toasts from a component inside ToastProvider: toast.success("Decisions saved"). The toaster
 * keeps its identity while toasts come and go, so it can sit in an effect's dependencies.
 */
export function useToast(): Toaster {
  const { add, close } = Toast.useToastManager<ToastData>();
  return useMemo(() => toasterFor({ add, close }), [add, close]);
}

function ToastList({ variant, dismissLabel }: { variant: ToastVariant; dismissLabel: string }) {
  const { toasts } = Toast.useToastManager<ToastData>();
  return toasts.map((toast) => {
    const tone = (toast.type as ToastTone | undefined) ?? "info";
    const slots = toastVariants({ variant, tone });
    return (
      <Toast.Root key={toast.id} toast={toast} className={slots.root()}>
        <span className={slots.icon()}>
          <Icon icon={toast.data?.icon ?? icons[variant][tone]} size={variant === "player" ? "lg" : "md"} stroke="regular" />
        </span>
        <Toast.Content className={slots.body()}>
          <Toast.Title className={slots.title()} />
          {toast.description ? <Toast.Description className={slots.description()} /> : null}
        </Toast.Content>
        {/* The Figma toasts leave by themselves and show no close button; one that stays gets one. */}
        {toast.timeout === 0 ? <Toast.Close render={<IconButton icon={X} label={dismissLabel} size="sm" className={slots.close()} />} /> : null}
      </Toast.Root>
    );
  });
}

export interface ToastProviderProps {
  children: ReactNode;
  /** A manager from createToaster(), to show toasts from outside React. */
  manager?: ToastManager<ToastData>;
  /** `admin` (default) or `player`: the look of the app's toasts. */
  variant?: ToastVariant;
  /** Most toasts on screen at once. Default 3. */
  limit?: number;
  /** Label of the close button of a toast that stays. Default "Dismiss". */
  dismissLabel?: string;
}

/**
 * Mount once at the root: toasts appear centred on the window, 40 px above its bottom, the newest
 * lowest, above everything but tooltips. F6 moves to them, Escape closes the one in focus, and a
 * swipe down or to the right dismisses one.
 */
export function ToastProvider({ children, manager, variant = "admin", limit = 3, dismissLabel = "Dismiss" }: ToastProviderProps) {
  return (
    <Toast.Provider toastManager={manager} limit={limit}>
      {children}
      <Toast.Portal data-ds-root="">
        <Toast.Viewport
          data-toast-viewport=""
          className="pointer-events-none fixed inset-x-0 bottom-(--toast-offset) z-toast flex flex-col-reverse items-center gap-2 px-4"
        >
          <ToastList variant={variant} dismissLabel={dismissLabel} />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
