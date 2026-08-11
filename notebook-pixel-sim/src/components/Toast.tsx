import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import type { BubbleType } from '@/types';

const tones: Record<BubbleType, string> = {
  hint: 'bg-cream-50 border-ink-900',
  warning: 'bg-warn-soft border-ui-danger',
  success: 'bg-success-soft border-success',
  event: 'bg-info-soft border-info',
  insight: 'bg-info-soft border-info',
  debrief: 'bg-brand-300 border-brand-500',
  tutorial: 'bg-cream-100 border-ink-900',
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
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={clsx('pixel-frame px-3 py-2 eyebrow eyebrow-sm', tones[toast.kind])}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
