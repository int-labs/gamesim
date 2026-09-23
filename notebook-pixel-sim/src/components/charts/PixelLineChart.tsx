import { CHART_INK, domainOf, niceTicks } from './chartTheme';
import { EmptyPlot } from './PixelBarChart';

/**
 * Multi-series progress lines — "Total Cost Progress, Round 1 to 3" and its
 * siblings.
 *
 * Distinct from `PixelStepLine`, which is a single-series sparkline with no
 * axis, no legend and a stepped path. This one is a straight-segment line chart
 * with a labelled x-axis and several teams on it.
 *
 * A null in the middle of a series BREAKS the line rather than interpolating
 * across it: a round a team did not play is not a value between its neighbours.
 */

export interface LineSeries {
  /** Stable identity. Colour is resolved by the caller from the team palette. */
  id:     string;
  label:  string;
  color:  string;
  values: (number | null)[];
}

interface Props {
  points:   string[];
  series:   LineSeries[];
  width?:   number;
  height?:  number;
  format?:  (n: number) => string;
  yLabel?:  string;
  /** Print each point's value beside its marker. Off for dense series. */
  showValues?: boolean;
}

const PAD = { top: 18, right: 14, bottom: 26, left: 40 };

export function PixelLineChart({
  points,
  series,
  width = 544,
  height = 306,
  format = (n) => String(Math.round(n)),
  yLabel,
  showValues = true,
}: Props) {
  if (points.length === 0 || series.length === 0) {
    return <EmptyPlot width={width} height={height} />;
  }

  const { min, max } = domainOf(series.flatMap((s) => s.values));
  const ticks = niceTicks(min, max);
  const lo = Math.min(...ticks, min);
  const hi = Math.max(...ticks, max);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  // A single point sits centred rather than dividing by zero.
  const x = (i: number) =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW;

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

      {lo < 0 && (
        <line x1={PAD.left} y1={y(0)} x2={PAD.left + plotW} y2={y(0)}
              stroke={CHART_INK.zero} strokeWidth={1} />
      )}

      {series.map((s) => (
        <g key={s.id}>
          {segmentsOf(s.values).map((seg, i) => (
            <polyline
              key={i}
              points={seg.map(({ i: pi, v }) => `${x(pi)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="miter"
              strokeLinecap="butt"
            />
          ))}
          {s.values.map((v, i) =>
            v == null || !Number.isFinite(v) ? null : (
              <g key={i}>
                <rect x={x(i) - 2.5} y={y(v) - 2.5} width={5} height={5}
                      fill={s.color} stroke={CHART_INK.paper} strokeWidth={1} />
                {showValues && (
                  <text x={x(i)} y={y(v) - 6} textAnchor="middle"
                        className="chart-label" fill={s.color}>
                    {format(v)}
                  </text>
                )}
              </g>
            ),
          )}
        </g>
      ))}

      {points.map((p, i) => (
        <text key={p} x={x(i)} y={height - 14} textAnchor="middle"
              className="chart-label" fill={CHART_INK.label}>
          {p}
        </text>
      ))}

      {yLabel && (
        <text x={PAD.left} y={11} className="chart-label" fill={CHART_INK.label}>
          {yLabel}
        </text>
      )}
    </svg>
  );
}

/** Split a series at its gaps, so a missing round leaves a break in the line
 *  instead of a segment drawn straight through it. A run of ONE point yields no
 *  polyline — its marker still renders. */
function segmentsOf(values: (number | null)[]): Array<Array<{ i: number; v: number }>> {
  const out: Array<Array<{ i: number; v: number }>> = [];
  let run: Array<{ i: number; v: number }> = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (run.length > 1) out.push(run);
      run = [];
      return;
    }
    run.push({ i, v });
  });
  if (run.length > 1) out.push(run);
  return out;
}
