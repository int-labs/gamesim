import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  width?: string;
  children: ReactNode;
  hideClose?: boolean;
  align?: 'center' | 'top';
  className?: string;
}

export function PixelModal({ open, onClose, title, width = 'min(720px, calc(100vw - 32px))', children, hideClose, align = 'center', className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          // z-[100] keeps the modal above the canvas (z<10), the page
          // (z-30 sticky HUD), and the mascot (z-[60]). Add-ons inside
          // <NotebookCanvas> are clamped via `isolate` so they cannot
          // leak above this layer. `data-pixel-modal` lets lower layers
          // (e.g. Drawer) detect a stacked modal and yield Esc to it.
          data-pixel-modal
          className="fixed inset-0 z-[100] flex"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink-900/55" onClick={onClose} />
          <div className={clsx('relative z-[110] w-full flex justify-center p-4', align === 'top' ? 'items-start pt-10' : 'items-center')}>
            <motion.div
              className={clsx('pixel-frame bg-cream-50 flex flex-col', className)}
              style={{ width, maxHeight: 'calc(100dvh - 32px)' }}
              initial={{ y: 20, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 1.4, 0.4, 1] }}
              // Stop click bubbling so clicks INSIDE the modal don't
              // propagate to the backdrop's onClick (which dismisses).
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="flex items-center justify-between px-4 py-2 border-b-2 border-ink-900 bg-cream-200 shrink-0">
                  <div className="font-hud uppercase tracking-wider text-[12px]">{title}</div>
                  {!hideClose && onClose && (
                    <button onClick={onClose} className="font-hud text-[10px] hover:text-ui-danger">✕</button>
                  )}
                </div>
              )}
              {/* Body scrolls when content exceeds viewport height — so
                  the modal stays anchored and the close button remains
                  reachable on small screens. */}
              <div className="p-4 overflow-y-auto flex-1 min-h-0">{children}</div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
