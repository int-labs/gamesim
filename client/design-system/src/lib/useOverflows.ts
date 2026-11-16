import { useEffect, useState, type RefObject } from "react";

/**
 * Whether a scroll box holds more than it shows. It then takes the keyboard's focus, so the arrow
 * keys scroll it (axe's scrollable-region-focusable); a table that fits adds no tab stop.
 */
export function useOverflows(ref: RefObject<HTMLElement | null>) {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflows(node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [ref]);
  return overflows;
}
