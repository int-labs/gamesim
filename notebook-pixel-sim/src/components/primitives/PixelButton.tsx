import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'wood';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  full?: boolean;
}

/**
 * Minimal pixel button. Default state has a soft border with no shadow;
 * shadow appears on hover/active to reduce visual noise.
 */
const base =
  'relative inline-flex items-center justify-center gap-2 ' +
  'border-2 border-border select-none cursor-pointer ' +
  'transition-[transform,box-shadow,background-color,border-color,color] duration-150 ' +
  'hover:-translate-y-px hover:shadow-pixel-1 active:translate-y-0 active:shadow-none ' +
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-none';

// `primary` is the bright pastel with a DEEP ink label — see the long note on
// `.game-btn` in index.css. Dark-fill + cream-label passed contrast by exactly
// 0.01 and read as a disabled control, which is the worst possible look for the
// button the whole screen is pointing at.
const variants: Record<Variant, string> = {
  primary:   'bg-primary hover:brightness-105 active:brightness-95',
  secondary: 'bg-secondary-strong text-white hover:brightness-110 active:brightness-95',
  danger:    'bg-danger-strong text-white hover:brightness-105 active:brightness-95',
  ghost:     'bg-surface text-text hover:bg-surface-2',
  wood:      'bg-leather text-white hover:brightness-105 active:brightness-95',
};

const sizes: Record<Size, string> = {
  sm: 'btn-label-sm uppercase px-2.5 py-1.5',
  md: 'btn-label uppercase px-3.5 py-2',
  lg: 'btn-label uppercase px-5 py-2.5 body-xs',
};

export function PixelButton({
  variant = 'primary',
  size = 'md',
  icon,
  full,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={clsx(base, variants[variant], sizes[size], full && 'w-full', className)}
      // Cream is right on the three DARK fills and wrong on `primary`, which
      // is now a light fill. `ghost` keeps the theme's own text colour.
      style={{
        color:
          variant === 'ghost' ? undefined
          : variant === 'primary' ? '#12301C'
          : '#FAF7E8',
      }}
      {...rest}
    >
      {icon ? <span className="flex items-center shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
