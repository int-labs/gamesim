import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface Props {
  /** Target numeric value to display. */
  value: number;
  /** How to format the displayed value. e.g. fmt$ or fmtInt. */
  format?: (n: number) => string;
  /** Animation duration ms. Default 380. */
  duration?: number;
  /** Class on the wrapper. */
  className?: string;
  /** Inline style on the wrapper (e.g. a computed colour). */
  style?: React.CSSProperties;
  /** Don't animate the very first render (useful when persisted state hydrates). */
  silentOnMount?: boolean;
}

/**
 * Count-up KPI value. Interpolates from previous value to new value over
 * `duration` ms. Triggers a brief background flash on the parent surface for
 * an extra "this just changed" cue. Restraint: capped at ~400ms total so it
 * never feels laggy.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 380, className, style, silentOnMount = true }: Props) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      previous.current = value;
      setDisplay(value);
      return;
    }
    const from = previous.current;
    const to = value;
    if (from === to) return;
    if (silentOnMount && Math.abs(from - to) < 0.001) {
      setDisplay(to);
      previous.current = to;
      return;
    }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2); // easeOutQuad
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else previous.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, silentOnMount]);

  return <span className={clsx('tabular-nums', className)} style={style}>{format(display)}</span>;
}
