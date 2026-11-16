import type { LucideIcon, LucideProps } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../../lib/cn";
import { tokens } from "../../tokens";

const ICON = tokens.component.icon;

export const iconSizes = {
  xs: parseFloat(ICON["size-xs"]),
  sm: parseFloat(ICON["size-sm"]),
  md: parseFloat(ICON["size-md"]),
  lg: parseFloat(ICON["size-lg"]),
  xl: parseFloat(ICON["size-xl"]),
  "2xl": parseFloat(ICON["size-2xl"]),
} as const;

export const iconStrokes = {
  thin: ICON["stroke-thin"],
  regular: ICON["stroke-regular"],
  bold: ICON["stroke-bold"],
} as const;

export type IconSize = keyof typeof iconSizes;
export type IconStroke = keyof typeof iconStrokes;

export interface IconProps
  extends Omit<LucideProps, "size" | "width" | "height" | "strokeWidth" | "absoluteStrokeWidth" | "ref"> {
  /** The glyph: a lucide-react icon (`import { Zap } from "lucide-react"`) or one of the design system's own. */
  icon: LucideIcon;
  /** Size from the icon scale, 12 to 28 px. Default `md` (16 px). */
  size?: IconSize;
  /** Stroke width in pixels, the same at every size. Default `thin`, the 1 px of the Figma icons. */
  stroke?: IconStroke;
  /**
   * What the icon means, for assistive technology. Leave it out when the icon only decorates text
   * next to it; the icon is then hidden from screen readers.
   */
  label?: string;
}

/** A lucide icon drawn at a token size with a constant stroke. It takes the text colour (currentColor). */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { icon: Glyph, size = "md", stroke = "thin", label, className, ...props },
  ref,
) {
  return (
    <Glyph
      ref={ref}
      size={iconSizes[size]}
      strokeWidth={iconStrokes[stroke]}
      absoluteStrokeWidth
      {...(label ? { role: "img", "aria-label": label } : {})}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
});
