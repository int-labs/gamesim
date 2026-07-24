import { LucideIcon } from 'lucide-react';

interface Props {
  /**
   * The lucide icon component to render. Pass the icon directly:
   *
   *   <NavIcon icon={Wallet} />
   *
   * Importing a named icon is fully tree-shakeable in lucide-react —
   * unused icons don't ship in the bundle.
   */
  icon: LucideIcon;
  /** Pixel size. Default 14, the standard navbar chip size. */
  size?: number;
  /** Stroke color. Defaults to currentColor so text-color cascades. */
  color?: string;
  /**
   * Stroke width. Default 2 — matches the rest of the warm pixel theme
   * without looking too thin or too heavy. We don't expose this widely
   * because consistency across surfaces is the whole point.
   */
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

/**
 * NavIcon — single wrapper around lucide-react so every navbar /
 * tab / chip / button icon shares the same size and stroke weight by
 * default. Replaces ad-hoc `<PixelIcon>` usage in places where the
 * pixel rendering was unclear (most numeric chips and tab labels).
 *
 * `PixelIcon` is still used for in-content actions (×, +, ↥, ↧, ✓)
 * where a chunky pixel glyph reads better than a thin line icon.
 */
export function NavIcon({
  icon: Icon,
  size = 14,
  color = 'currentColor',
  strokeWidth = 2,
  className,
  'aria-hidden': ariaHidden = true,
}: Props) {
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={ariaHidden}
      // Lucide icons render slightly wider than they are tall by
      // default; force a square box so chip alignment stays clean.
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}
