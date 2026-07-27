import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  toolbar?: ReactNode;
  tone?: 'cream' | 'paper' | 'ink' | 'ui-warm';
  padded?: boolean;
}

const tones: Record<NonNullable<Props['tone']>, string> = {
  cream: 'bg-surface',
  paper: 'bg-surface-2',
  ink: 'bg-text text-white',
  'ui-warm': 'bg-surface-muted',
};

/**
 * Soft default panel. Border only, no shadow at rest. The panel header is
 * subtle and uses uppercase tracking — hierarchy comes from spacing & weight.
 */
export function PixelPanel({ title, toolbar, tone = 'cream', padded = true, className, children, ...rest }: Props) {
  return (
    <div className={clsx('panel', tones[tone], className)} {...rest}>
      {(title || toolbar) && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border-soft bg-surface-2">
          {title && <div className="panel-title">{title}</div>}
          {toolbar && <div className="flex items-center gap-1">{toolbar}</div>}
        </div>
      )}
      <div className={clsx(padded ? 'p-3.5' : '')}>{children}</div>
    </div>
  );
}
