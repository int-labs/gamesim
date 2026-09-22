import { CHART_INK } from './chartTheme';
import { EmptyPlot } from './PixelBarChart';

/**
 * Voice of Customer — one row per spec, on a shared 0..1 axis.
 *
 * Each row carries a WEIGHT TICK (how much the market cares) and one DOT PER
 * TEAM (how far up that spec the team invested). Horizontal, because six spec
 * names read flat on the left and would need rotating on an x-axis.
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
  width?:  number;
  /** Row pitch. The plot grows with the row count rather than compressing. */
  rowH?:   number;
  /** Drawn thicker with a ring, so a player finds themselves at a glance. */
  youId?:  string | null;
}

const PAD = { top: 16, right: 16, bottom: 22, left: 92 };

export function PixelVocPlot({ rows, width = 340, rowH = 26, youId = null }: Props) {
  if (rows.length === 0) return <EmptyPlot width={width} height={120} />;

  const height = PAD.top + rows.length * rowH + PAD.bottom;
  const plotW = width - PAD.left - PAD.right;
  const x = (v: number) => PAD.left + Math.max(0, Math.min(1, v)) * plotW;

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
          <line x1={x(t)} y1={PAD.top} x2={x(t)} y2={PAD.top + rows.length * rowH}
                stroke={CHART_INK.grid} strokeDasharray="2 3" />
          <text x={x(t)} y={height - 8} textAnchor="middle"
                className="chart-label" fill={CHART_INK.label}>
            {t.toFixed(2)}
          </text>
        </g>
      ))}

      {rows.map((r, i) => {
        const y = PAD.top + i * rowH + rowH / 2;
        return (
          <g key={r.id}>
            <text x={PAD.left - 6} y={y + 3} textAnchor="end"
                  className="chart-label" fill={CHART_INK.label}>
              {r.label}
            </text>

            <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y}
                  stroke={CHART_INK.grid} strokeWidth={2} />

            {/* The weight tick: a vertical bar, deliberately unlike the dots,
                because it is a different kind of quantity. */}
            {r.weight != null && Number.isFinite(r.weight) && (
              <line x1={x(r.weight)} y1={y - 7} x2={x(r.weight)} y2={y + 7}
                    stroke={CHART_INK.frame} strokeWidth={2} />
            )}

            {r.dots.map((d) => {
              const you = d.teamId === youId;
              return (
                <circle
                  key={d.teamId}
                  cx={x(d.value)}
                  cy={y}
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
