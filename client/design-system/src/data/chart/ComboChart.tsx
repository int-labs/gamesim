import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { tv } from "../../lib/tv";
import { Tooltip, TooltipProvider } from "../../overlays/tooltip/Tooltip";
import { tokens } from "../../tokens";
import { barChartVariants } from "./BarChart";
import { useChartLabelling, type ChartLabelling } from "./ChartPanel";
import { fillClasses, isValue, strokeClasses, type ChartColor } from "./series";
import { stackedBarChartVariants } from "./StackedBarChart";
import { evenTicks } from "./ticks";

const CHART = tokens.component.chart;
const px = (value: string) => Number.parseFloat(value);
const PLOT_HEIGHT = px(CHART["plot-height-sm"]);
/** The top grid line's distance from the top of the plot, so its label fits. */
const PLOT_INSET = px(CHART["plot-inset"]);
const LINE_WIDTH = px(CHART["line-width"]);
/** Grid lines: the zero line and four steps up, as Figma's. */
const STEPS = 4;
/** Bars grow in one after another, this far apart... */
const STAGGER = px(tokens.stagger.list);
/** ...all of them within the time ten would take. */
const STAGGER_STEPS = 10;
/** The least room between two labels along the bottom, as Figma's 2; short of it, every second (or third...) one shows. */
const LABEL_GAP = px(CHART["histogram-gap"]);

export interface ComboChartRow {
  /** The point along the bottom: "15". */
  label: string;
  /** The bar's value, counted up the end side; null while it has none. */
  bar: number | null;
  /** The line's value, counted up the start side; null while it has none. */
  line: number | null;
  /** Draws the bar in the muted gray: a point outside the chosen range (a credit score the bank does not lend to). */
  muted?: boolean;
}

export interface ComboSeries {
  /** Its name in the legend, and in the tooltip and for screen readers unless `tipLabel` is given: "Number of customers". */
  label: string;
  /** Its name in the tooltip and for screen readers, where it differs from the legend's (Figma's charge-offs: "Customer Count"). */
  tipLabel?: string;
  /** Writes a value for the tooltip and screen readers, and for its axis unless `formatTick` is given. */
  format: (value: number) => string;
  /** Writes its axis values, when they should read shorter than `format`. */
  formatTick?: (value: number) => string;
  /** Its colour from the chart palette. Default: the bars indigo-soft, the line pink, as Figma's charge-offs. */
  color?: ChartColor;
}

export interface ComboChartMessages {
  /** A point without a value, in its tooltip and for screen readers. */
  noValue: string;
  /** Over the plot when no point has a value. */
  empty: string;
  /** What screen readers call the chart. */
  chart: string;
}

const defaultMessages: ComboChartMessages = { noValue: "No value", empty: "No values yet", chart: "bar and line chart" };

/**
 * The charge-offs chart of Figma's loan pages (5204:98482): bars 2 px apart filling their columns,
 * counted up the end side, and a line with a 6 px point on each, counted up the start side, both
 * on the same five gray 200 grid lines over a 140 px plot; the points along the bottom, and the
 * legend over the plot, a 29 x 15 swatch before each name in Source Sans 12/16.
 */
export const comboChartVariants = tv({
  slots: {
    root: "flex flex-col gap-4",
    legend: "flex flex-wrap items-center gap-x-(--chart-legend-gap) gap-y-1",
    legendItem: "flex items-center gap-2 type-caption text-chart-label",
    swatch: "h-(--chart-legend-swatch-height) w-(--chart-legend-swatch-width) shrink-0",
    lineSwatch: "relative flex h-(--chart-legend-swatch-height) w-(--chart-legend-swatch-width) shrink-0 items-center justify-center",
    lineSwatchStroke: "absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2",
    body: "flex gap-(--chart-axis-gap)",
    endLabel: "absolute inset-s-0 -translate-y-1/2 type-caption whitespace-nowrap text-chart-label",
    plot: "relative h-(--chart-plot-height-sm)",
    column: "group/column relative min-w-0 flex-1 rounded-sm outline-offset-0 focus-visible:outline-2 focus-visible:outline-focus-ring",
    bar: "chart-bar absolute inset-x-px group-hover/column:brightness-90 group-focus-visible/column:brightness-90 motion-reduce:transition-none",
    line: "pointer-events-none absolute inset-0 size-full overflow-visible fill-none transition-opacity duration-slow ease-standard starting:opacity-0 motion-reduce:transition-none",
    point: "pointer-events-none absolute size-(--chart-point-size) -translate-1/2 rounded-full border border-surface-card",
    anchor: "pointer-events-none absolute inset-x-0 h-0",
    xCell: "flex min-w-0 flex-1 justify-center",
    xLabel: "type-caption whitespace-nowrap text-chart-label",
    // BarChart's line in gray 600, which reads 4.5:1 on the slate panel as well as on white.
    empty: "text-fg-muted",
  },
});

export interface ComboChartProps extends ChartLabelling {
  /** A bar and a point of the line per row, in order along the bottom: twenty-one credit scores fit a 436 px card. */
  rows: ComboChartRow[];
  /** The bars and their scale, up the end side. */
  bar: ComboSeries;
  /** The line and its scale, up the start side. */
  line: ComboSeries;
  /** What the points along the bottom are, before the point in the tooltip and for screen readers: "Minimum Credit Score". */
  pointLabel?: string;
  /** What the muted bars are, in the legend and the tooltip: "Not lent to". */
  mutedLabel?: string;
  /** Over the plot when no point has a value. Default `messages.empty`. */
  emptyMessage?: ReactNode;
  messages?: Partial<ComboChartMessages>;
  className?: string;
}

/**
 * Two values per point: a bar and a line, each on its own scale from zero, sharing the grid
 * lines. Hovering a point's column, or moving to it with the arrow keys, shows the point and both
 * values in the chart tooltip; screen readers hear the same. Labels along the bottom that no
 * longer fit leave every second one (or third) to show. Bars grow in when they first appear and
 * move when the values change. Values below zero draw at zero.
 */
export function ComboChart({ rows, bar: barSeries, line: lineSeries, pointLabel, mutedLabel, emptyMessage, messages, className, ...labelling }: ComboChartProps) {
  const text = { ...defaultMessages, ...messages };
  const named = useChartLabelling(labelling);
  const emptyId = useId();
  const bar = barChartVariants();
  const stacked = stackedBarChartVariants();
  const slots = comboChartVariants();
  const [active, setActive] = useState(0);
  const columnRefs = useRef<(HTMLElement | null)[]>([]);
  const plotRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);
  // Every how manyth label along the bottom shows.
  const [labelStep, setLabelStep] = useState(1);

  const barColor = barSeries.color ?? 2;
  const lineColor = lineSeries.color ?? 3;
  const barName = barSeries.tipLabel ?? barSeries.label;
  const lineName = lineSeries.tipLabel ?? lineSeries.label;
  const formatBarTick = barSeries.formatTick ?? barSeries.format;
  const formatLineTick = lineSeries.formatTick ?? lineSeries.format;

  const measure = useCallback(() => {
    const plot = plotRef.current;
    const labels = labelRefs.current.filter((label): label is HTMLElement => label !== null);
    if (!plot || labels.length === 0) return;
    const column = plot.clientWidth / labels.length;
    const widest = Math.max(...labels.map((label) => label.scrollWidth));
    setLabelStep(column > 0 ? Math.max(1, Math.ceil((widest + LABEL_GAP) / column)) : 1);
  }, []);

  // Measured once drawn, after each change of points, whenever the plot's width changes, and once the fonts are in.
  useLayoutEffect(() => {
    measure();
  }, [measure, rows]);
  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot) return undefined;
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(plot);
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [measure]);

  const barValues = rows.map((row) => row.bar).filter(isValue);
  const lineValues = rows.map((row) => row.line).filter(isValue);
  const empty = barValues.length === 0 && lineValues.length === 0;
  const barTicks = empty ? [] : evenTicks(Math.max(0, ...barValues), STEPS);
  const lineTicks = empty ? [] : evenTicks(Math.max(0, ...lineValues), STEPS);
  const barHigh = barTicks[STEPS] ?? 1;
  const lineHigh = lineTicks[STEPS] ?? 1;
  /** Where a share of an axis sits, in pixels from the top of the plot. */
  const y = (share: number) => PLOT_INSET + (1 - share) * (PLOT_HEIGHT - PLOT_INSET);
  // Grid lines and bar edges on whole pixels, so they stay crisp; the bottom line inside the plot.
  const lineTop = (share: number) => Math.min(PLOT_HEIGHT - 1, Math.round(y(share) - 0.5));
  const zero = Math.round(y(0));
  const barTop = (value: number) => Math.round(y(Math.max(0, value) / barHigh));
  const pointY = (value: number) => y(Math.max(0, value) / lineHigh);

  const count = rows.length;
  const xOf = (index: number) => `${((index + 0.5) / Math.max(1, count)) * 100}%`;
  const delayStep = STAGGER * Math.min(1, STAGGER_STEPS / Math.max(1, count));
  // The line runs through consecutive points with values; a point without one breaks it.
  const runs: { index: number; value: number }[][] = [];
  rows.forEach((row, index) => {
    if (!isValue(row.line)) return;
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1]?.index === index - 1) run.push({ index, value: row.line });
    else runs.push([{ index, value: row.line }]);
  });

  const current = Math.min(active, Math.max(0, count - 1));
  // One tab stop for the chart; the arrow keys, Home and End move from point to point.
  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    const targets: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: count - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(count - 1, target));
    setActive(next);
    columnRefs.current[next]?.focus();
  };

  const anyMuted = rows.some((row) => row.muted);

  return (
    <div role="group" aria-roledescription={text.chart} aria-describedby={empty ? emptyId : undefined} className={slots.root({ className })} {...named}>
      <div aria-hidden className={slots.legend()}>
        <span className={slots.legendItem()}>
          <span className={slots.swatch({ className: fillClasses[barColor] })} />
          {barSeries.label}
        </span>
        <span className={slots.legendItem()}>
          <span className={slots.lineSwatch()}>
            <span className={slots.lineSwatchStroke({ className: fillClasses[lineColor] })} />
            <span className={slots.point({ className: cn("top-1/2 left-1/2", fillClasses[lineColor]) })} />
          </span>
          {lineSeries.label}
        </span>
        {mutedLabel && anyMuted ? (
          <span className={slots.legendItem()}>
            <span className={slots.swatch({ className: "bg-chart-muted" })} />
            {mutedLabel}
          </span>
        ) : null}
      </div>
      <div className={slots.body()}>
        <div aria-hidden className={bar.yAxis()}>
          <div className={bar.ySizer()}>
            {lineTicks.map((tick) => (
              <div key={tick}>{formatLineTick(tick)}</div>
            ))}
          </div>
          {lineTicks.map((tick, index) => (
            <span key={tick} className={bar.yLabel()} style={{ top: y(index / STEPS) }}>
              {formatLineTick(tick)}
            </span>
          ))}
        </div>
        <div className={bar.main()}>
          <div ref={plotRef} className={slots.plot()}>
            {empty
              ? null
              : Array.from({ length: STEPS + 1 }, (_, index) => <div key={index} aria-hidden className={bar.grid()} style={{ top: lineTop(index / STEPS) }} />)}
            <TooltipProvider>
              <div className={bar.columns()} onKeyDown={moveFocus}>
                {rows.map((row, index) => {
                  const barText = isValue(row.bar) ? barSeries.format(row.bar) : text.noValue;
                  const lineText = isValue(row.line) ? lineSeries.format(row.line) : text.noValue;
                  const point = pointLabel ? `${pointLabel} ${row.label}` : row.label;
                  const note = row.muted && mutedLabel ? `, ${mutedLabel}` : "";
                  const top = isValue(row.bar) && row.bar > 0 ? barTop(row.bar) : zero;
                  const markTop = Math.min(top, isValue(row.line) ? pointY(row.line) : zero);
                  return (
                    <Column
                      key={`${index}-${row.label}`}
                      label={`${point}: ${barName} ${barText}, ${lineName} ${lineText}${note}`}
                      tip={
                        <span className={bar.tip()}>
                          {pointLabel ? (
                            <span className={stacked.tipRow()}>
                              <span className={bar.tipLabel()}>{pointLabel}</span>
                              <span className={bar.tipValue()}>{row.label}</span>
                            </span>
                          ) : (
                            <span className={bar.tipLabel()}>{row.label}</span>
                          )}
                          <span className={stacked.tipRow()}>
                            <span aria-hidden className={stacked.dot({ className: row.muted ? "bg-chart-muted" : fillClasses[barColor] })} />
                            <span className={bar.tipLabel()}>{barName}</span>
                            <span className={bar.tipValue()}>{barText}</span>
                          </span>
                          <span className={stacked.tipRow()}>
                            <span aria-hidden className={stacked.dot({ className: fillClasses[lineColor] })} />
                            <span className={bar.tipLabel()}>{lineName}</span>
                            <span className={bar.tipValue()}>{lineText}</span>
                          </span>
                          {row.muted && mutedLabel ? <span className={bar.tipLabel()}>{mutedLabel}</span> : null}
                        </span>
                      }
                      barStyle={
                        isValue(row.bar) && row.bar > 0
                          ? ({
                              "--bar-top": `${top}px`,
                              "--bar-height": `${Math.max(1, zero - top)}px`,
                              "--bar-zero": `${zero}px`,
                              "--bar-delay": `${Math.round(index * delayStep)}ms`,
                            } as CSSProperties)
                          : undefined
                      }
                      barClass={row.muted ? "bg-chart-muted" : fillClasses[barColor]}
                      anchorTop={markTop}
                      focusable={index === current}
                      onFocus={() => setActive(index)}
                      columnRef={(element) => {
                        columnRefs.current[index] = element;
                      }}
                      slots={slots}
                    />
                  );
                })}
              </div>
            </TooltipProvider>
            <svg aria-hidden viewBox={`0 0 ${Math.max(1, count)} ${PLOT_HEIGHT}`} preserveAspectRatio="none" className={slots.line({ className: strokeClasses[lineColor] })}>
              {runs
                .filter((run) => run.length > 1)
                .map((run) => (
                  <polyline
                    key={run[0]?.index}
                    points={run.map((point) => `${point.index + 0.5},${pointY(point.value)}`).join(" ")}
                    strokeWidth={LINE_WIDTH}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
            </svg>
            {rows.map((row, index) =>
              isValue(row.line) ? (
                <span
                  key={`${index}-${row.label}`}
                  aria-hidden
                  className={slots.point({ className: fillClasses[lineColor] })}
                  style={{ left: xOf(index), top: pointY(row.line) }}
                />
              ) : null,
            )}
            {empty ? (
              <p id={emptyId} className={bar.empty({ className: slots.empty() })}>
                {emptyMessage ?? text.empty}
              </p>
            ) : null}
          </div>
          <div aria-hidden className={bar.xAxis()}>
            {rows.map((row, index) => (
              <div key={`${index}-${row.label}`} className={slots.xCell()}>
                <span
                  ref={(element) => {
                    labelRefs.current[index] = element;
                  }}
                  className={slots.xLabel({ className: index % labelStep === 0 ? undefined : "invisible" })}
                >
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden className={bar.yAxis()}>
          <div className={bar.ySizer()}>
            {barTicks.map((tick) => (
              <div key={tick}>{formatBarTick(tick)}</div>
            ))}
          </div>
          {barTicks.map((tick, index) => (
            <span key={tick} className={slots.endLabel()} style={{ top: y(index / STEPS) }}>
              {formatBarTick(tick)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ColumnProps {
  label: string;
  tip: ReactNode;
  /** The bar's top, height and zero line, or none when it has no value above 0. */
  barStyle: CSSProperties | undefined;
  barClass: string;
  /** Where the tooltip points: the top of the bar or the line's point, whichever is higher, in pixels from the plot's top. */
  anchorTop: number;
  focusable: boolean;
  onFocus: () => void;
  columnRef: (element: HTMLElement | null) => void;
  slots: ReturnType<typeof comboChartVariants>;
}

/** A point's column: all of it opens the tooltip, which points at the top of what it draws. */
function Column({ label, tip, barStyle, barClass, anchorTop, focusable, onFocus, columnRef, slots }: ColumnProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <Tooltip describe={false} anchor={anchorRef} content={tip}>
      <div ref={columnRef} role="img" aria-label={label} tabIndex={focusable ? 0 : -1} onFocus={onFocus} className={slots.column()}>
        {barStyle ? <div className={slots.bar({ className: barClass })} style={barStyle} /> : null}
        <div ref={anchorRef} className={slots.anchor()} style={{ top: anchorTop }} />
      </div>
    </Tooltip>
  );
}
