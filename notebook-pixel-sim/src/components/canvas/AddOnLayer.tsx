import { motion, AnimatePresence } from 'framer-motion';
import { ADDONS } from '@/data/addOns';
import type { AddOnInstance } from '@/types';

interface Props {
  addOns: AddOnInstance[];
  /** Kept for prop compatibility with old callers; unused. */
  onRemove?: (instId: string) => void;
}

/**
 * Add-on DISPLAY layer — decorations appear PRE-PLACED at their default slot
 * position + size the moment they're toggled on. Purely cosmetic and
 * non-interactive: placement never affects the product score, so there's no
 * drag / resize / rotate / reorder here. Add and remove from the Add-ons
 * drawer (toggles); this layer just paints them, sorted by z-index, with a
 * little pop on enter/exit.
 */
export function AddOnLayer({ addOns }: Props) {
  const ordered = [...addOns].sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1));
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <AnimatePresence>
        {ordered.map((inst) => {
          const def = ADDONS.find((d) => d.id === inst.defId);
          if (!def) return null;
          const z = Math.min(9, Math.max(1, inst.zIndex ?? 5));
          return (
            <motion.div
              key={inst.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="absolute"
              style={{
                left: `${inst.x * 100}%`,
                top: `${inst.y * 100}%`,
                width: `${inst.scale * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: z,
              }}
            >
              <div style={{ transform: `rotate(${inst.rotation ?? 0}deg)`, transformOrigin: 'center center' }}>
                <img
                  src={def.imgPath}
                  alt=""
                  className="w-full h-auto object-contain"
                  style={{ filter: 'drop-shadow(1px 2px 0 rgba(42,32,23,0.28))', imageRendering: 'pixelated' }}
                  draggable={false}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
