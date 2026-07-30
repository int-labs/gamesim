import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { fmt$ } from '@/utils/format';

interface Props {
  value: number;
  className?: string;
  /** Animate count-up between value changes. */
  animate?: boolean;
}

export function PixelMoneyText({ value, className, animate = true }: Props) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const [tint, setTint] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!animate) {
      setShown(value);
      return;
    }
    const start = prev.current;
    const delta = value - start;
    if (delta === 0) return;
    setTint(delta > 0 ? 'up' : 'down');
    const dur = 600;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(start + delta * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else {
        prev.current = value;
        setShown(value);
        setTimeout(() => setTint(null), 220);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animate]);

  return (
    <span
      className={clsx(
        'font-hud transition-colors',
        tint === 'up' && 'text-success',
        tint === 'down' && 'text-error',
        className,
      )}
    >
      {fmt$(shown)}
    </span>
  );
}
