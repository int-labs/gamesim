import { CSSProperties, ImgHTMLAttributes } from 'react';
import clsx from 'clsx';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'width' | 'height'> {
  src: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'cover' | number;
  state?: 'default' | 'hover' | 'selected' | 'disabled' | 'locked' | 'warning' | 'active' | 'new';
  className?: string;
  imgClassName?: string;
  containerStyle?: CSSProperties;
  alt?: string;
}

const sizeMap: Record<string, number> = {
  xs: 24,
  sm: 36,
  md: 48,
  lg: 72,
  xl: 96,
};

export function PixelImage({
  src,
  size = 'md',
  state = 'default',
  className,
  imgClassName,
  containerStyle,
  alt = '',
  ...rest
}: Props) {
  const isCover = size === 'cover';
  const px = typeof size === 'number' ? size : isCover ? undefined : sizeMap[size];
  return (
    <div
      data-state={state}
      className={clsx(
        'relative inline-flex items-center justify-center select-none',
        state === 'disabled' && 'grayscale opacity-55',
        state === 'locked' && 'grayscale opacity-70',
        state === 'warning' && 'animate-shakeX',
        state === 'new' && 'animate-popIn',
        className,
      )}
      style={{
        width: isCover ? '100%' : px,
        height: isCover ? '100%' : px,
        ...containerStyle,
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={clsx(
          'pointer-events-none',
          isCover ? 'w-full h-full object-contain' : 'max-w-full max-h-full object-contain',
          imgClassName,
        )}
        {...rest}
      />
      {state === 'locked' && (
        <span className="absolute -bottom-1 -right-1 bg-ink-900 text-cream-50 text-[10px] px-1 py-0.5 font-hud">🔒</span>
      )}
    </div>
  );
}
