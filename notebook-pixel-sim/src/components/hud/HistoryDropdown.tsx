import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useGame } from '@/state/store';
import { PixelIcon } from '@/components/icons/PixelIcon';

interface Props {
  onClose: () => void;
}

/**
 * Decision Timeline — the full run history as a CENTERED MODAL (not an anchored
 * dropdown). It used to open as a second popover on top of the HUD menu, which
 * read as a stacked "double popup"; a single modal over a dimmed page is
 * cleaner and gives the timeline room to breathe.
 *
 * Behavior: portaled to <body>, backdrop-click + Escape close, scrollable body,
 * newest decisions on top.
 */
export function HistoryDropdown({ onClose }: Props) {
  const history = useGame((s) => s.history);
  const day = useGame((s) => s.meta.day);
  const phase = useGame((s) => s.meta.phase);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reversed = [...history].reverse();

  return createPortal(
    <div
      className="fixed inset-0 z-[140] bg-black/55 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Decision timeline"
        initial={{ y: 8, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="panel-frame bg-surface border-2 border-border shadow-[5px_5px_0_0_var(--c-shadow)] flex flex-col w-full max-w-[520px] max-h-[80vh]"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b-2 border-border-soft bg-surface-2 shrink-0">
          <div className="flex items-center gap-2">
            <PixelIcon kind="history" size={13} color="var(--c-primary)" />
            <span className="section-title text-text">
              Decision Timeline
            </span>
            <span className="stat-label ml-1">
              Day {day} · Phase {phase}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close decision timeline"
            className="w-7 h-7 inline-flex items-center justify-center border border-border-soft bg-surface hover:bg-surface-2 cursor-pointer"
          >
            <PixelIcon kind="close" size={12} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          {reversed.length === 0 ? (
            <div className="px-2 py-3 body-xs text-text-2">
              No decisions yet - start configuring your notebooks.
            </div>
          ) : (
            <ul className="flex flex-col">
              {reversed.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 px-2 py-2 border-b border-border-soft last:border-b-0"
                >
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[40px] h-[22px] px-1.5 border border-border-soft bg-surface-2 stat-label text-text-3 tabular-nums">
                    D{h.day}
                  </span>
                  <span className="body-xs text-text leading-snug">{h.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
