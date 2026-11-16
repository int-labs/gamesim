import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedIcon } from "../../foundations/icon/AnimatedIcon";
import type { IconAnimationName } from "../../foundations/icon/animations";
import { Icon, type IconStroke } from "../../foundations/icon/Icon";
import type { ButtonSize } from "./buttonVariants";

export interface ButtonIconProps {
  /** An icon before the label. */
  iconStart?: LucideIcon;
  /** An icon after the label. */
  iconEnd?: LucideIcon;
  /** Plays on the icons when the button is hovered or focused. */
  iconAnimation?: IconAnimationName;
  /** Default `regular` (1.5 px). */
  iconStroke?: IconStroke;
}

function ButtonIcon({ icon, size, animation, stroke }: { icon: LucideIcon; size: ButtonSize; animation?: IconAnimationName; stroke: IconStroke }) {
  // The Figma icons are 14 px on the small link button and 16 px on every other button.
  const iconSize = size === "xs" ? "sm" : "md";
  return animation ? (
    <AnimatedIcon icon={icon} animation={animation} trigger="parent" size={iconSize} stroke={stroke} />
  ) : (
    <Icon icon={icon} size={iconSize} stroke={stroke} />
  );
}

/** The label with its icons. */
export function ButtonContent({
  size,
  iconStart,
  iconEnd,
  iconAnimation,
  iconStroke = "regular",
  children,
}: ButtonIconProps & { size: ButtonSize; children?: ReactNode }) {
  return (
    <>
      {iconStart ? <ButtonIcon icon={iconStart} size={size} animation={iconAnimation} stroke={iconStroke} /> : null}
      {children}
      {iconEnd ? <ButtonIcon icon={iconEnd} size={size} animation={iconAnimation} stroke={iconStroke} /> : null}
    </>
  );
}
