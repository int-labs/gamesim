import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/state/store';
import { PixelIcon } from '@/components/icons/PixelIcon';

interface Props {
  anchor: HTMLElement;
  onClose: () => void;
}

/**
 * History dropdown — compact decision timeline anchored to the navbar
 * History button. Replaces the old Results-page History tab.
 *
 * Behavior:
 *   - Portaled to <body> (escapes header overflow + sticky positioning)
 *   - Position: fixed, anchored under the trigger via getBoundingClientRect
 *   - Outside-click + Escape close
 *   - Window resize/scroll re-positions
 *   - Scrollable when the timeline is long
 *   - Newest decisions on top
 */
export function HistoryDropdown({ anchor, onClose }: Props) {
  const history = useGame((s) => s.history);
  const day = useGame((s) => s.meta.day);
  const phase = useGame((s) => s.meta.phase);
  const [rect, setRect] = useState<DOMRect>(() => anchor.getBoundingClientRect());

  useEffect(() => {
    const update = () => setRect(anchor.getBoundingClientRect());
    update();
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchor.contains(t)) return;
      const menu = document.getElementById('history-dropdown');
      if (menu && menu.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, onClose]);

  const reversed = [...history].reverse();
  // Cap visible width so the popover stays contained on tablet/mobile
  const width = Math.min(420, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
  const top = rect.bottom + 8;

  return createPortal(
    <AnimatePresence>
      <motion.div
        id="history-dropdown"
        role="menu"
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -6, opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.2, 1.4, 0.4, 1] }}
        className="z-[140] panel-frame bg-surface border-2 border-border shadow-[3px_3px_0_0_var(--c-shadow)] flex flex-col"
        style={{
          position: 'fixed',
          left,
          top,
          width,
          maxHeight: `min(60vh, ${Math.max(220, window.innerHeight - top - 12)}px)`,
        }}
      >
        <header className="flex items-center justify-between px-3.5 py-2.5 border-b-2 border-border-soft bg-surface-2">
          <div className="flex items-center gap-2">
            <PixelIcon kind="history" size={11} color="var(--c-primary)" />
            <span className="eyebrow eyebrow-sm text-text">
              Decision Timeline
            </span>
          </div>
          <span className="stat-label">
            Day {day} · Phase {phase}
          </span>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {reversed.length === 0 ? (
            <div className="px-2 py-3 hint text-text-2">
              No decisions yet - start configuring your notebooks.
            </div>
          ) : (
            <ul className="flex flex-col">
              {reversed.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 px-2 py-1.5 border-b border-border-soft/60 last:border-b-0"
                >
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[36px] h-[20px] px-1.5 border border-border-soft bg-surface-2 stat-label tabular-nums">
                    D{h.day}
                  </span>
                  <span className="hint text-text leading-snug">{h.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
