import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  locked?: boolean;
  warning?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  size?: 'sm' | 'md';
  tooltip?: string;
}

/**
 * Minimal selectable chip. Rest state is soft (no shadow). Selected state has
 * the strong border + soft shadow to draw attention without becoming noisy.
 */
export function PixelChip({
  selected,
  locked,
  warning,
  icon,
  label,
  meta,
  size = 'md',
  tooltip,
  className,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      title={tooltip}
      disabled={disabled || locked}
      className={clsx(
        'group inline-flex items-center gap-1.5 border transition-[transform,box-shadow,background-color] cursor-pointer',
        size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2',
        selected
          ? 'bg-surface border-border shadow-pixel-1 -translate-y-px'
          : 'bg-surface border-border-soft hover:border-border hover:-translate-y-px hover:shadow-pixel-1',
        warning && 'bg-danger-soft border-danger',
        locked && 'opacity-55 cursor-not-allowed',
        disabled && 'opacity-55',
        className,
      )}
      {...rest}
    >
      {icon ? <span className="flex shrink-0">{icon}</span> : null}
      <span className="chip-label text-text capitalize">{label}</span>
      {meta ? <span className="ml-auto text-[11px] text-text-3 font-medium">{meta}</span> : null}
      {selected && <span className="ml-1 text-primary text-[12px] leading-none font-bold">✓</span>}
    </button>
  );
}
