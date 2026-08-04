import { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import { PixelIcon, type PixelIconKind } from '@/components/icons/PixelIcon';
import { playSfx } from '@/audio/audioManager';
import { CloseX } from '@/components/primitives/CloseX';

type TipTone = 'warn' | 'info' | 'success';

const toneCls: Record<TipTone, { box: string; icon: string }> = {
  warn: { box: 'bg-warning-soft border-warning text-text', icon: 'var(--c-warning)' },
  info: { box: 'bg-surface-2 border-border text-text', icon: 'var(--c-text-2)' },
  success: { box: 'bg-success-soft border-success text-text', icon: 'var(--c-success)' },
};

/**
 * DismissibleTip — a small hint that reveals with a spring and can be closed.
 * Dismissed ids are remembered for the session (`ui.dismissedTips`) so the tip
 * doesn't nag again. Reduced-motion collapses the reveal/dismiss to a fade.
 */
export function DismissibleTip({
  id,
  tone = 'warn',
  icon = 'info',
  children,
  className,
}: {
  id: string;
  tone?: TipTone;
  icon?: PixelIconKind;
  children: ReactNode;
  className?: string;
}) {
  const dismissed = useGame((s) => s.ui.dismissedTips.includes(id));
  const dismiss = useGame((s) => s.dismissTip);
  const reduced = useReducedMotion();
  const t = toneCls[tone];

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.94 }}
          transition={{ duration: 0.24, ease: [0.2, 1.4, 0.4, 1] }}
          className={clsx('inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 border-2 hint shadow-[2px_2px_0_0_var(--c-shadow)]', t.box, className)}
        >
          <PixelIcon kind={icon} size={12} color={t.icon} />
          <span className="leading-snug">{children}</span>
          <button
            type="button"
            onClick={() => { playSfx('click-soft'); dismiss(id); }}
            aria-label="Dismiss tip"
            className="ml-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 text-text-3 hover:text-text hover:bg-black/10 transition-colors"
          >
            <CloseX size={10} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
