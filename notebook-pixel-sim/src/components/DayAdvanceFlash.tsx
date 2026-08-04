import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/state/store';

/** Brief vignette + day chip whenever the day advances mid-simulation. */
export function DayAdvanceFlash() {
  const day = useGame((s) => s.meta.day);
  const screen = useGame((s) => s.meta.screen);
  const last = useRef(day);
  const [pulse, setPulse] = useState<{ key: number; day: number } | null>(null);

  useEffect(() => {
    if (screen !== 'simulation') {
      last.current = day;
      return;
    }
    if (day !== last.current) {
      setPulse({ key: Date.now(), day });
      last.current = day;
      const t = setTimeout(() => setPulse(null), 700);
      return () => clearTimeout(t);
    }
  }, [day, screen]);

  return (
    <AnimatePresence>
      {pulse && (
        <motion.div
          key={pulse.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-40"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255,236,180,0) 50%, rgba(255,236,180,0.18) 100%)',
            }}
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.05, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.2, 1.4, 0.4, 1] }}
            className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-ink-900 border-2 border-warn shadow-pixel-3 eyebrow eyebrow-sm text-cream-50 tracking-wider"
          >
            Day {pulse.day}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
