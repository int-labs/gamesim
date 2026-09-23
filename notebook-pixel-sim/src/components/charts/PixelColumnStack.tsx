import { CHART_INK, niceTicks } from './chartTheme';
import { EmptyPlot } from './PixelBarChart';

/**
 * Vertical STACKED columns — the cost and revenue breakdowns.
 *
 * Distinct from `PixelStackedBar`, which is one horizontal 100% bar showing a
 * proportion. This one stacks absolute values on a real axis, so two columns
 * can be compared by height as well as by composition.
 *
 * Positive and negative slices stack in OPPOSITE directions from zero, each
 * with its own running base. A segment breakdown containing a loss is a real
 * case in the operator's mockups, and stacking a negative onto a positive base
 * would draw it as a gap in the column.
 */

export interface StackSlice {
  /** Stable identity — the operator's category name IS free text, so this is
   *  the key the caller already has, never an array position. */
  id:    string;
  label: string;
  color: string;
  /** One value per column, index-aligned to `columns`. */
  values: (number | null)[];
}

interface Props {
  columns:  string[];
  slices:   StackSlice[];
  width?:   number;
  height?:  number;
  format?:  (n: number) => string;
  yLabel?:  string;
  /** Hide slice values below this height in px — a 3px sliver cannot hold a
   *  number, and stacking labels on top of each other is worse than omitting. */
  minLabelPx?: number;
}

const PAD = { top: 18, right: 10, bottom: 26, left: 40 };

export function PixelColumnStack({
  columns,
  slices,
  width = 544,
  height = 340,
  format = (n) => String(Math.round(n)),
  yLabel,
  minLabelPx = 12,
}: Props) {
  if (columns.length === 0 || slices.length === 0) {
    return <EmptyPlot width={width} height={height} />;
  }

  // The domain is the stacked TOTAL per column, per side — not the largest
  // single slice, which would clip every column that has more than one.
  let min = 0;
  let max = 0;
  columns.forEach((_, ci) => {
    let pos = 0;
    let neg = 0;
    for (const s of slices) {
      const v = s.values[ci];
      if (v == null || !Number.isFinite(v)) continue;
      if (v >= 0) pos += v; else neg += v;
    }
    if (pos > max) max = pos;
    if (neg < min) min = neg;
  });
  if (min === 0 && max === 0) max = 1;

  const ticks = niceTicks(min, max);
  const lo = Math.min(...ticks, min);
  const hi = Math.max(...ticks, max);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const zeroY = y(0);

  const slotW = plotW / columns.length;
  const colW = slotW * 0.55;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full max-w-full h-auto"
      style={{ maxWidth: width }}
      role="img"
    >
      <rect x={0} y={0} width={width} height={height} fill={CHART_INK.paper}
            stroke={CHART_INK.frame} strokeWidth={2} />

      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} y1={y(t)} x2={PAD.left + plotW} y2={y(t)}
                stroke={CHART_INK.grid} strokeDasharray="2 3" />
          <text x={PAD.left - 4} y={y(t) + 3} textAnchor="end"
                className="chart-label" fill={CHART_INK.label}>
            {format(t)}
          </text>
        </g>
      ))}

      {columns.map((c, ci) => {
        const x = PAD.left + ci * slotW + (slotW - colW) / 2;
        // Two bases, because the two directions cannot share one.
        let basePos = 0;
        let baseNeg = 0;

        return (
          <g key={c}>
            {slices.map((s) => {
              const v = s.values[ci];
              if (v == null || !Number.isFinite(v) || v === 0) return null;

              const from = v >= 0 ? basePos : baseNeg;
              const to = from + v;
              if (v >= 0) basePos = to; else baseNeg = to;

              const top = Math.min(y(from), y(to));
              const h = Math.abs(y(to) - y(from));

              return (
                <g key={s.id}>
                  <rect x={x} y={top} width={colW} height={Math.max(1, h)}
                        fill={s.color} stroke={CHART_INK.paper} strokeWidth={1} />
                  {h >= minLabelPx && (
                    <text x={x + colW / 2} y={top + h / 2 + 3} textAnchor="middle"
                          className="chart-label" fill={CHART_INK.paper}>
                      {format(v)}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={PAD.left + ci * slotW + slotW / 2} y={height - 14}
                  textAnchor="middle" className="chart-label" fill={CHART_INK.label}>
              {c}
            </text>
          </g>
        );
      })}

      {lo < 0 && (
        <line x1={PAD.left} y1={zeroY} x2={PAD.left + plotW} y2={zeroY}
              stroke={CHART_INK.zero} strokeWidth={1} />
      )}

      {yLabel && (
        <text x={PAD.left} y={11} className="chart-label" fill={CHART_INK.label}>
          {yLabel}
        </text>
      )}
    </svg>
  );
}
