import { ImgHTMLAttributes, useState } from 'react';
import clsx from 'clsx';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading'> {
  /**
   * Loading priority.
   *   - `'eager'` issues the request as soon as the element mounts and
   *     hints `fetchpriority="high"` so the browser prefers it. Use for
   *     above-the-fold imagery (active notebook, mascot in tutorial,
   *     route hero backgrounds).
   *   - `'lazy'` (default) tells the browser to defer until close to
   *     the viewport. Use for everything else (notebook thumbnails in
   *     a long list, add-on tiles, mascot expressions for not-yet-shown
   *     bubbles).
   */
  priority?: 'eager' | 'lazy';
  /** Optional URL to render if the primary src fails. */
  fallbackSrc?: string;
  /** Code-only fallback shown when both primary and fallbackSrc fail. */
  fallbackIcon?: PixelIconKind;
  fallbackIconSize?: number;
  /** Aspect ratio (W:H) reserved before the image loads to avoid layout shift. */
  aspectRatio?: string;
  /** When true, fade in once the bytes are decoded. Default true. */
  fadeIn?: boolean;
}

/**
 * SmartPixelImage — the standard image primitive.
 *
 * Designed so future surfaces (more notebook variants, more add-ons,
 * future product categories) can drop it in without rethinking loading
 * behavior:
 *
 *   • <img loading="lazy" decoding="async" fetchpriority=…> hints
 *     handle the actual fetch scheduling — no JS observers needed
 *   • a stable wrapper holds the layout box (aspect-ratio + width/
 *     height) so panels don't reshuffle when bytes arrive
 *   • fades in via opacity transition once decoded
 *   • on error, swaps to `fallbackSrc` once; if that also fails,
 *     shows a `PixelIcon` glyph — no broken-image icons ever
 *   • `image-rendering: pixelated` is set on every image — preserves
 *     the pixel-art aesthetic at any zoom
 *
 * Backward-compat: existing `SafeImage` stays as-is. New code should
 * prefer `SmartPixelImage`.
 */
export function SmartPixelImage({
  src,
  alt,
  priority = 'lazy',
  fallbackSrc,
  fallbackIcon = 'product',
  fallbackIconSize,
  aspectRatio,
  fadeIn = true,
  className,
  style,
  width,
  height,
  onLoad,
  onError,
  ...rest
}: Props) {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'failed'>('primary');
  const [loaded, setLoaded] = useState(false);

  const effectiveSrc =
    stage === 'primary' ? src
    : stage === 'fallback' ? fallbackSrc
    : undefined;

  // Fully failed — no usable image. Render the code-only icon.
  if (!effectiveSrc) {
    return (
      <span
        className={clsx('inline-flex items-center justify-center bg-surface-2 text-text-2', className)}
        style={{ ...(style ?? {}), aspectRatio, width, height }}
        aria-label={alt}
        role={alt ? 'img' : undefined}
      >
        <PixelIcon kind={fallbackIcon} size={fallbackIconSize ?? 18} />
      </span>
    );
  }

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      width={width}
      height={height}
      loading={priority === 'eager' ? 'eager' : 'lazy'}
      // `decoding="async"` lets the browser decode off the main thread
      // so the request doesn't stall input. Safe everywhere.
      decoding="async"
      // Browser hint — supported in Chromium / Safari TP. Helps prioritize
      // requests for above-the-fold imagery without blocking lazy ones.
      // @ts-expect-error fetchpriority isn't in the React types yet
      fetchpriority={priority === 'eager' ? 'high' : 'low'}
      className={clsx(
        'pixelated-img',
        fadeIn && (loaded ? 'opacity-100' : 'opacity-0'),
        fadeIn && 'transition-opacity duration-150',
        className,
      )}
      style={{
        imageRendering: 'pixelated',
        aspectRatio,
        ...(style ?? {}),
      }}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        if (stage === 'primary' && fallbackSrc) {
          setStage('fallback');
        } else {
          setStage('failed');
        }
        // Surface the failure once in dev so missing assets are visible.
        if ((import.meta as any).env?.DEV) console.warn(`[SmartPixelImage] failed to load:`, effectiveSrc);
        onError?.(e);
      }}
      {...rest}
    />
  );
}
