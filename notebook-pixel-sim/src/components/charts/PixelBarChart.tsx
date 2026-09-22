import { CHART_INK, domainOf, niceTicks } from './chartTheme';

/**
 * Vertical bars, grouped.
 *
 * ONE component covers three of the operator's chart types, because they differ
 * only in how many bars share a tick:
 *
 *   one series,  groups = teams    → "Total Cost - Round 1"
 *   two series,  groups = teams    → "Cash Utilization" (Start vs End)
 *   n series,    groups = rounds   → "Total Gross Profit per Round"
 *
 * `delta: true` labels each group with the change from its FIRST series to its
 * last instead of labelling every bar — which is what the Start-vs-End charts
 * actually want to show.
 */

export interface BarSeries {
  /** Stable identity — never the array position. Colours are looked up by it. */
  id:     string;
  label:  string;
  color:  string;
  /** One value per group, index-aligned to `groups`. `null` = no figure, which
   *  draws NOTHING rather than a zero-height bar sitting on the axis. */
  values: (number | null)[];
}

interface Props {
  groups:    string[];
  series:    BarSeries[];
  width?:    number;
  height?:   number;
  /** Rendered on each bar, or on each group when `delta`. */
  format?:   (n: number) => string;
  /** Label the group with last − first instead of labelling every bar. */
  delta?:    boolean;
  yLabel?:   string;
  /** Fades all but the last series, for Start-vs-End framing. */
  fadeLead?: boolean;
}

const PAD = { top: 18, right: 10, bottom: 26, left: 40 };

export function PixelBarChart({
  groups,
  series,
  width = 320,
  height = 180,
  format = (n) => String(Math.round(n)),
  delta = false,
  yLabel,
  fadeLead = false,
}: Props) {
  if (groups.length === 0 || series.length === 0) {
    return <EmptyPlot width={width} height={height} />;
  }

  const all = series.flatMap((s) => s.values);
  const { min, max } = domainOf(all);
  const ticks = niceTicks(min, max);
  const lo = Math.min(...ticks, min);
  const hi = Math.max(...ticks, max);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const zeroY = y(0);

  const groupW = plotW / groups.length;
  // A quarter of the slot stays empty so neighbouring groups do not touch.
  const barW = (groupW * 0.75) / series.length;

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

      {/* Zero is drawn solid and last of the rules: with negative values it is
          the reference the reader actually needs. */}
      {lo < 0 && (
        <line x1={PAD.left} y1={zeroY} x2={PAD.left + plotW} y2={zeroY}
              stroke={CHART_INK.zero} strokeWidth={1} />
      )}

      {groups.map((g, gi) => {
        const slotX = PAD.left + gi * groupW + groupW * 0.125;
        return (
          <g key={g}>
            {series.map((s, si) => {
              const v = s.values[gi];
              if (v == null || !Number.isFinite(v)) return null;
              const x = slotX + si * barW;
              const top = Math.min(y(v), zeroY);
              const h = Math.abs(y(v) - zeroY);
              const faded = fadeLead && si < series.length - 1;
              return (
                <g key={s.id}>
                  <rect x={x} y={top} width={barW} height={Math.max(1, h)}
                        fill={s.color} fillOpacity={faded ? 0.4 : 1}
                        stroke={CHART_INK.paper} strokeWidth={1} />
                  {!delta && (
                    <text x={x + barW / 2} y={v >= 0 ? top - 3 : top + h + 8}
                          textAnchor="middle" className="chart-label" fill={s.color}>
                      {format(v)}
                    </text>
                  )}
                </g>
              );
            })}
            {delta && <DeltaLabel
              series={series} gi={gi} slotX={slotX} barW={barW} y={y} format={format} />}
            <text x={PAD.left + gi * groupW + groupW / 2} y={height - 14}
                  textAnchor="middle" className="chart-label" fill={CHART_INK.label}>
              {g}
            </text>
          </g>
        );
      })}

      {yLabel && (
        <text x={PAD.left} y={11} className="chart-label" fill={CHART_INK.label}>
          {yLabel}
        </text>
      )}
    </svg>
  );
}

/** last − first for a group. Both ends must exist: a delta against a missing
 *  round is not zero, it is unknown. */
function DeltaLabel({
  series, gi, slotX, barW, y, format,
}: {
  series: BarSeries[];
  gi: number;
  slotX: number;
  barW: number;
  y: (v: number) => number;
  format: (n: number) => string;
}) {
  const first = series[0]?.values[gi];
  const last  = series[series.length - 1]?.values[gi];
  if (first == null || last == null) return null;

  const d = last - first;
  const x = slotX + (series.length - 0.5) * barW;
  return (
    <text x={x} y={y(last) - 4} textAnchor="middle" className="chart-label"
          fill={series[series.length - 1].color}>
      {d >= 0 ? `+${format(d)}` : format(d)}
    </text>
  );
}

export function EmptyPlot({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{ maxWidth: width, height, aspectRatio: `${width} / ${height}` }}
      className="w-full max-w-full flex items-center justify-center bg-cream-100 border-2 border-ink-900 eyebrow eyebrow-sm text-ink-700"
    >
      No data
    </div>
  );
}
