import { motion } from 'framer-motion';
import clsx from 'clsx';
import { A } from '@/assets';
import type { Archetype, Binding, Cover, Size } from '@/types';

interface Props {
  archetype: Archetype;
  cover: Cover;
  binding: Binding;
  size: Size;
}

const SIZE_SCALE: Record<Size, number> = { s: 0.45, m: 0.75, l: 1.0 };

export function Notebook({ archetype, cover, binding, size }: Props) {
  const key = (cover === 'hardcover' ? 'hardcover_' : 'leather_') + (binding === 'ring' ? 'ring' : 'staple');
  const src = (A.notebook as any)[archetype][key] as string;
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
