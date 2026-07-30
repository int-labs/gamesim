import { AnimatePresence, motion } from 'framer-motion';

/**
 * PoseSprite — crossfades between mascot pose images so pose changes feel
 * smooth even when the source PNGs are framed at different scales.
 *
 * The trick for "different image sizes" not looking broken:
 *   1. CROSSFADE (old fades out while new fades in) hides the hard swap.
 *   2. object-bottom + object-contain keep her FEET pinned to the same
 *      baseline, so she never appears to jump up/down between poses.
 */
export function PoseSprite({
  src,
  size,
  reduced,
}: {
  src: string;
  size: number;
  reduced?: boolean;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <AnimatePresence initial={false}>
        <motion.img
          key={src}
          src={src}
          alt=""
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.28, ease: 'easeInOut' }}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-[2px_4px_0_rgba(42,32,23,0.3)]"
        />
      </AnimatePresence>
    </div>
  );
}
