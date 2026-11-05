import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import type { BubbleType } from '@/types';

/** Text colour only: no fill, no frame. Use the strong weights, since this floats over whatever is behind it. */
const tones: Record<BubbleType, string> = {
  hint:     'text-ink-900',
  warning:  'text-danger-strong',
  success:  'text-success-ink',
  event:    'text-info',
  insight:  'text-info',
  debrief:  'text-info',
  tutorial: 'text-ink-900',
};

export function Toast() {
  const toast = useGame((s) => s.toast);
  const clearToast = useGame((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const ms = Math.max(200, toast.until - Date.now());
    const t = setTimeout(clearToast, ms);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  return (
    // Centre of the screen; `pointer-events-none` so nothing underneath goes unreachable.
    <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            // Scale rather than a downward slide: it is arriving in place now,
            // not dropping in from an edge it no longer starts at.
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={clsx(
              // `.section-heading` from the type scale; no raw px.
              'section-heading leading-tight max-w-[min(90vw,40rem)] text-center px-4',
              // !important the halo replaces the fill; without it the text is legible over only half the app.
              '[text-shadow:0_0_10px_rgba(251,246,233,0.95),0_0_3px_rgba(251,246,233,1),0_2px_0_rgba(42,32,23,0.3)]',
              tones[toast.kind],
            )}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
