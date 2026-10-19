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
  /** What the market pays for this spec at its optimum, 0..1. The weight LINE
   *  is drawn between the first and last of these, so `rows` must arrive
   *  sorted descending. `null` for a spec with no weight to show. */
  weight: number | null;
  /**
   * teamId → that team's WEIGHTED VALUE for this spec, on the same 0..1 scale
   * as `weight`.
   *
   * ⚠ NOT an investment position. It was `(value − min) / (max − min)` — how
   * far up the range the team spent — which shares an axis with the weight
   * without being comparable to it. A bubble now sits above or below the line
   * by exactly the amount the team over- or under-captured.
   */
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

  // The two ends of the weight line. `rows` arrives sorted descending, so these
  // are the heaviest and lightest spec. A row with no weight cannot anchor it.
  const weighted = rows.map((r) => r.weight).filter((w): w is number => w != null && Number.isFinite(w));
  const first = weighted[0] ?? null;
  const last = weighted[weighted.length - 1] ?? null;

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

      {/* NO NUMBERS ON THE Y AXIS (2026-10-19). The axis carries a comparison,
          not a reading: a bubble's height against the weight line is the whole
          message, and a 0.00–1.00 ladder beside it invited arithmetic on a
          normalised share nobody needs to quote. The gridlines stay as a
          straightedge for the eye. */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={PAD.left} y1={y(t)} x2={width - PAD.right} y2={y(t)}
              stroke={CHART_INK.grid} strokeDasharray="2 3" />
      ))}

      {/* THE WEIGHT LINE — one straight segment from the heaviest spec to the
          lightest. The columns are sorted descending by weight, so it falls
          left to right and every bubble reads as above or below what the market
          asked for. Deliberately NOT a polyline through each weight: the specs
          are categories, not a series, so joining them would imply a slope
          between neighbours that does not exist. */}
      {first != null && last != null && (
        <line
          x1={PAD.left + colW / 2}
          y1={y(first)}
          x2={PAD.left + (rows.length - 1) * colW + colW / 2}
          y2={y(last)}
          stroke={CHART_INK.frame}
          strokeWidth={2}
        />
      )}

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

            {/* The per-column weight TICK was here. The weight line above
                carries it now — a tick on every column drew the same quantity
                twice and competed with the bubbles for the same pixels. */}

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
