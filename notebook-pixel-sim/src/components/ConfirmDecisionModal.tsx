import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelIcon, type PixelIconKind } from '@/components/icons/PixelIcon';
import { CostTiles, type CostTile } from '@/components/primitives/CostTiles';
import { playSfx } from '@/audio/audioManager';

// Pick a tile icon from the line label (cash/energy/stock cues).
function iconFor(label: string): PixelIconKind | undefined {
  const l = label.toLowerCase();
  if (l.includes('cost') || l.includes('cash') || l.includes('$') || l.includes('price')) return 'cash';
  if (l.includes('energy')) return 'energy';
  if (l.includes('unit') || l.includes('stock') || l.includes('qty') || l.includes('quantity')) return 'stock';
  return undefined;
}

interface DecisionLine {
  label: string;
  value: string;
  /** When true, renders in a "cost" amber tone. */
  cost?: boolean;
  /** When true, renders in a "gain" green tone. */
  gain?: boolean;
}

interface Props {
  open: boolean;
  /** Modal title — what the player is about to do. */
  title: string;
  /** One-line summary of what will happen. */
  summary: string;
  /** Optional bullet points: cost, gain, side-effects. */
  lines?: DecisionLine[];
  /** Optional reversibility note shown in italics under the lines. */
  reversibility?: string;
  /** Confirm button label (default "Confirm"). */
  confirmLabel?: string;
  /** Cancel button label (default "Cancel"). */
  cancelLabel?: string;
  /** Tone of the confirm button. Default 'primary'. */
  tone?: 'primary' | 'danger';
  /** Action fired on confirm. The modal closes after this returns. */
  onConfirm: () => void;
  /** Close without committing the decision. */
  onCancel: () => void;
}

/**
 * Generic "are you sure?" modal for decisions in the Business page
 * that the player can't easily undo — buying raw materials, acquiring
 * upgrades, opening paid channels.
 *
 * Surfaces the cost + outcome up-front so the player has the info to
 * cancel, and keeps Cancel + Confirm clearly separated visually.
 *
 * Accessibility: role="dialog", aria-modal, ESC dismisses, click on
 * the backdrop dismisses. Focus is NOT trapped (modal is shallow); a
 * brief flow only.
 */
export function ConfirmDecisionModal({
  open,
  title,
  summary,
  lines,
  reversibility,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}: Props) {
  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[200] bg-black/60"
            onClick={onCancel}
          />
          {/* Outer wrapper takes the full viewport and centers via flex.
              The modal itself only animates opacity + scale — no Y
              animation — so it sits perfectly centered. The earlier
              version mixed Tailwind's -translate-y with framer-motion's
              y, and framer's y override left the dialog's top edge
              anchored at viewport center (not centered). */}
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center pointer-events-none p-4"
          >
          <motion.div
            key="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-decision-title"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.2, 1.4, 0.4, 1] }}
            className="panel-frame bg-surface w-[min(440px,100%)] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-4 py-3 border-b-2 border-border-soft bg-surface-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 border-2 border-border bg-surface">
                <PixelIcon kind="warning" size={11} color="var(--c-warning)" />
              </span>
              <h2 id="confirm-decision-title" className="panel-title text-text">{title}</h2>
            </header>

            <div className="px-4 py-3 flex flex-col gap-2.5">
              <p className="body-sm text-text leading-relaxed">{summary}</p>

              {lines && lines.length > 0 && (
                <CostTiles
                  tiles={lines.map<CostTile>((l) => ({
                    label: l.label,
                    value: l.value,
                    tone: l.cost ? 'cost' : l.gain ? 'gain' : 'neutral',
                    icon: iconFor(l.label),
                  }))}
                />
              )}

              {reversibility && (
                <p className="body-xs text-text-3 italic leading-relaxed">{reversibility}</p>
              )}
            </div>

            <div className="px-4 py-3 border-t-2 border-border-soft bg-surface-2/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { playSfx('click-soft'); onCancel(); }}
                className="inline-flex items-center gap-1.5 h-[36px] px-4 border-2 border-border-soft bg-surface text-text-2 hover:bg-surface-2 hover:text-text cursor-pointer"
              >
                <span className="eyebrow eyebrow-sm">{cancelLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => { playSfx(tone === 'danger' ? 'warning' : 'confirm'); onConfirm(); }}
                className={
                  'inline-flex items-center gap-2 h-[36px] px-5 border-2 cursor-pointer ' +
                  (tone === 'danger'
                    ? 'border-danger bg-danger text-[#FAF7E8]'
                    : 'border-[#4F9C72] bg-primary text-[#FAF7E8]')
                }
                style={{ color: '#FAF7E8' }}
              >
                <PixelIcon kind="check" size={11} color="#FAF7E8" />
                <span className="eyebrow eyebrow-sm text-inherit">{confirmLabel}</span>
              </button>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
