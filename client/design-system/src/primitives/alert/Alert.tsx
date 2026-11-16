import { CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv, type VariantProps } from "../../lib/tv";
import { IconButton } from "../icon-button/IconButton";

/**
 * The Preline soft alert of the Figma file: a tinted panel with a matching edge, 12 px corners,
 * 16 px padding. The edge is an inset ring, as Figma's inside stroke: it takes nothing from the padding.
 */
export const alertVariants = tv({
  slots: {
    root: "flex w-full items-start gap-(--alert-gap) rounded-(--alert-radius) p-(--alert-padding) inset-ring",
    icon: "flex h-(--text-sm--line-height) shrink-0 items-center",
    body: "flex min-w-0 flex-1 flex-col gap-1",
    title: "type-body font-semibold",
    description: "type-body",
    actions: "mt-2 flex flex-wrap items-center gap-2",
    dismiss: "-my-1 -me-1 text-current not-data-disabled:hover:bg-current/8 not-data-disabled:hover:text-current",
  },
  variants: {
    tone: {
      info: { root: "bg-info-soft text-info-soft-fg inset-ring-line-info-soft" },
      success: { root: "bg-success-soft text-success-soft-fg inset-ring-line-success-soft" },
      warning: { root: "bg-warning-soft text-warning-soft-fg inset-ring-line-warning-soft" },
      danger: { root: "bg-danger-soft text-danger-soft-fg inset-ring-line-danger-soft" },
      neutral: { root: "bg-neutral-soft text-neutral-soft-fg inset-ring-line" },
    },
  },
  defaultVariants: { tone: "info" },
});

type AlertTone = NonNullable<VariantProps<typeof alertVariants>["tone"]>;

const toneIcons: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: TriangleAlert,
  neutral: Info,
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof alertVariants> {
  /** A short heading in bold. */
  title?: ReactNode;
  /** Replaces the tone's icon; `null` shows none. */
  icon?: LucideIcon | null;
  /** Buttons under the message (retry, undo). */
  actions?: ReactNode;
  /** Shows a close button that calls this. */
  onDismiss?: () => void;
  /** Label of the close button. Default "Dismiss". */
  dismissLabel?: string;
}

/**
 * A message in the flow of the page. Errors and warnings are announced at once (role alert),
 * information and success politely (role status).
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { tone = "info", title, icon, actions, onDismiss, dismissLabel = "Dismiss", className, children, ...props },
  ref,
) {
  const slots = alertVariants({ tone });
  const glyph = icon === undefined ? toneIcons[tone] : icon;
  const urgent = tone === "danger" || tone === "warning";
  return (
    <div ref={ref} role={urgent ? "alert" : "status"} className={slots.root({ className })} {...props}>
      {glyph ? (
        <span className={slots.icon()}>
          <Icon icon={glyph} size="md" stroke="regular" />
        </span>
      ) : null}
      <div className={slots.body()}>
        {title ? <p className={slots.title()}>{title}</p> : null}
        {children ? <div className={slots.description()}>{children}</div> : null}
        {actions ? <div className={slots.actions()}>{actions}</div> : null}
      </div>
      {onDismiss ? <IconButton icon={X} label={dismissLabel} size="sm" className={slots.dismiss()} onClick={onDismiss} /> : null}
    </div>
  );
});
