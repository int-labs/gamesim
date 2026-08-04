import { ImgHTMLAttributes, useState, useCallback } from 'react';
import clsx from 'clsx';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: PixelIconKind;
  fallbackSize?: number;
  /**
   * Show a calm loading skeleton in the reserved box until the bytes decode.
   * Default true. Pass false for tiny inline images (a skeleton there is noise)
   * or images whose box has no reserved size (a w-auto logo can't show one).
   */
  skeleton?: boolean;
}

/**
 * Image that (1) reads as "loading" instead of a blank/empty box while its
 * bytes arrive, and (2) gracefully falls back to a code-only PixelIcon when the
 * asset fails. The skeleton is a background on the <img> itself (no wrapper, so
 * every caller's sizing/object-fit is preserved) and is REMOVED the instant the
 * image decodes — so transparent PNGs are never tinted by it. No image quality
 * is touched: the same full-resolution asset loads, it just doesn't flash empty.
 */
export function SafeImage({
  src,
  fallbackIcon = 'product',
  fallbackSize,
  className,
  alt,
  skeleton = true,
  onLoad,
  ...rest
}: Props) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // A cached image can complete BEFORE React attaches onLoad, which would leave
  // it stuck showing the skeleton forever. The ref callback catches that case
  // (img.complete on mount) so cached images resolve instantly.
  const captureRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

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
      ref={captureRef}
      src={src}
      alt={alt}
      className={clsx(className, skeleton && !loaded && 'img-skeleton')}
      // Decode off the main thread so a heavy image doesn't stall interaction.
      decoding="async"
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}
