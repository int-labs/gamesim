import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import type { BubbleType } from '@/types';

/**
 * ⚠ TEXT COLOUR ONLY — no fill, no frame.
 *
 * This was a bordered pastel chip at the top edge, and it lost every time: a
 * `-soft` tint on a cream page, inside a 1px border, in `eyebrow-sm` tracked
 * capitals, sitting in the same band as the HUD. The message it carries is
 * usually the server's own error text, which is the one thing on screen a
 * player must not miss.
 *
 * The STRONG weights, not the `-ink` ones: this floats over whatever happens
 * to be behind it, so it cannot borrow contrast from a fill it no longer has.
 */
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
    // ⚠ CENTRE OF THE SCREEN, not the top edge. At `top-3` it sat in the same
    // band as the HUD bar — the busiest strip on the page — so the one message
    // the app ever pushes at the player was competing with the chrome for
    // attention and losing. Dead centre is where the eye already is.
    //
    // `inset-0` + `pointer-events-none` so the overlay never takes a click:
    // the toast is a notice, and nothing underneath it should become
    // unreachable for the two seconds it is up.
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
              // `.section-heading` is the top of the type scale — see the
              // `--fs-unit` rule; no raw px here. It carries a sentence, so
              // `leading-tight` rather than the class's own display spacing.
              'section-heading leading-tight max-w-[min(90vw,40rem)] text-center px-4',
              // The halo is what makes a fill unnecessary: a cream glow so red
              // survives the dark desk scenes, plus a hairline drop so it
              // still has an edge on the cream panels. Without it, transparent
              // text is only legible over half the app.
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
