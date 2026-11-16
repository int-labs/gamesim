import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon, type IconSize, type IconStroke } from "../../foundations/icon/Icon";

export interface SpinnerProps {
  /** Default `md` (16 px). Buttons use `sm`, the 14 px of the Figma loader. */
  size?: IconSize;
  /** Default `bold` (2 px, as in Figma). */
  stroke?: IconStroke;
  /**
   * What is loading, for screen readers ("Loading simulations"). Leave it out when the spinner
   * sits inside something that already says it is busy, such as a button with aria-busy.
   */
  label?: string;
  className?: string;
}

/** A spinning arc in the text colour. */
export function Spinner({ size = "md", stroke = "bold", label, className }: SpinnerProps) {
  const arc = <Icon icon={LoaderCircle} size={size} stroke={stroke} className={cn("animate-spin", className)} />;
  if (!label) return arc;
  return (
    <span role="status" className="inline-flex">
      {arc}
      <span className="sr-only">{label}</span>
    </span>
  );
}
