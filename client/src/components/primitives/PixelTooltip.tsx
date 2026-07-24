import { ReactNode, useState } from 'react';
import clsx from 'clsx';

interface Props {
  text: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  className?: string;
}

export function PixelTooltip({ text, side = 'top', children, className }: Props) {
  const [open, setOpen] = useState(false);
  const placement: Record<string, string> = {
    top: 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
    bottom: 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
    left: 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2',
    right: 'left-[calc(100%+6px)] top-1/2 -translate-y-1/2',
  };
  return (
    <span
      className={clsx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && text && (
        <span
          className={clsx(
            'absolute z-50 max-w-[220px] px-2 py-1 border-2 border-ink-900 bg-cream-50 text-[11px] leading-tight font-body shadow-pixel-2 pointer-events-none',
            placement[side],
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
