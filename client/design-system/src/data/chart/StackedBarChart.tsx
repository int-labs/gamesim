import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { tv } from "../../lib/tv";
import { Tooltip, TooltipProvider } from "../../overlays/tooltip/Tooltip";
import { tokens } from "../../tokens";
import { AxisLabel } from "./AxisLabel";
import { barChartVariants } from "./BarChart";
import { useChartLabelling } from "./ChartPanel";
import { colorAt, fillClasses, isValue, sameSet, valueClasses, type ChartColor, type ChartSeries } from "./series";
import { niceTicks } from "./ticks";

const CHART = tokens.component.chart;
const px = (value: string) => Number.parseFloat(value);
const PLOT_HEIGHT = px(CHART["plot-height"]);
/** The top grid line's distance from the top of the plot, so its label fits. */
const PLOT_INSET = px(CHART["plot-inset"]);
/** A segment shorter than its value's line keeps the value for its tooltip. */
const SEGMENT_MIN_HEIGHT = px(CHART["segment-min-height"]);
/** A value written in a segment keeps this far from the bar's sides. */
const VALUE_INSET = px(tokens.spacing["1"]);
/** Bars grow in one after another, this far apart. */
const STAGGER = px(tokens.stagger.list);

export interface StackedChartRow {
  /** The team, as the server writes it: "Alpha (1)". */
  label: string;
  /** A value for each series key; null or missing while it has none. */
  values: Readonly<Record<string, number | null | undefined>>;
  /** A short line under the team's name, in brand indigo: its interest rate on a deposits slide ("1.50%"). `captionLabel` names it. */
  caption?: string;
}

export interface StackedBarChartMessages {
  /** A team without any value, in its tooltip and for screen readers. */
  noValue: string;
  /** Over the plot when no team has a value. */
  empty: string;
  /** Over the plot when every value is 0 (a round nobody has played yet). */
  zero: string;
  /** Before a team's total, when it has more than one series. */
  total: string;
  /** What screen readers call the chart. */
  chart: string;
}

const defaultMessages: StackedBarChartMessages = {
  noValue: "No value",
  empty: "No values yet",
  zero: "All values are 0",
  total: "Total",
  chart: "stacked bar chart",
};

/**
 * BarChart's look with a bar per team split by series: the values up the side on gray 200 grid
 * lines, the teams along the bottom, and a segment per series stacked from the zero line (a loss
 * below it), each value written inside its segment when it fits, in SemiBold 14/20 as Figma's
 * stacked bars (5204:98482). The bar is two fifths of its column, wider than BarChart's so the
 * values fit. The legend sits under the chart, as Figma's: an 8 px dot and the series' name in
 * SemiBold 14/20, 20 px apart.
 */
export const stackedBarChartVariants = tv({
  slots: {
    root: "flex flex-col gap-(--chart-legend-offset)",
    body: "flex gap-(--chart-axis-gap) px-2",
    axisName: "flex shrink-0 items-center justify-center",
    axisNameText: "chart-axis-label type-caption whitespace-nowrap text-chart-label",
    plot: "relative",
    stack: "absolute inset-y-0 left-1/2 w-2/5 max-w-(--chart-stack-max-width) -translate-x-1/2",
    segment: [
      "chart-bar absolute inset-x-0 flex items-center justify-center overflow-hidden",
      "group-hover/column:brightness-90 group-focus-visible/column:brightness-90 motion-reduce:transition-none",
    ],
    value: "type-body font-semibold whitespace-nowrap tabular-nums",
    anchor: "pointer-events-none absolute inset-x-0",
    legend: "flex flex-wrap items-center justify-center gap-x-(--chart-legend-gap) gap-y-1",
    legendItem: "flex items-center gap-(--chart-legend-item-gap) type-body font-semibold text-fg-primary",
    caption: "type-body font-semibold text-fg-accent tabular-nums",
    dot: "size-(--chart-legend-dot) shrink-0 rounded-full",
    tipRow: "flex items-center gap-2",
    tipTotal: "border-t border-line-hairline pt-1",
  },
  variants: {
    /** Fills its container's height (a slide): the plot takes what the legend and the team names leave. */
    fill: {
      true: { root: "h-full", body: "min-h-0 flex-1", plot: "min-h-0 flex-1" },
      false: { plot: "h-(--chart-plot-height)" },
    },
  },
  defaultVariants: { fill: false },
});

export interface StackedBarChartProps {
  /** A bar per row, in order: up to about ten teams. Long names wrap to two lines between words and are cut with "…"; the tooltip gives them whole. */
  rows: StackedChartRow[];
  /** The series, stacked from the zero line in this order and listed in the legend. One series makes one plain bar per team. */
  series: ChartSeries[];
  /** Writes a value for the tooltip and screen readers. */
  format: (value: number) => string;
  /** Writes the axis values and the values in the segments, when they should read shorter ("76B"). Default `format`. */
  formatTick?: (value: number) => string;
  /** The value axis's name up its side: "Growth in Deposits". */
  axisLabel?: string;
  /** What the rows' captions are, in the legend and for screen readers: "Interest rate". */
  captionLabel?: string;
  /** Write each value inside its segment, where it fits. Default true; false leaves the values to the tooltip. */
  showValues?: boolean;
  /** Fill the container's height, as in a slide, rather than the 270 px plot. */
  fill?: boolean;
  /** Over the plot when no team has a value, or when every value is 0. Default `messages.empty` and `messages.zero`. */
  emptyMessage?: ReactNode;
  messages?: Partial<StackedBarChartMessages>;
  /** Names the chart: the id of its title (a slide's or a card's). */
  "aria-labelledby"?: string;
  /** Names the chart when no title does. */
  "aria-label"?: string;
  className?: string;
}

interface Segment {
  series: ChartSeries;
  color: ChartColor;
  value: number;
  /** In pixels from the top of the plot. */
  top: number;
  height: number;
}

/**
 * Values per team and series as stacked bars, on round axis values from zero. Hovering a team's
 * column, or moving to it with the arrow keys, shows each series' value and the total in the
 * chart tooltip; screen readers hear the same. Every value 0, as in a round nobody has played,
 * still draws the teams and the zero line, with a line saying so. Bars grow in when they first
 * appear and move when the values change.
 */
export function StackedBarChart({
  rows,
  series,
  format,
  formatTick = format,
  axisLabel,
  captionLabel,
  showValues = true,
  fill = false,
  emptyMessage,
  messages,
  className,
  ...labelling
}: StackedBarChartProps) {
  const text = { ...defaultMessages, ...messages };
  const named = useChartLabelling(labelling);
  const emptyId = useId();
  const axisId = useId();
  const bar = barChartVariants();
  const slots = stackedBarChartVariants({ fill });
  const [active, setActive] = useState(0);
  const columnRefs = useRef<(HTMLElement | null)[]>([]);
  const plotRef = useRef<HTMLDivElement>(null);
  // The plot's height places the bars when the chart fills a slide.
  const [plotHeight, setPlotHeight] = useState(PLOT_HEIGHT);
  // Values wider than their bar, left to the tooltip.
  const [narrow, setNarrow] = useState<ReadonlySet<string>>(() => new Set());
  const valueRefs = useRef(new Map<string, HTMLElement>());

  const measure = useCallback(() => {
    const plot = plotRef.current;
    if (!plot) return;
    setPlotHeight(plot.clientHeight || PLOT_HEIGHT);
    const next = new Set<string>();
    for (const [id, element] of valueRefs.current) {
      const segment = element.parentElement;
      if (segment && element.scrollWidth + 2 * VALUE_INSET > segment.clientWidth) next.add(id);
    }
    setNarrow((last) => (sameSet(last, next) ? last : next));
  }, []);

  // Measured once drawn, in the fonts shown, after each change of values, and whenever the plot's size changes.
  useLayoutEffect(() => {
    measure();
  }, [measure, rows, series, fill, formatTick]);
  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(plot);
    return () => observer.disconnect();
  }, [measure]);

  const height = fill ? plotHeight : PLOT_HEIGHT;
  const colorOf = (item: ChartSeries, index: number) => colorAt(item.color, index);

  const totals = rows.map((row) =>
    series.reduce(
      (sum, item) => {
        const value = row.values[item.key];
        if (!isValue(value)) return sum;
        return value > 0 ? { ...sum, up: sum.up + value } : { ...sum, down: sum.down + value };
      },
      { up: 0, down: 0 },
    ),
  );
  const anyValue = rows.some((row) => series.some((item) => isValue(row.values[item.key])));
  const allZero = anyValue && totals.every((total) => total.up === 0 && total.down === 0);
  const ticks = anyValue ? niceTicks(Math.min(...totals.map((total) => total.down)), Math.max(...totals.map((total) => total.up))) : [];
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 0;
  /** Where a value sits, in pixels from the top of the plot. */
  const y = (value: number) => PLOT_INSET + (1 - (value - low) / (high - low || 1)) * (height - PLOT_INSET);
  // Lines and segment edges on whole pixels, so they stay crisp and meet without a gap.
  const lineTop = (value: number) => Math.min(height - 1, Math.round(y(value) - 0.5));
  const edge = (value: number) => Math.round(y(value));
  const zero = edge(0);

  /** A team's segments, from the zero line outwards: up for gains, down for losses. */
  const segmentsOf = (row: StackedChartRow): Segment[] => {
    let up = 0;
    let down = 0;
    const segments: Segment[] = [];
    series.forEach((item, index) => {
      const value = row.values[item.key];
      if (!isValue(value) || value === 0) return;
      const from = value > 0 ? up : down;
      const to = from + value;
      if (value > 0) up = to;
      else down = to;
      const top = edge(Math.max(from, to));
      const height = Math.max(1, edge(Math.min(from, to)) - top);
      segments.push({ series: item, color: colorOf(item, index), value, top, height });
    });
    return segments;
  };

  const current = Math.min(active, Math.max(0, rows.length - 1));
  // One tab stop for the chart; the arrow keys, Home and End move between teams.
  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    const targets: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: rows.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(rows.length - 1, target));
    setActive(next);
    columnRefs.current[next]?.focus();
  };

  const described = [axisLabel ? axisId : null, !anyValue || allZero ? emptyId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div role="group" aria-roledescription={text.chart} aria-describedby={described} className={slots.root({ className })} {...named}>
      <div className={slots.body()}>
        {axisLabel ? (
          <div className={slots.axisName()} style={{ height }}>
            <span id={axisId} className={slots.axisNameText()}>
              {axisLabel}
            </span>
          </div>
        ) : null}
        <div aria-hidden className={bar.yAxis()}>
          <div className={bar.ySizer()}>
            {ticks.map((tick) => (
              <div key={tick}>{formatTick(tick)}</div>
            ))}
          </div>
          {ticks.map((tick) => (
            <span key={tick} className={bar.yLabel()} style={{ top: y(tick) }}>
              {formatTick(tick)}
            </span>
          ))}
        </div>
        <div className={bar.main()}>
          <div ref={plotRef} className={slots.plot()}>
            {ticks.map((tick) => (
              <div key={tick} aria-hidden className={bar.grid()} style={{ top: lineTop(tick) }} />
            ))}
            <TooltipProvider>
              <div className={bar.columns()} onKeyDown={moveFocus}>
                {rows.map((row, index) => {
                  const segments = segmentsOf(row);
                  const shown = series.filter((item) => isValue(row.values[item.key]));
                  const total = totals[index] ?? { up: 0, down: 0 };
                  const parts = shown.map((item) => `${item.label} ${format(row.values[item.key] as number)}`);
                  if (shown.length > 1) parts.push(`${text.total} ${format(total.up + total.down)}`);
                  if (row.caption) parts.push(captionLabel ? `${captionLabel} ${row.caption}` : row.caption);
                  const valueText = parts.length > 0 ? parts.join(", ") : text.noValue;
                  const top = segments.length > 0 ? Math.min(...segments.map((segment) => segment.top)) : zero;
                  const bottom = segments.length > 0 ? Math.max(...segments.map((segment) => segment.top + segment.height)) : zero;
                  return (
                    <Column
                      key={`${index}-${row.label}`}
                      label={row.label}
                      valueText={valueText}
                      focusable={index === current}
                      onFocus={() => setActive(index)}
                      columnRef={(element) => {
                        columnRefs.current[index] = element;
                      }}
                      anchor={{ top, height: bottom - top }}
                      tip={
                        <span className={bar.tip()}>
                          <span className={bar.tipLabel()}>{row.label}</span>
                          {shown.length === 0 ? <span className={bar.tipValue()}>{text.noValue}</span> : null}
                          {shown.map((item) => (
                            <span key={item.key} className={slots.tipRow()}>
                              <span aria-hidden className={slots.dot({ className: fillClasses[colorOf(item, series.indexOf(item))] })} />
                              <span className={bar.tipLabel()}>{item.label}</span>
                              <span className={bar.tipValue()}>{format(row.values[item.key] as number)}</span>
                            </span>
                          ))}
                          {shown.length > 1 ? (
                            <span className={slots.tipRow({ className: slots.tipTotal() })}>
                              <span className={bar.tipLabel()}>{text.total}</span>
                              <span className={bar.tipValue()}>{format(total.up + total.down)}</span>
                            </span>
                          ) : null}
                          {row.caption ? (
                            <span className={slots.tipRow()}>
                              {captionLabel ? <span className={bar.tipLabel()}>{captionLabel}</span> : null}
                              <span className={bar.tipValue()}>{row.caption}</span>
                            </span>
                          ) : null}
                        </span>
                      }
                      slots={slots}
                      bar={bar}
                    >
                      {segments.map((segment) => {
                        const id = `${index}-${segment.series.key}`;
                        const style = {
                          "--bar-top": `${segment.top}px`,
                          "--bar-height": `${segment.height}px`,
                          "--bar-zero": `${zero}px`,
                          "--bar-delay": `${index * STAGGER}ms`,
                        } as CSSProperties;
                        const writesValue = showValues && segment.height >= SEGMENT_MIN_HEIGHT;
                        return (
                          <div key={segment.series.key} className={slots.segment({ className: fillClasses[segment.color] })} style={style}>
                            {writesValue ? (
                              <span
                                ref={(element) => {
                                  if (element) valueRefs.current.set(id, element);
                                  else valueRefs.current.delete(id);
                                }}
                                className={slots.value({ className: cn(valueClasses[segment.color], narrow.has(id) && "invisible") })}
                              >
                                {formatTick(segment.value)}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </Column>
                  );
                })}
              </div>
            </TooltipProvider>
            {!anyValue || allZero ? (
              <p id={emptyId} className={bar.empty()}>
                {emptyMessage ?? (anyValue ? text.zero : text.empty)}
              </p>
            ) : null}
          </div>
          <div aria-hidden className={bar.xAxis()}>
            {rows.map((row, index) => (
              <div key={`${index}-${row.label}`} className={bar.xCell({ className: "flex-col" })}>
                <AxisLabel label={row.label} className={bar.xLabel()} lineClassName={bar.xLine()} unmeasuredClassName={bar.xUnmeasured()} />
                {row.caption ? <span className={slots.caption()}>{row.caption}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className={slots.legend()}>
        {series.map((item, index) => (
          <span key={item.key} className={slots.legendItem()}>
            <span className={slots.dot({ className: fillClasses[colorOf(item, index)] })} />
            {item.label}
          </span>
        ))}
        {captionLabel && rows.some((row) => row.caption) ? (
          <span className={slots.legendItem()}>
            <span className={slots.dot({ className: "bg-accent" })} />
            {captionLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface ColumnProps {
  label: string;
  valueText: string;
  focusable: boolean;
  onFocus: () => void;
  columnRef: (element: HTMLElement | null) => void;
  /** Where the tooltip points: the whole bar, or the zero line when there is none. */
  anchor: { top: number; height: number };
  tip: ReactNode;
  children: ReactNode;
  slots: ReturnType<typeof stackedBarChartVariants>;
  bar: ReturnType<typeof barChartVariants>;
}

/** A team's column: all of it opens the tooltip, which points at the bar. */
function Column({ label, valueText, focusable, onFocus, columnRef, anchor, tip, children, slots, bar }: ColumnProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <Tooltip describe={false} anchor={anchorRef} content={tip}>
      <div
        ref={columnRef}
        role="img"
        aria-label={`${label}: ${valueText}`}
        tabIndex={focusable ? 0 : -1}
        onFocus={onFocus}
        className={bar.column()}
      >
        <div className={slots.stack()}>
          {children}
          <div ref={anchorRef} className={slots.anchor()} style={{ top: anchor.top, height: anchor.height }} />
        </div>
      </div>
    </Tooltip>
  );
}
