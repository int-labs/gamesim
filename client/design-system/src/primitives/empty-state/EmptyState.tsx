import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv, type VariantProps } from "../../lib/tv";

/**
 * Where there is nothing to show yet: the Figma "No Event Listed in Current Round" and "Round has
 * not started", a quiet 16/24 message centred in the space the content will fill. Figma draws it
 * in gray 800 at 40% (2.4:1 on white); it uses gray 500 (4.8:1).
 */
export const emptyStateVariants = tv({
  slots: {
    root: "flex flex-1 flex-col items-center justify-center gap-2 text-center",
    icon: "mb-1 text-fg-faint",
    title: "text-fg-subtle",
    description: "max-w-md type-body text-fg-subtle",
    actions: "mt-2 flex flex-wrap items-center justify-center gap-3",
  },
  variants: {
    size: {
      /** Inside a chart or a short list: the message alone. */
      sm: { root: "p-4", title: "type-body-lg" },
      /** A whole panel: room for an icon, a line of help and an action. */
      md: { root: "px-6 py-12", title: "type-heading-sm text-fg-muted" },
    },
  },
  defaultVariants: { size: "sm" },
});

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof emptyStateVariants> {
  /** What is missing, or why ("Round has not started"). */
  title: ReactNode;
  /** A line of help under the title. */
  description?: ReactNode;
  /** A drawing above the title, for a whole panel. */
  icon?: LucideIcon;
  /** What to do about it ("Add Event"). */
  actions?: ReactNode;
}

/** A message that stands in for content that does not exist yet. */
export function EmptyState({ title, description, icon, actions, size, className, ...props }: EmptyStateProps) {
  const slots = emptyStateVariants({ size });
  return (
    <div className={slots.root({ className })} {...props}>
      {icon ? <Icon icon={icon} size="2xl" className={slots.icon()} /> : null}
      <p className={slots.title()}>{title}</p>
      {description ? <p className={slots.description()}>{description}</p> : null}
      {actions ? <div className={slots.actions()}>{actions}</div> : null}
    </div>
  );
}
