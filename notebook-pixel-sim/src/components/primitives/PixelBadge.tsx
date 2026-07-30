import { ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  tone?: 'success' | 'warn' | 'error' | 'info' | 'neutral' | 'brand';
  children: ReactNode;
  className?: string;
}

const tones = {
  success: 'bg-success-soft text-text border-success',
  warn:    'bg-warning-soft text-text border-warning',
  error:   'bg-danger-soft text-text border-danger',
  info:    'bg-info-soft text-text border-info',
  neutral: 'bg-surface text-text-2 border-border-soft',
  brand:   'bg-secondary-soft text-text border-secondary',
};

export function PixelBadge({ tone = 'neutral', children, className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-[2px] border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
