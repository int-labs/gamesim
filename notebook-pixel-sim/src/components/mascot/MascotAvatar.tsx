import { CSSProperties, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { MascotMood } from '@/types';
import { A } from '@/assets';

/**
 * MascotAvatar — a framed, head-cropped portrait of Amelia that feels alive.
 *
 * Two square (1254×1254) base frames — OPEN mouth (brighter expression) and
 * CLOSED mouth (clean neutral) — cropped to her head:
 *   • On appear she "talks" (the mouth lip-flaps) for a good while.
 *   • Once done she idles CLOSED, and opens her mouth on HOVER.
 *
 * Both frames are ALWAYS painted (two stacked layers) and we only toggle which
 * is on top — so the lip-flap is flicker-free (no background-image reload).
 *
 * `mood` is accepted for call-site compatibility but no longer drives the image
 * (every avatar is the consistent talking Amelia).
 */
const OPEN = A.mascot.base.talkOpen;
const CLOSED = A.mascot.base.talkClosed;
const TALK_MS = 4500; // how long she talks on appear
const FLAP_MS = 190; // mouth open/close cadence while talking

const CROP: CSSProperties = {
  backgroundRepeat: 'no-repeat',
  backgroundSize: '300%',
  backgroundPosition: '50% 7%',
  imageRendering: 'pixelated',
};

export function MascotAvatar({
  size = 64,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
}) {
  const [talking, setTalking] = useState(true);
  const [flapOpen, setFlapOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const flapRef = useRef<number | null>(null);

  useEffect(() => {
    flapRef.current = window.setInterval(() => setFlapOpen((o) => !o), FLAP_MS);
    const done = window.setTimeout(() => {
      if (flapRef.current) window.clearInterval(flapRef.current);
      flapRef.current = null;
      setTalking(false);
      setFlapOpen(false);
    }, TALK_MS);
    return () => {
      if (flapRef.current) window.clearInterval(flapRef.current);
      window.clearTimeout(done);
    };
  }, []);

  const mouthOpen = talking ? flapOpen : hover;

  return (
    <div
      aria-hidden
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={clsx(
        'relative shrink-0 overflow-hidden rounded-xl border-2 border-ink-900 bg-cream-100 shadow-pixel-soft',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* base = closed mouth, always visible */}
      <div className="absolute inset-0" style={{ ...CROP, backgroundImage: `url(${CLOSED})` }} />
      {/* open mouth layered on top, toggled by opacity (instant, no reload) */}
      <div
        className="absolute inset-0"
        style={{ ...CROP, backgroundImage: `url(${OPEN})`, opacity: mouthOpen ? 1 : 0 }}
      />
    </div>
  );
}
