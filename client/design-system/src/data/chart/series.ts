/** A colour of the chart palette, first to eighth. */
export type ChartColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const PALETTE: readonly ChartColor[] = [1, 2, 3, 4, 5, 6, 7, 8];

export interface ChartSeries {
  /** The key of its values in each row. */
  key: string;
  /** Its name in the legend, the tooltip and for screen readers. */
  label: string;
  /** Its colour from the chart palette. Default: its place among the series. */
  color?: ChartColor;
}

/** A series' colour: its own, or the palette's in its place among the series. */
export function colorAt(color: ChartColor | undefined, index: number): ChartColor {
  return color ?? PALETTE[index % PALETTE.length] ?? 1;
}

/** A series' fill: a bar, a segment, a dot. */
export const fillClasses: Record<ChartColor, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
  6: "bg-chart-6",
  7: "bg-chart-7",
  8: "bg-chart-8",
};

/** A series' stroke: a line, a donut's segment. */
export const strokeClasses: Record<ChartColor, string> = {
  1: "stroke-chart-1",
  2: "stroke-chart-2",
  3: "stroke-chart-3",
  4: "stroke-chart-4",
  5: "stroke-chart-5",
  6: "stroke-chart-6",
  7: "stroke-chart-7",
  8: "stroke-chart-8",
};

/** The text on each colour that reads at 4.5:1 or more: white on the indigos and the blue, gray 900 on the rest (pink 5:1). */
export const valueClasses: Record<ChartColor, string> = {
  1: "text-fg-on-accent",
  2: "text-fg-on-accent",
  3: "text-fg-primary",
  4: "text-fg-on-accent",
  5: "text-fg-primary",
  6: "text-fg-primary",
  7: "text-fg-primary",
  8: "text-fg-primary",
};

/** A value to draw: a finite number. */
export function isValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Whether two sets hold the same items. */
export function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  return a.size === b.size && [...a].every((item) => b.has(item));
}
