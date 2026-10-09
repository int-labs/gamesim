import { CHART_INK } from './chartTheme';
import { EmptyPlot } from './PixelBarChart';

/**
 * Voice of Customer — one COLUMN per spec, on a shared vertical 0..1 axis.
 *
 * Each column carries a WEIGHT TICK (how much the market cares) and one DOT PER
 * TEAM (how far up that spec the team invested).
 *
 * Pivoted from rows to columns on 2026-10-09 (owner's call). This used to be
 * horizontal on the argument that spec names "read flat on the left and would
 * need rotating on an x-axis" — which is a real problem, not a reason to stay:
 * the labels now tilt only when the widest will not fit its column.
 *
 * ── THE TWO KINDS OF NUMBER ON THIS AXIS ────────────────────────────────────
 * Both are 0..1 but they do NOT mean the same thing, and the legend has to say
 * so or the chart implies they are comparable:
 *
 *   weight  — `direction`, the operator's authored VoC weight (live 0.03..0.15).
 *             For `selling_price`, which carries direction 0, the caller
 *             substitutes `priceSensitivity().weight` — see fieldConfig.ts,
 *             which is the ONE definition of that number.
 *   dot     — investment position, `(resolved − min) / (max − min)`. More is
 *             simply more.
 *
 * The caller does both conversions. This component places numbers; it does not
 * decide what they mean. See services/debriefSeries.ts on the server, which
 * deliberately ships raw bounds rather than normalising.
 */

export interface VocRow {
  /** Stable identity — the field id, never the array position. */
  id:     string;
  label:  string;
  /** 0..1, or null for a spec with no weight to show. */
  weight: number | null;
  /** teamId → 0..1 position. Absent teams simply have no dot on this row. */
  dots:   Array<{ teamId: string; label: string; color: string; value: number }>;
}

interface Props {
  rows:    VocRow[];
  height?: number;
  /** Column pitch. The plot grows WIDE with the spec count rather than
   *  compressing — the same rule the row pitch used to serve. */
  colW?:   number;
  /** Drawn thicker with a ring, so a player finds themselves at a glance. */
  youId?:  string | null;
}

const PAD = { top: 16, right: 16, left: 44 };

export function PixelVocPlot({ rows, height = 300, colW = 86, youId = null }: Props) {
  if (rows.length === 0) return <EmptyPlot width={360} height={120} />;

  // Tilt the spec names only when the longest cannot sit flat in its column.
  // ~5.2px per glyph at `chart-label` size — an estimate, since SVG cannot
  // measure text before it lays out. Tilted labels need the deeper gutter.
  const widestLabel = Math.max(...rows.map((r) => r.label.length)) * 5.2;
  const tilt = widestLabel > colW - 8;
  const padBottom = tilt ? 48 : 24;

  const width = PAD.left + rows.length * colW + PAD.right;
  const plotH = height - PAD.top - padBottom;
  const y = (v: number) => PAD.top + plotH - Math.max(0, Math.min(1, v)) * plotH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // NOT "none": it stretches the viewBox to the container and squashes the
      // label glyphs. Uniform scaling only.
      preserveAspectRatio="xMidYMid meet"
      className="block w-full max-w-full h-auto"
      style={{ maxWidth: width }}
      role="img"
    >
      <rect x={0} y={0} width={width} height={height} fill={CHART_INK.paper}
            stroke={CHART_INK.frame} strokeWidth={2} />

      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={PAD.left} y1={y(t)} x2={width - PAD.right} y2={y(t)}
                stroke={CHART_INK.grid} strokeDasharray="2 3" />
          <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end"
                className="chart-label" fill={CHART_INK.label}>
            {t.toFixed(2)}
          </text>
        </g>
      ))}

      {rows.map((r, i) => {
        const cx = PAD.left + i * colW + colW / 2;
        const labelY = height - (tilt ? 14 : 8);
        return (
          <g key={r.id}>
            <text
              x={cx}
              y={labelY}
              textAnchor={tilt ? 'end' : 'middle'}
              transform={tilt ? `rotate(-30 ${cx} ${labelY})` : undefined}
              className="chart-label"
              fill={CHART_INK.label}
            >
              {r.label}
            </text>

            <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + plotH}
                  stroke={CHART_INK.grid} strokeWidth={2} />

            {/* The weight tick: a bar ACROSS the column, deliberately unlike the
                dots, because it is a different kind of quantity. */}
            {r.weight != null && Number.isFinite(r.weight) && (
              <line x1={cx - 9} y1={y(r.weight)} x2={cx + 9} y2={y(r.weight)}
                    stroke={CHART_INK.frame} strokeWidth={2} />
            )}

            {r.dots.map((d) => {
              const you = d.teamId === youId;
              return (
                <circle
                  key={d.teamId}
                  cx={cx}
                  cy={y(d.value)}
                  r={you ? 6 : 4.5}
                  fill={d.color}
                  stroke={you ? CHART_INK.frame : CHART_INK.paper}
                  strokeWidth={you ? 2 : 1}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
