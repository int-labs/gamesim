import { Button as BaseButton } from "@base-ui/react/button";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { AnimatedIcon } from "../../foundations/icon/AnimatedIcon";
import type { IconAnimationName } from "../../foundations/icon/animations";
import { Icon, type IconSize, type IconStroke } from "../../foundations/icon/Icon";
import { tv, type VariantProps } from "../../lib/tv";

export const iconButtonVariants = tv({
  base: [
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg transition duration-fast ease-standard",
    "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
    "data-disabled:cursor-not-allowed data-disabled:opacity-50",
  ],
  variants: {
    variant: {
      /** Icons on a surface: the sidebar toggle, edit and copy actions, the password eye, a row's menu. */
      ghost: [
        "text-fg-subtle not-data-disabled:hover:bg-surface-hover not-data-disabled:hover:text-fg-body",
        // While its menu is open; a tooltip marks its anchor data-popup-open too, but not aria-expanded.
        "aria-expanded:data-popup-open:bg-surface-hover aria-expanded:data-popup-open:text-fg-body",
      ],
      /** A bordered square (Preline _button_icon_small: white, a slate 300 edge): the menu button, toolbars. */
      outline: "border border-line-button bg-surface-card text-fg-body shadow-xs not-data-disabled:hover:bg-surface-hover aria-expanded:data-popup-open:bg-surface-hover",
    },
    size: {
      sm: "size-6",
      md: "size-8",
      lg: "size-10",
    },
  },
  defaultVariants: { variant: "ghost", size: "md" },
});

const iconSizeFor = { sm: "sm", md: "md", lg: "lg" } as const;

export interface IconButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseButton>, "className" | "children">,
    VariantProps<typeof iconButtonVariants> {
  icon: LucideIcon;
  /** What the button does ("Show password", "Collapse sidebar"). Required: the button has no text. */
  label: string;
  /** Plays on hover and focus. */
  animation?: IconAnimationName;
  /** Default `regular` (1.5 px). */
  stroke?: IconStroke;
  /** Overrides the icon size that goes with the button size (the sidebar toggle: 20 px in 32). */
  iconSize?: IconSize;
  className?: string;
}

/** A button that is only an icon, always with an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, animation, stroke = "regular", iconSize: iconSizeProp, variant, size = "md", className, ...props },
  ref,
) {
  const iconSize = iconSizeProp ?? iconSizeFor[size ?? "md"];
  return (
    <BaseButton ref={ref} aria-label={label} className={iconButtonVariants({ variant, size, className })} {...props}>
      {animation ? (
        <AnimatedIcon icon={icon} animation={animation} size={iconSize} stroke={stroke} />
      ) : (
        <Icon icon={icon} size={iconSize} stroke={stroke} />
      )}
    </BaseButton>
  );
});
