import { CHART_INK, domainOf, niceTicks } from './chartTheme';
import { EmptyPlot } from './PixelBarChart';

/**
 * Price against units sold, one bubble per team.
 *
 * BUBBLE AREA, NOT RADIUS, is proportional to the size value. Scaling the
 * radius makes a team selling twice as much look four times as big, which is
 * the classic way a scatter overstates its own data — the operator's prototype
 * did exactly that (`s = sold * scale`, and matplotlib's `s` IS area, so it was
 * right there and would have been wrong if ported literally to `r`).
 */

export interface Bubble {
  /** Stable identity — never the array position. */
  id:    string;
  label: string;
  color: string;
  x:     number;
  y:     number;
  /** Drives AREA. Null or non-finite falls back to the minimum radius. */
  size:  number | null;
}

interface Props {
  bubbles:  Bubble[];
  width?:   number;
  height?:  number;
  xLabel?:  string;
  yLabel?:  string;
  formatX?: (n: number) => string;
  formatY?: (n: number) => string;
  maxR?:    number;
  minR?:    number;
}

const PAD = { top: 18, right: 16, bottom: 28, left: 42 };

export function PixelBubbleChart({
  bubbles,
  width = 320,
  height = 220,
  xLabel,
  yLabel,
  formatX = (n) => String(Math.round(n)),
  formatY = (n) => String(Math.round(n)),
  maxR = 22,
  minR = 5,
}: Props) {
  if (bubbles.length === 0) return <EmptyPlot width={width} height={height} />;

  const xd = domainOf(bubbles.map((b) => b.x));
  const yd = domainOf(bubbles.map((b) => b.y));
  const xTicks = niceTicks(xd.min, xd.max, 4);
  const yTicks = niceTicks(yd.min, yd.max, 4);

  const xLo = Math.min(...xTicks, xd.min);
  const xHi = Math.max(...xTicks, xd.max);
  const yLo = Math.min(...yTicks, yd.min);
  const yHi = Math.max(...yTicks, yd.max);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const px = (v: number) => PAD.left + ((v - xLo) / (xHi - xLo || 1)) * plotW;
  const py = (v: number) => PAD.top + plotH - ((v - yLo) / (yHi - yLo || 1)) * plotH;

  const sizes = bubbles.map((b) => (b.size != null && Number.isFinite(b.size) ? b.size : 0));
  const sMax = Math.max(...sizes, 0);
  // area ∝ size  ⇒  r ∝ √size. Equal sizes all render at maxR rather than
  // collapsing, since there is no spread to encode.
  const radius = (s: number) =>
    sMax <= 0 ? minR : minR + (maxR - minR) * Math.sqrt(Math.max(0, s) / sMax);

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

      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} y1={py(t)} x2={PAD.left + plotW} y2={py(t)}
                stroke={CHART_INK.grid} strokeDasharray="2 3" />
          <text x={PAD.left - 4} y={py(t) + 3} textAnchor="end"
                className="chart-label" fill={CHART_INK.label}>{formatY(t)}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={px(t)} y1={PAD.top} x2={px(t)} y2={PAD.top + plotH}
                stroke={CHART_INK.grid} strokeDasharray="2 3" />
          <text x={px(t)} y={height - 14} textAnchor="middle"
                className="chart-label" fill={CHART_INK.label}>{formatX(t)}</text>
        </g>
      ))}

      {/* Largest first, so a small bubble is never hidden behind a big one. */}
      {[...bubbles]
        .sort((a, b) => radius(b.size ?? 0) - radius(a.size ?? 0))
        .map((b) => (
          <g key={b.id}>
            <circle cx={px(b.x)} cy={py(b.y)} r={radius(b.size ?? 0)}
                    fill={b.color} fillOpacity={0.7}
                    stroke={CHART_INK.paper} strokeWidth={1.5} />
            <text x={px(b.x)} y={py(b.y) + 3} textAnchor="middle"
                  className="chart-label" fill={CHART_INK.paper}>
              {b.label}
            </text>
          </g>
        ))}

      {yLabel && (
        <text x={PAD.left} y={11} className="chart-label" fill={CHART_INK.label}>{yLabel}</text>
      )}
      {xLabel && (
        <text x={PAD.left + plotW} y={11} textAnchor="end"
              className="chart-label" fill={CHART_INK.label}>{xLabel}</text>
      )}
    </svg>
  );
}
