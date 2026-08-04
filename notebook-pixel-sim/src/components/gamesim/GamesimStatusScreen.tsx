// The screens the player sees BEFORE the game mounts: booting, waiting for the
// facilitator to open a round, and the two failure states. They used to be a
// bare <h2> on a cream background with inline styles, which read as a crash.
//
// This lives outside AppShell (GamesimProvider gates everything below it), so
// it can't rely on anything from the game store — only assets and CSS.
//
// Deliberately ONE idea: Amelia, waiting with you. An earlier version fanned
// the notebook catalogue across the top, which competed with the message and
// made a simple "please hold" screen busier than the game behind it.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { A } from '@/assets';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { PixelButton } from '@/components/primitives';

/** Shown while booting, so the wait teaches something instead of stalling. */
const TIPS = [
  'Every market grows. The trick is picking the one that grows fastest.',
  'Cheap to make is not the same as profitable. Watch the margin, not the cost.',
  'Stock you never sell is cash you already spent.',
  'Price is a signal. Too low reads as cheap, too high reads as wrong.',
  'A notebook aimed at everyone tends to sell to no one.',
  'Revenue pays the ego. Cash pays the bills.',
];

interface Props {
  title: string;
  subtitle?: string;
  /** Renders a Retry button when provided. */
  retry?: () => void;
  /** 'error' stops the loader and holds the message still. */
  tone?: 'busy' | 'waiting' | 'error';
}

export function GamesimStatusScreen({ title, subtitle, retry, tone = 'busy' }: Props) {
  const [tip, setTip] = useState(0);

  // Rotate tips only while genuinely waiting — a failed state should hold
  // still so the message stays readable.
  useEffect(() => {
    if (tone === 'error') return undefined;
    const t = window.setInterval(() => setTip((n) => (n + 1) % TIPS.length), 4200);
    return () => window.clearInterval(t);
  }, [tone]);

  return (
    <div className="fixed inset-0 overflow-hidden flex items-center justify-center p-6">
      <img
        src={A.env.deskFull}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-ink-900/45" />

      <motion.div
        className="relative z-10 w-full max-w-[460px] pixel-frame bg-cream-50 px-7 pt-8 pb-7 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      >
        {/* Amelia is the whole illustration now, at a size that reads as a
            character rather than an avatar chip. */}
        <motion.div
          animate={tone === 'error' ? { y: 0 } : { y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <MascotAvatar mood="thinking_side" size={132} />
        </motion.div>

        <h2 className="h2 uppercase text-ink-900 mt-5">{title}</h2>

        {subtitle && (
          <p className="body-sm text-text-2 mt-2.5 max-w-[38ch]">{subtitle}</p>
        )}

        {/* One line from Amelia, swapped on a timer while waiting. */}
        <motion.p
          key={tone === 'error' ? 'err' : tip}
          className="body-xs text-text-3 mt-4 max-w-[40ch] min-h-[2.6em]"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {tone === 'error'
            ? "I'll wait here. Give it another go when you're ready."
            : TIPS[tip]}
        </motion.p>

        {tone !== 'error' && <MarchingLoader />}

        {retry && (
          <div className="mt-6">
            <PixelButton variant="primary" size="md" onClick={retry}>
              Try again
            </PixelButton>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/**
 * An indeterminate pixel loader: pips light in a marching loop. Deliberately
 * not a percentage — we genuinely don't know how long the bootstrap takes, and
 * a fake progress bar that stalls at 90% is worse than none.
 */
function MarchingLoader() {
  const pips = 10;
  return (
    <div className="w-full flex flex-col items-center gap-2.5 mt-6">
      <div className="flex gap-[3px] p-[3px] bg-cream-200 border border-border-soft w-full max-w-[280px]">
        {Array.from({ length: pips }).map((_, i) => (
          <motion.div
            key={i}
            className={clsx('flex-1 h-2.5 bg-ui-primary')}
            initial={{ opacity: 0.15 }}
            animate={{ opacity: [0.15, 1, 0.15] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: (i / pips) * 0.9,
            }}
          />
        ))}
      </div>
      <div className="stat-label">Opening the studio</div>
    </div>
  );
}
