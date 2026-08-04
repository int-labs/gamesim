import { cn } from "@/lib/utils";

/**
 * The Int Labs wordmark, from the supplied artwork in /assets.
 *
 * The raw files are 8245×1672 PNGs (up to 3.5 MB). `scripts/build-brand-assets.mjs`
 * resizes and re-encodes them to WebP at three widths; 320w already covers a 3×
 * screen at the sizes used here, so that is the default source and the larger
 * ones only load when a layout actually asks for them via `sizes`.
 *
 * `tone` picks the artwork rather than recolouring it — the colour mark is a
 * pink→purple gradient that cannot be reproduced with a CSS filter, and the
 * white mark exists precisely because knocking the gradient out on navy or on
 * a photograph looks wrong.
 */
export function BrandLogo({
  tone = "color",
  className,
  width = 320,
}: {
  tone?: "color" | "white" | "black";
  /** Height is set by the caller through className; width keeps the ratio. */
  className?: string;
  /** Largest width the mark will be painted at, in CSS px (for srcset). */
  width?: number;
}) {
  const file = { color: "logo-color", white: "logo-white", black: "logo-black" }[tone];

  return (
    <img
      src={`/brand/${file}-320.webp`}
      srcSet={`/brand/${file}-320.webp 320w, /brand/${file}-640.webp 640w, /brand/${file}-1280.webp 1280w`}
      sizes={`${width}px`}
      // The mark reads as "int labs." — spelling it out keeps the meaning for
      // anyone who can't see it, without the redundant word "logo".
      alt="int labs."
      // 4.93:1 — reserves the right box before the image lands, so nothing shifts.
      width={493}
      height={100}
      decoding="async"
      className={cn("block h-auto w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}
