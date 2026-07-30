import { motion } from 'framer-motion';

/**
 * PixelWipe — a one-shot "enter the academy" transition: a grid of pixel tiles
 * fills the screen in a diagonal sweep (cream), covering everything before the
 * app mounts underneath. Pure visual, no text or other elements.
 */
export function PixelWipe({
  cols = 18,
  rows = 10,
  reduced = false,
}: {
  cols?: number;
  rows?: number;
  reduced?: boolean;
}) {
  const total = cols * rows;
  const span = cols + rows;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[45] grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const delay = reduced ? 0 : ((c + r) / span) * 0.5;
        return (
          <motion.div
            key={i}
            className="bg-cream-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0.1 : 0.16, delay, ease: 'linear' }}
          />
        );
      })}
    </div>
  );
}
