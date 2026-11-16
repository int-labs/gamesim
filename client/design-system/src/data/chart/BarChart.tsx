import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { tv } from "../../lib/tv";
import { Tooltip, TooltipProvider } from "../../overlays/tooltip/Tooltip";
import { tokens } from "../../tokens";
import { AxisLabel } from "./AxisLabel";
import { useChartLabelling } from "./ChartPanel";
import { niceTicks } from "./ticks";

const CHART = tokens.component.chart;
const px = (value: string) => Number.parseFloat(value);
const PLOT_HEIGHT = px(CHART["plot-height"]);
/** The top grid line's distance from the top of the plot, so its label fits. */
const PLOT_INSET = px(CHART["plot-inset"]);
/** Bars grow in one after another, this far apart. */
const STAGGER = px(tokens.stagger.list);

/** One team's value, or null while it has none (no decisions in the round yet). */
export interface ChartRow {
  label: string;
  value: number | null;
}

export interface BarChartMessages {
  /** A row without a value, in its tooltip and for screen readers. */
  noValue: string;
  /** Over the plot when no row has a value. */
  empty: string;
  /** What screen readers call the chart. */
  chart: string;
}

const defaultMessages: BarChartMessages = { noValue: "No value", empty: "No values yet", chart: "bar chart" };

/**
 * The bar chart of the Figma Admin chart cards (Revenue Comparison, 3310:177820): values up the
 * side (Source Sans 12, gray 800) on gray 200 grid lines over a 270 px plot, one square blue 500
 * bar per team, the teams along the bottom. A bar is three tenths of its team's column, as Figma's
 * 25 px in 85.
 */
export const barChartVariants = tv({
  slots: {
    root: "flex gap-(--chart-axis-gap) px-2",
    yAxis: "relative shrink-0",
    // The widest label sizes the axis; the labels themselves sit on their grid lines.
    ySizer: "invisible h-0 type-caption whitespace-nowrap",
    yLabel: "absolute inset-e-0 -translate-y-1/2 type-caption whitespace-nowrap text-chart-label",
    main: "flex min-w-0 flex-1 flex-col gap-(--chart-axis-gap)",
    plot: "relative h-(--chart-plot-height)",
    grid: "absolute inset-x-0 h-px bg-chart-grid",
    columns: "absolute inset-0 flex",
    column: "group/column relative min-w-0 flex-1 rounded-md outline-offset-0 focus-visible:outline-2 focus-visible:outline-focus-ring",
    bar: [
      "chart-bar absolute left-1/2 w-3/10 max-w-(--chart-bar-max-width) -translate-x-1/2 bg-chart-4",
      "group-hover/column:brightness-90 group-focus-visible/column:brightness-90 motion-reduce:transition-none",
    ],
    // Figma's gray 800 at 40% reads 2.5:1; gray 500 reads 4.8:1 on the white card.
    empty: "absolute inset-0 flex items-center justify-center px-4 text-center type-body-lg text-fg-subtle",
    xAxis: "flex",
    xCell: "flex min-h-6 min-w-0 flex-1 items-center justify-center px-0.5",
    // Two lines at most, broken between words only; a word too long for its column, and a name
    // with words left over, end in "…" (AxisLabel measures them).
    xLabel: "block max-w-full text-center type-caption text-chart-label",
    xLine: "block truncate",
    xUnmeasured: "line-clamp-2",
    tip: "flex flex-col items-start gap-(--tooltip-gap) text-start type-caption",
    tipLabel: "font-normal text-fg-on-inverse-muted",
    tipValue: "font-semibold",
  },
});

function hasValue(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export interface BarChartProps {
  /** One bar per row, in order: up to about ten teams. Long labels wrap to two lines between words and are cut with "…"; the tooltip gives them whole. */
  rows: ChartRow[];
  /** Writes a value for the tooltip and screen readers, and for the axis unless `formatTick` is given. */
  format: (value: number) => string;
  /** Writes the axis values, when they should read shorter than `format` ("$2.3B"). */
  formatTick?: (value: number) => string;
  /** Over the plot when no row has a value: "Round has not started". Default `messages.empty`. */
  emptyMessage?: ReactNode;
  messages?: Partial<BarChartMessages>;
  /** Names the chart: the id of its title (ChartCard passes it). */
  "aria-labelledby"?: string;
  /** Names the chart when no title does. */
  "aria-label"?: string;
  className?: string;
}

/**
 * One value per team as bars from a zero line (below it for a loss), on round axis values. Hovering
 * a team's column, or moving to it with the arrow keys, shows its name and value in the chart
 * tooltip; a team without a value has no bar and says so. Bars grow in when they first appear
 * and move when the values change.
 */
export function BarChart({ rows, format, formatTick = format, emptyMessage, messages, className, ...labelling }: BarChartProps) {
  const text = { ...defaultMessages, ...messages };
  const named = useChartLabelling(labelling);
  const emptyId = useId();
  const slots = barChartVariants();
  const [active, setActive] = useState(0);
  const columnRefs = useRef<(HTMLElement | null)[]>([]);

  const values = rows.map((row) => row.value).filter(hasValue);
  const empty = values.length === 0;
  const ticks = empty ? [] : niceTicks(Math.min(...values), Math.max(...values));
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 0;
  /** Where a value sits, in pixels from the top of the plot. */
  const y = (value: number) => PLOT_INSET + (1 - (value - low) / (high - low || 1)) * (PLOT_HEIGHT - PLOT_INSET);
  // Lines and bar edges on whole pixels, so they stay crisp; the bottom line inside the plot.
  const lineTop = (value: number) => Math.min(PLOT_HEIGHT - 1, Math.round(y(value) - 0.5));
  const edge = (value: number) => Math.round(y(value));
  const zero = edge(0);
  /** A bar from the zero line: up for a gain, down for a loss, a sliver at least for a value too small to see. */
  const barOf = (value: number | null) => {
    if (!hasValue(value) || value === 0) return { top: zero, height: 0 };
    const height = Math.max(1, Math.abs(edge(value) - zero));
    return { top: value > 0 ? zero - height : zero, height };
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

  return (
    <div
      role="group"
      aria-roledescription={text.chart}
      aria-describedby={empty ? emptyId : undefined}
      className={slots.root({ className })}
      {...named}
    >
      <div aria-hidden className={slots.yAxis()}>
        <div className={slots.ySizer()}>
          {ticks.map((tick) => (
            <div key={tick}>{formatTick(tick)}</div>
          ))}
        </div>
        {ticks.map((tick) => (
          <span key={tick} className={slots.yLabel()} style={{ top: y(tick) }}>
            {formatTick(tick)}
          </span>
        ))}
      </div>
      <div className={slots.main()}>
        <div className={slots.plot()}>
          {ticks.map((tick) => (
            <div key={tick} aria-hidden className={slots.grid()} style={{ top: lineTop(tick) }} />
          ))}
          <TooltipProvider>
            <div className={slots.columns()} onKeyDown={moveFocus}>
              {rows.map((row, index) => (
                <Column
                  key={`${index}-${row.label}`}
                  row={row}
                  valueText={hasValue(row.value) ? format(row.value) : text.noValue}
                  {...barOf(row.value)}
                  zero={zero}
                  delay={index * STAGGER}
                  focusable={index === current}
                  onFocus={() => setActive(index)}
                  columnRef={(element) => {
                    columnRefs.current[index] = element;
                  }}
                  slots={slots}
                />
              ))}
            </div>
          </TooltipProvider>
          {empty ? (
            <p id={emptyId} className={slots.empty()}>
              {emptyMessage ?? text.empty}
            </p>
          ) : null}
        </div>
        <div aria-hidden className={slots.xAxis()}>
          {rows.map((row, index) => (
            <div key={`${index}-${row.label}`} className={slots.xCell()}>
              <AxisLabel label={row.label} className={slots.xLabel()} lineClassName={slots.xLine()} unmeasuredClassName={slots.xUnmeasured()} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ColumnProps {
  row: ChartRow;
  valueText: string;
  /** The bar's top and height, and the zero line it grows from, in pixels from the plot's top. */
  top: number;
  height: number;
  zero: number;
  /** Its turn when the bars grow in, in milliseconds. */
  delay: number;
  focusable: boolean;
  onFocus: () => void;
  columnRef: (element: HTMLElement | null) => void;
  slots: ReturnType<typeof barChartVariants>;
}

/** A team's column: all of it opens the tooltip, which points at the bar (at the zero line when there is none). */
function Column({ row, valueText, top, height, zero, delay, focusable, onFocus, columnRef, slots }: ColumnProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const bar = {
    "--bar-top": `${top}px`,
    "--bar-height": `${height}px`,
    "--bar-zero": `${zero}px`,
    "--bar-delay": `${delay}ms`,
  } as CSSProperties;
  return (
    <Tooltip
      describe={false}
      anchor={barRef}
      content={
        <span className={slots.tip()}>
          <span className={slots.tipLabel()}>{row.label}</span>
          <span className={slots.tipValue()}>{valueText}</span>
        </span>
      }
    >
      <div
        ref={columnRef}
        role="img"
        aria-label={`${row.label}: ${valueText}`}
        tabIndex={focusable ? 0 : -1}
        onFocus={onFocus}
        className={slots.column()}
      >
        <div ref={barRef} className={slots.bar()} style={bar} />
      </div>
    </Tooltip>
  );
}
