import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { tv } from "../../lib/tv";
import { Tooltip, TooltipProvider } from "../../overlays/tooltip/Tooltip";
import { tokens } from "../../tokens";
import { barChartVariants } from "./BarChart";
import { useChartLabelling, type ChartLabelling } from "./ChartPanel";
import { colorAt, fillClasses, isValue, sameSet, valueClasses, type ChartColor, type ChartSeries } from "./series";
import { stackedBarChartVariants } from "./StackedBarChart";
import { niceTicks } from "./ticks";

const px = (value: string) => Number.parseFloat(value);
/** A value written in a segment keeps this far from the segment's ends. */
const VALUE_INSET = px(tokens.spacing["1"]);
/** Bars grow in one after another, this far apart. */
const STAGGER = px(tokens.stagger.list);

export interface HorizontalChartRow {
  /** The bar's name at its start: "Number of Accounts". */
  label: string;
  /** A value for each series key; null or missing while it has none. */
  values: Readonly<Record<string, number | null | undefined>>;
}

export interface HorizontalBarChartMessages {
  /** A bar without any value, in its tooltip and for screen readers. */
  noValue: string;
  /** Over the plot when no bar has a value. */
  empty: string;
  /** Over the plot when every value is 0. */
  zero: string;
  /** What screen readers call the chart. */
  chart: string;
}

const defaultMessages: HorizontalBarChartMessages = {
  noValue: "No value",
  empty: "No values yet",
  zero: "All values are 0",
  chart: "horizontal bar chart",
};

/**
 * The Account chart of Figma's product pages (5204:98482): a 60 px bar split by series between a
 * gray 200 line at its start and one under it, 16 px inside them, each value written in its
 * segment in SemiBold 14/20; the bar's name before it in Source Sans 12/16, on two lines; round
 * values under it; and the legend under the chart, StackedBarChart's (an 8 px dot before each
 * series' name).
 */
export const horizontalBarChartVariants = tv({
  slots: {
    // No room at the sides: the last axis value, centred on the bar's end, reaches into its panel's padding, as Figma's.
    root: "flex flex-col gap-(--chart-legend-offset)",
    body: "flex gap-(--chart-axis-gap)",
    names: "flex max-w-(--chart-row-label-width) shrink-0 flex-col gap-(--chart-horizontal-bar-gap) py-(--chart-horizontal-bar-gap)",
    name: "flex h-(--chart-horizontal-bar-height) items-center justify-end",
    nameText: "line-clamp-3 text-end type-caption wrap-break-word text-chart-label",
    main: "flex min-w-0 flex-1 flex-col gap-(--chart-axis-gap)",
    plot: "relative flex flex-col gap-(--chart-horizontal-bar-gap) border-b border-s border-chart-grid py-(--chart-horizontal-bar-gap)",
    track: "relative h-(--chart-horizontal-bar-height)",
    // Where zero is, when a loss puts it inside the plot rather than at its start.
    zeroLine: "pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-chart-grid",
    // BarChart's line in gray 600, which reads 4.5:1 on the slate panel as well as on white.
    empty: "text-fg-muted",
    segment: [
      "chart-bar-horizontal absolute inset-y-0 flex min-w-px items-center justify-center overflow-hidden outline-offset-2",
      "hover:brightness-90 focus-visible:z-raised focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:brightness-90 motion-reduce:transition-none",
    ],
    // A series at 0, or a bar without values: nothing to see, but a place to move to and hear.
    mark: "absolute inset-y-0 w-0 outline-offset-2 focus-visible:z-raised focus-visible:outline-2 focus-visible:outline-focus-ring",
    axis: "relative h-4",
    tick: "absolute top-0 -translate-x-1/2 type-caption whitespace-nowrap text-chart-label",
  },
});

export interface HorizontalBarChartProps extends ChartLabelling {
  /** A bar per row, in order: one for Figma's Account, a few at most. */
  rows: HorizontalChartRow[];
  /** The series, from the zero line in this order and listed in the legend. */
  series: ChartSeries[];
  /** Writes a value for the tooltip and screen readers. */
  format: (value: number) => string;
  /** Writes the axis values and the values in the segments, when they should read shorter ("15.9M"). Default `format`. */
  formatTick?: (value: number) => string;
  /** Write each value inside its segment, where it fits. Default true; false leaves the values to the tooltip. */
  showValues?: boolean;
  /** Over the plot when no bar has a value, or when every value is 0. Default `messages.empty` and `messages.zero`. */
  emptyMessage?: ReactNode;
  messages?: Partial<HorizontalBarChartMessages>;
  className?: string;
}

/** A place to move to with the arrow keys: a series of a bar, or a bar without any value. */
interface Stop {
  key: string;
  row: HorizontalChartRow;
  series?: ChartSeries;
  color?: ChartColor;
  value?: number;
  /** Where it starts and how wide it is, in percent of the bar's track. */
  start: number;
  width: number;
}

/**
 * Values per series as a bar split into segments, a bar per row, on round axis values from zero
 * (a loss goes left of the zero line). Hovering a segment, or moving to it with the arrow keys,
 * shows its series and value in the chart tooltip; screen readers hear every series of every
 * bar, one at 0 too, which has no segment to see. Segments grow in when they first appear and
 * move when the values change.
 */
export function HorizontalBarChart({
  rows,
  series,
  format,
  formatTick = format,
  showValues = true,
  emptyMessage,
  messages,
  className,
  ...labelling
}: HorizontalBarChartProps) {
  const text = { ...defaultMessages, ...messages };
  const named = useChartLabelling(labelling);
  const emptyId = useId();
  const bar = barChartVariants();
  const stacked = stackedBarChartVariants();
  const slots = horizontalBarChartVariants();
  const [active, setActive] = useState(0);
  const stopRefs = useRef<(HTMLElement | null)[]>([]);
  const plotRef = useRef<HTMLDivElement>(null);
  // Values wider than their segment, left to the tooltip.
  const [narrow, setNarrow] = useState<ReadonlySet<string>>(() => new Set());
  const valueRefs = useRef(new Map<string, HTMLElement>());

  // A segment's room is its share of the track (the plot's width), not its drawn width, which grows in from nothing.
  const measure = useCallback(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const next = new Set<string>();
    for (const [key, element] of valueRefs.current) {
      const room = (plot.clientWidth * Number(element.dataset.share ?? 0)) / 100;
      if (element.scrollWidth + 2 * VALUE_INSET > room) next.add(key);
    }
    setNarrow((last) => (sameSet(last, next) ? last : next));
  }, []);

  // Measured once drawn, after each change of values, whenever the plot's width changes, and once the fonts are in.
  useLayoutEffect(() => {
    measure();
  }, [measure, rows, series, formatTick]);
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
  /** Where a value sits, in percent of the track from its start. */
  const x = (value: number) => ((value - low) / (high - low || 1)) * 100;
  const zero = x(0);

  /** A bar's stops: each series with a value, stacked from the zero line outwards; or the bar itself, when it has none. */
  const stopsOf = (row: HorizontalChartRow, rowIndex: number): Stop[] => {
    let up = 0;
    let down = 0;
    const stops: Stop[] = [];
    series.forEach((item, index) => {
      const value = row.values[item.key];
      if (!isValue(value)) return;
      const from = value >= 0 ? up : down;
      const to = from + value;
      if (value >= 0) up = to;
      else down = to;
      const start = x(Math.min(from, to));
      stops.push({ key: `${rowIndex}-${item.key}`, row, series: item, color: colorAt(item.color, index), value, start, width: x(Math.max(from, to)) - start });
    });
    return stops.length > 0 ? stops : [{ key: `${rowIndex}`, row, start: zero, width: 0 }];
  };
  const rowStops = rows.map(stopsOf);
  const stops = rowStops.flat();
  const current = Math.min(active, Math.max(0, stops.length - 1));

  // One tab stop for the chart; the arrow keys, Home and End move from segment to segment.
  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    const targets: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: stops.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(stops.length - 1, target));
    setActive(next);
    stopRefs.current[next]?.focus();
  };

  // With one bar the tooltip is Figma's: the series' name over its dot and value.
  const single = rows.length === 1;
  const empty = !anyValue || allZero;

  return (
    <div role="group" aria-roledescription={text.chart} aria-describedby={empty ? emptyId : undefined} className={slots.root({ className })} {...named}>
      <div className={slots.body()}>
        <div aria-hidden className={slots.names()}>
          {rows.map((row, index) => (
            <div key={`${index}-${row.label}`} className={slots.name()}>
              <span className={slots.nameText()}>{row.label}</span>
            </div>
          ))}
        </div>
        <div className={slots.main()}>
          <div ref={plotRef} className={slots.plot()} onKeyDown={moveFocus}>
            {low < 0 ? <div aria-hidden className={slots.zeroLine()} style={{ left: `${zero}%` }} /> : null}
            <TooltipProvider>
              {rowStops.map((list, rowIndex) => (
                <div key={`${rowIndex}-${rows[rowIndex]?.label}`} className={slots.track()}>
                  {list.map((stop) => {
                    const index = stops.indexOf(stop);
                    const valueText = stop.value === undefined ? text.noValue : format(stop.value);
                    return (
                      <StopTarget
                        key={stop.key}
                        stop={stop}
                        label={stop.series ? `${stop.row.label}: ${stop.series.label} ${valueText}` : `${stop.row.label}: ${valueText}`}
                        tip={
                          <span className={bar.tip()}>
                            <span className={bar.tipLabel()}>{single && stop.series ? stop.series.label : stop.row.label}</span>
                            {stop.series && stop.color ? (
                              <span className={stacked.tipRow()}>
                                <span aria-hidden className={stacked.dot({ className: fillClasses[stop.color] })} />
                                {single ? null : <span className={bar.tipLabel()}>{stop.series.label}</span>}
                                <span className={bar.tipValue()}>{valueText}</span>
                              </span>
                            ) : (
                              <span className={bar.tipValue()}>{valueText}</span>
                            )}
                          </span>
                        }
                        zero={zero}
                        delay={rowIndex * STAGGER}
                        focusable={index === current}
                        onFocus={() => setActive(index)}
                        stopRef={(element) => {
                          stopRefs.current[index] = element;
                        }}
                        slots={slots}
                      >
                        {showValues && stop.color && stop.value ? (
                          <span
                            ref={(element) => {
                              if (element) valueRefs.current.set(stop.key, element);
                              else valueRefs.current.delete(stop.key);
                            }}
                            data-share={stop.width}
                            className={stacked.value({ className: cn(valueClasses[stop.color], narrow.has(stop.key) && "invisible") })}
                          >
                            {formatTick(stop.value)}
                          </span>
                        ) : null}
                      </StopTarget>
                    );
                  })}
                </div>
              ))}
            </TooltipProvider>
            {empty ? (
              <p id={emptyId} className={bar.empty({ className: slots.empty() })}>
                {emptyMessage ?? (anyValue ? text.zero : text.empty)}
              </p>
            ) : null}
          </div>
          <div aria-hidden className={slots.axis()}>
            {ticks.map((tick) => (
              <span key={tick} className={slots.tick()} style={{ left: `${x(tick)}%` }}>
                {formatTick(tick)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className={stacked.legend()}>
        {series.map((item, index) => (
          <span key={item.key} className={stacked.legendItem()}>
            <span className={stacked.dot({ className: fillClasses[colorAt(item.color, index)] })} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface StopTargetProps {
  stop: Stop;
  label: string;
  tip: ReactNode;
  /** The zero line, in percent of the track, which segments grow from. */
  zero: number;
  /** Its turn when the bars grow in, in milliseconds. */
  delay: number;
  focusable: boolean;
  onFocus: () => void;
  stopRef: (element: HTMLElement | null) => void;
  slots: ReturnType<typeof horizontalBarChartVariants>;
  children: ReactNode;
}

/** A segment, or a mark where there is nothing to draw: it opens the tooltip, which points at it. */
function StopTarget({ stop, label, tip, zero, delay, focusable, onFocus, stopRef, slots, children }: StopTargetProps) {
  const drawn = stop.color !== undefined && stop.width > 0;
  const style = drawn
    ? ({ "--bar-start": `${stop.start}%`, "--bar-width": `${stop.width}%`, "--bar-zero": `${zero}%`, "--bar-delay": `${delay}ms` } as CSSProperties)
    : { left: `${stop.start}%` };
  return (
    <Tooltip describe={false} content={tip}>
      <div
        ref={stopRef}
        role="img"
        aria-label={label}
        tabIndex={focusable ? 0 : -1}
        onFocus={onFocus}
        className={drawn && stop.color ? slots.segment({ className: fillClasses[stop.color] }) : slots.mark()}
        style={style}
      >
        {children}
      </div>
    </Tooltip>
  );
}
