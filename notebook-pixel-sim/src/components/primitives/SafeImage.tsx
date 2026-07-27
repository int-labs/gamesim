import { ImgHTMLAttributes, useState } from 'react';
import clsx from 'clsx';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: PixelIconKind;
  fallbackSize?: number;
}

/**
 * Image that gracefully falls back to a code-only PixelIcon when the asset
 * fails to load. Prevents broken-image placeholders anywhere in the app.
 */
export function SafeImage({
  src,
  fallbackIcon = 'product',
  fallbackSize,
  className,
  alt,
  ...rest
}: Props) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <span
        className={clsx('inline-flex items-center justify-center text-text-2', className)}
        aria-label={alt}
        role={alt ? 'img' : undefined}
      >
        <PixelIcon kind={fallbackIcon} size={fallbackSize ?? 20} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}
