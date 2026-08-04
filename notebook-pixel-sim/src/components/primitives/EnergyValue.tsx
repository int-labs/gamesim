import clsx from 'clsx';
import { PixelIcon } from '@/components/icons/PixelIcon';

/**
 * An energy amount: the number, then the bolt.
 *
 * Replaces the literal "⚡" that was written inline in a dozen places. An emoji
 * is rendered by the OS emoji font, so it arrived full-colour and rounded in
 * the middle of a flat pixel UI, ignored every colour the surrounding text set,
 * and drew at a size no design token controlled. The icon here is the same
 * `energy` kind the rest of the app uses and inherits `currentColor`, so an
 * amount inside a warning chip, a dark button or a muted caption all look
 * right without any per-site handling.
 *
 * The number leads because it is the value; the bolt only says which unit.
 */
export function EnergyValue({
  amount,
  className,
  size = 12,
}: {
  amount: number;
  className?: string;
  /** Bolt size in px. Match it to the cap-height of the text beside it. */
  size?: number;
}) {
  return (
    <span className={clsx('inline-flex items-baseline gap-0.5 whitespace-nowrap', className)}>
      <span className="tabular-nums">{amount}</span>
      <PixelIcon kind="energy" size={size} color="currentColor" />
    </span>
  );
}
