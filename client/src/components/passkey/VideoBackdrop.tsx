import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';

/**
 * VideoBackdrop — a looping background video that crossfades in over a
 * static poster image.
 *
 * Design goals:
 *   • The poster shows INSTANTLY and is always present, so the screen is
 *     usable and legible before (or instead of) the video.
 *   • The video only fades in once it can actually play through — no
 *     half-buffered jank.
 *   • If the video errors / 404s / stalls, or the user prefers reduced
 *     motion, we silently stay on the poster. The form never depends on it.
 *
 * Purely decorative → the whole layer is aria-hidden.
 */
interface Props {
  poster: string;
  videoMp4?: string;
  videoWebm?: string;
  /** object-position focal point, e.g. 'center' or '50% 45%'. */
  focal?: string;
  className?: string;
}

export function VideoBackdrop({ poster, videoMp4, videoWebm, focal = 'center', className }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const wantVideo = !!videoMp4 && !reduced && !failed;

  useEffect(() => {
    if (!wantVideo) return;
    const v = ref.current;
    if (!v) return;
    const onReady = () => setReady(true);
    const onError = () => setFailed(true);
    v.addEventListener('canplaythrough', onReady);
    v.addEventListener('loadeddata', onReady);
    v.addEventListener('error', onError);
    // Some browsers fire the error on the <source>, not the <video>.
    Array.from(v.querySelectorAll('source')).forEach((s) =>
      s.addEventListener('error', onError),
    );
    v.load();
    const p = v.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked → poster stays */ });
    return () => {
      v.removeEventListener('canplaythrough', onReady);
      v.removeEventListener('loadeddata', onReady);
      v.removeEventListener('error', onError);
    };
  }, [wantVideo]);

  return (
    <div aria-hidden className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* Poster — instant, accessible, and the permanent fallback. */}
      <img
        src={poster}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: focal }}
      />

      {/* Video — crossfades in over the poster once buffered. */}
      {wantVideo && (
        <video
          ref={ref}
          muted
          loop
          playsInline
          preload="auto"
          poster={poster}
          tabIndex={-1}
          className={clsx(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-[600ms] ease-out',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          style={{ objectPosition: focal }}
        >
          {videoWebm && <source src={videoWebm} type="video/webm" />}
          {videoMp4 && <source src={videoMp4} type="video/mp4" />}
        </video>
      )}

      {/* Subtle "loading ambiance" shimmer while the video buffers. */}
      {wantVideo && !ready && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background:
              'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.05) 50%, transparent 65%)',
          }}
        />
      )}
    </div>
  );
}
