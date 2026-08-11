import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { BubbleType } from '@/types';
import { CloseX } from '@/components/primitives/CloseX';

interface Props {
  open: boolean;
  type?: BubbleType;
  text: string;
  side?: 'left' | 'right';
  onClose?: () => void;
  speakerName?: string;
  actions?: { label: string; onClick: () => void; tone?: 'primary' | 'ghost' }[];
}

const toneByType: Record<BubbleType, string> = {
  hint: 'bg-cream-50 border-ink-900',
  warning: 'bg-warn-soft border-ui-danger',
  success: 'bg-success-soft border-success',
  event: 'bg-info-soft border-info',
  insight: 'bg-info-soft border-info',
  debrief: 'bg-brand-300 border-brand-500',
  tutorial: 'bg-cream-100 border-ink-900',
};

const labelByType: Record<BubbleType, string> = {
  hint: 'Hint',
  warning: 'Heads up',
  success: 'Nice',
  event: 'Event',
  insight: 'Insight',
  debrief: 'Debrief',
  tutorial: 'Tutorial',
};

export function MascotBubble({ open, type = 'hint', text, side = 'left', onClose, speakerName = 'Amelia', actions }: Props) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!open) return;
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={text}
          initial={{ y: 8, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 6, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }}
          className={clsx(
            'pointer-events-auto pixel-frame relative max-w-[320px] min-w-[180px]',
            toneByType[type],
          )}
        >
          {/* Tail */}
          <div
            aria-hidden
            className={clsx(
              'absolute w-3 h-3 border-2 border-ink-900 rotate-45',
              side === 'left' ? '-left-2 top-5' : '-right-2 top-5',
              toneByType[type].split(' ').find((c) => c.startsWith('bg-')),
            )}
          />
          <div className="px-3 pt-2 pb-1 flex justify-between items-center border-b border-border-soft bg-cream-200">
            <div className="eyebrow eyebrow-sm">
              {speakerName} · {labelByType[type]}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="grid place-items-center w-5 h-5 text-text-2 hover:text-ui-danger transition-colors"
                aria-label="dismiss"
              >
                <CloseX size={10} />
              </button>
            )}
          </div>
          <div className="px-3 py-2 body-xs leading-snug font-body text-ink-900 whitespace-pre-wrap min-h-[36px]">
            {shown}
            {shown.length < text.length && <span className="opacity-60">▌</span>}
          </div>
          {actions && actions.length > 0 && (
            <div className="px-3 pb-2 flex gap-2 flex-wrap">
              {actions.map((a, idx) => (
                <button
                  key={idx}
                  onClick={a.onClick}
                  className={clsx(
                    'border-2 border-ink-900 eyebrow eyebrow-sm px-2 py-1 transition-transform active:translate-y-[1px]',
                    a.tone === 'primary'
                      ? 'bg-ui-primary text-cream-50 shadow-pixel-2'
                      : 'bg-cream-50 shadow-pixel-1',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
