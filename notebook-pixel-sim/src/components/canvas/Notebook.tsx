import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ARCHETYPE_INFO } from '@/data/notebookArchetypes';
import type { Archetype, Binding, Cover, Size } from '@/types';

interface Props {
  archetype: Archetype;
  cover: Cover;
  binding: Binding;
  size: Size;
}

// A5 / B5 / B4. Exaggerated past the real paper ratios so the change is
// obvious at a glance, but floored well above zero: an A5 at 0.45 read as a
// broken sprite rather than a small notebook.
const SIZE_SCALE: Record<Size, number> = { s: 0.62, m: 0.80, l: 1.0 };

export function Notebook({ archetype, cover, binding, size }: Props) {
  // Each notebook ships ONE cover image, so cover/binding no longer select a
  // sprite variant — they still drive cost and time in the engine. Size does
  // still change the drawn notebook, via SIZE_SCALE below.
  void cover; void binding;
  const src = ARCHETYPE_INFO[archetype]?.art ?? '';
  const scale = SIZE_SCALE[size];
  return (
    <motion.div
      key={src + ':' + size}
      initial={{ scale: scale * 0.92, opacity: 0 }}
      animate={{ scale, opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.2, 1.4, 0.4, 1] }}
      className={clsx('absolute inset-0 flex items-center justify-center pointer-events-none')}
      style={{ transformOrigin: 'center center' }}
    >
      <img
        src={src}
        alt={`${archetype} ${cover} ${binding}`}
        className="object-contain max-w-full max-h-full"
        style={{ filter: 'drop-shadow(2px 6px 0 rgba(42,32,23,0.3))' }}
        draggable={false}
      />
    </motion.div>
  );
}

export const sizeScale = (size: Size) => SIZE_SCALE[size];
