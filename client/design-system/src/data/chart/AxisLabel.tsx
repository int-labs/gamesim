import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

const ELLIPSIS = "…";

/**
 * Lays a name's words on at most `maxLines` lines of `width`, breaking between words only. A
 * word wider than a line keeps a line of its own (it is cut with "…" where it is drawn). When
 * words are left over, the last line ends in "…", shortened until it fits.
 */
export function fitLines(label: string, width: number, maxLines: number, measure: (text: string) => number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let index = 0;
  for (; index < words.length; index += 1) {
    const word = words[index] as string;
    const joined = line ? `${line} ${word}` : word;
    if (!line || measure(joined) <= width) {
      line = joined;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines) {
    if (line) lines.push(line);
    return lines;
  }
  // Words are left over: the last line says so.
  let last = lines[maxLines - 1] as string;
  while (last.length > 1 && measure(`${last}${ELLIPSIS}`) > width) last = last.slice(0, -1).trimEnd();
  lines[maxLines - 1] = `${last}${ELLIPSIS}`;
  return lines;
}

interface AxisLabelProps {
  label: string;
  /** The label's own classes: its type and colour. */
  className: string;
  /** Each line's classes: a block that cuts an overlong word with "…". */
  lineClassName: string;
  /** Before the label is measured (and where it cannot be, as in tests): it wraps and is clamped. */
  unmeasuredClassName: string;
  maxLines?: number;
}

/**
 * A team's name under its column. It is measured in its own font against its column: it wraps
 * between words only, never inside one ("Northsta / r"), over two lines at most; a word too long
 * for the column, and a name with words left over, end in "…". The tooltip gives the whole name.
 */
export function AxisLabel({ label, className, lineClassName, unmeasuredClassName, maxLines = 2 }: AxisLabelProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Measured lines, kept with the name they were measured for.
  const [fitted, setFitted] = useState<{ label: string; lines: string[] } | null>(null);
  const lines = fitted?.label === label ? fitted.lines : null;

  useLayoutEffect(() => {
    const node = ref.current;
    const column = node?.parentElement;
    if (!node || !column || typeof OffscreenCanvas === "undefined" || typeof ResizeObserver === "undefined") return;
    const context = new OffscreenCanvas(1, 1).getContext("2d");
    if (!context) return;
    const fit = () => {
      const style = getComputedStyle(node);
      const columnStyle = getComputedStyle(column);
      const width = column.clientWidth - Number.parseFloat(columnStyle.paddingLeft) - Number.parseFloat(columnStyle.paddingRight);
      if (width <= 0) return;
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ("letterSpacing" in context) context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      const next = fitLines(label, width, maxLines, (text) => context.measureText(text).width);
      setFitted((previous) =>
        previous?.label === label && previous.lines.join("\n") === next.join("\n") ? previous : { label, lines: next },
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(column);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fit();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [label, maxLines]);

  return (
    <span ref={ref} className={cn(className, !lines && unmeasuredClassName)}>
      {lines
        ? lines.map((line, index) => (
            <span key={index} className={lineClassName}>
              {line}
            </span>
          ))
        : label}
    </span>
  );
}
