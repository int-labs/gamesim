// Shared chart vocabulary: palette, team colours, axis ticks.
//
// Hand-built SVG throughout — there is no chart library in this repo, and the
// two candidates both lose: `recharts` brings its own React layer to theme
// against `font-pixel`, and d3's umbrella package pulls DOM modules that fight
// React for the nodes. `d3-scale`/`d3-shape` would be the only defensible
// additions, and `niceTicks` below is the single thing they'd have bought.

/** Plot furniture. Matches PixelStepLine / PixelStackedBar exactly — these are
 *  the paper, ink and rule of the pixel sheet, not chart-specific choices. */
export const CHART_INK = {
  paper: '#fdf8ec',
  frame: '#2a2017',
  grid:  '#bfae90',
  label: '#5a4a37',
  zero:  '#2a2017',
} as const;

/**
 * Series colours, in assignment order.
 *
 * Chosen for separation at small size on cream paper; the first three match the
 * operator's own chart mockups so a reviewer comparing them sees the same
 * companies in the same colours.
 */
export const SERIES_COLORS = [
  '#4C72B0',
  '#DD8452',
  '#55A868',
  '#C44E52',
  '#9B59B6',
  '#8C8C8C',
  '#CCB974',
  '#64B5CD',
] as const;

/**
 * teamId → colour.
 *
 * BUILT ONCE FROM THE ROSTER, READ ONLY BY ID. The assignment walks the roster
 * to keep colours distinct, but nothing downstream may index a colour by
 * position: a chart that did would repaint a team the moment the roster order
 * shifted between rounds, and the debrief puts several rounds side by side.
 *
 * More teams than colours wraps rather than throwing — two teams sharing a
 * colour is a legible chart; a crash is not.
 */
export function buildTeamPalette(teamIds: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of teamIds) {
    // Keyed off `out.size`, not the loop position: a duplicate id must not
    // consume a colour and shift every team after it.
    if (!out.has(id)) out.set(id, SERIES_COLORS[out.size % SERIES_COLORS.length]);
  }
  return out;
}

/** A colour for a team that the palette has never seen — a defensive fallback,
 *  not a normal path. Grey reads as "unassigned" rather than as a rival. */
export const UNKNOWN_SERIES = '#8C8C8C';

export const colorFor = (palette: Map<string, string>, teamId: string): string =>
  palette.get(teamId) ?? UNKNOWN_SERIES;

/**
 * Axis ticks on 1/2/5 steps, spanning `min`..`max`.
 *
 * This is the one piece of real charting maths here, and the reason to write it
 * rather than eyeball it: a tick algorithm that picks readable round numbers
 * across arbitrary ranges is easy to get subtly wrong, and every money chart in
 * the debrief shares this one.
 *
 * Returns a single tick for a degenerate range rather than dividing by zero.
 */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) return [min];

  const raw  = (max - min) / Math.max(1, target);
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;

  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;

  const out: number[] = [];
  // Half a step of slack on the bound: floating-point accumulation otherwise
  // drops the final tick on ranges like 0..0.3.
  for (let v = lo; v <= hi + step * 0.5; v += step) {
    out.push(Math.round(v / step) * step);
  }
  return out;
}

/**
 * The value domain for a set of series, ALWAYS INCLUDING ZERO.
 *
 * Money in this sim goes negative — revenue and profit both do in the operator's
 * own mockups — and a domain that floated off zero would draw a loss as a short
 * bar rather than one below the line.
 */
export function domainOf(values: readonly (number | null)[]): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  // A flat all-zero series still needs height, or every bar renders at 0px.
  if (min === 0 && max === 0) return { min: 0, max: 1 };
  return { min, max };
}

/** Compact money for a value label — full precision belongs in the table, not
 *  on top of a bar 30px wide. */
export function shortMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
