import { createRef, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn";
import { tv } from "../../lib/tv";
import { Tooltip, TooltipProvider, type TooltipSide } from "../../overlays/tooltip/Tooltip";
import { tokens } from "../../tokens";
import { barChartVariants } from "./BarChart";
import { useChartLabelling, type ChartLabelling } from "./ChartPanel";
import { colorAt, fillClasses, isValue, strokeClasses, type ChartColor } from "./series";
import { stackedBarChartVariants } from "./StackedBarChart";

const CHART = tokens.component.chart;
const px = (value: string) => Number.parseFloat(value);
/** The donut's width and height, and its centre. */
const SIZE = px(CHART["donut-size"]);
const CENTER = SIZE / 2;
/** The ring is a quarter of the radius, as Figma's (17.6 of 70.5). */
const OUTER = SIZE / 2;
const INNER = OUTER * 0.75;
const THICKNESS = OUTER - INNER;
/** Segments are strokes along the middle of the ring. */
const MIDDLE = (OUTER + INNER) / 2;
const RING = 2 * Math.PI * MIDDLE;
/** Between two segments, along the middle of the ring. */
const GAP = px(CHART["donut-gap"]);
/** A segment too small to see keeps a sliver this long. */
const MIN_ARC = 1;
/** The focus ring's width round a segment. */
const HALO = 2;
/** Segments grow in one after another, this far apart. */
const STAGGER = px(tokens.stagger.list);

export interface DonutSegment {
  /** Its name in the legend, the tooltip and for screen readers: "Deposit". */
  label: string;
  /** Its value, zero or more; null while it has none. */
  value: number | null;
  /** Its colour from the chart palette. Default: its place among the segments. */
  color?: ChartColor;
}

export interface DonutChartMessages {
  /** A segment without a value, in its tooltip and for screen readers. */
  noValue: string;
  /** In the middle when no segment has a value above 0. */
  empty: string;
  /** What screen readers call the chart. */
  chart: string;
}

const defaultMessages: DonutChartMessages = { noValue: "No value", empty: "No values yet", chart: "donut chart" };

/**
 * The Revenue Breakdown donut of Figma's product pages (2193:396973): a 141 px ring, a quarter of
 * its radius thick, a segment per part, about 5 degrees apart; the total in its middle in Poppins
 * SemiBold 24 over its caption in Source Sans 12/16; the legend 64 to its right, an 8 px dot and
 * the part's name in SemiBold 16/24, 8 apart. The legend stays beside the donut while the chart
 * is 320 px wide or more (Figma's panel gives it 388), a long name wrapping there rather than
 * taking the legend under the donut; narrower, it goes under the donut.
 */
export const donutChartVariants = tv({
  slots: {
    root: "@container",
    body: "flex flex-col items-center gap-4 @xs:flex-row @xs:justify-center @xs:gap-(--chart-donut-legend-gap)",
    figure: "relative size-(--chart-donut-size) shrink-0",
    svg: "absolute inset-0 size-full overflow-visible",
    track: "fill-none stroke-chart-grid",
    target: "group/segment outline-none",
    arc: "chart-arc pointer-events-none fill-none group-hover/segment:brightness-90 group-focus-visible/segment:brightness-90 motion-reduce:transition-none",
    halo: "pointer-events-none fill-focus-ring opacity-0 group-focus-visible/segment:opacity-100",
    hit: "fill-transparent",
    anchor: "pointer-events-none absolute size-0",
    middle: "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center",
    total: "type-stat whitespace-nowrap text-fg-body tabular-nums",
    caption: "type-caption text-fg-muted",
    empty: "type-caption text-fg-muted",
    legend: "flex min-w-0 flex-col gap-(--chart-donut-legend-row-gap)",
    legendItem: "flex items-start gap-(--chart-legend-item-gap) type-body-lg font-semibold wrap-break-word text-chart-label",
    // On the name's first line, which is 24 high.
    legendDot: "mt-2",
  },
});

export interface DonutChartProps extends ChartLabelling {
  /** The parts of the whole, clockwise from the top in this order and listed in the legend. */
  segments: DonutSegment[];
  /** Writes a value for the tooltip and screen readers. */
  format: (value: number) => string;
  /** Writes the total in the middle, when it should read shorter than `format` ("108M"). Default `format`. */
  formatTotal?: (value: number) => string;
  /** Under the total: "revenue". */
  totalLabel?: ReactNode;
  /** In the middle when no segment has a value above 0: "Round has not started". Default `messages.empty`. */
  emptyMessage?: ReactNode;
  messages?: Partial<DonutChartMessages>;
  className?: string;
}

/** A point on a circle round the centre, `angle` in radians clockwise from the top. */
function pointAt(radius: number, angle: number) {
  return { x: CENTER + radius * Math.sin(angle), y: CENTER - radius * Math.cos(angle) };
}

const round = (value: number) => Number(value.toFixed(3));

/** A piece of a ring from one angle to another (radians clockwise from the top), or the whole ring. */
function sectorPath(outer: number, inner: number, from: number, to: number) {
  if (to - from >= 2 * Math.PI - 1e-6) {
    const circle = (radius: number, sweep: 0 | 1) =>
      `M${CENTER} ${round(CENTER - radius)}A${round(radius)} ${round(radius)} 0 1 ${sweep} ${CENTER} ${round(CENTER + radius)}A${round(radius)} ${round(radius)} 0 1 ${sweep} ${CENTER} ${round(CENTER - radius)}Z`;
    return circle(outer, 1) + circle(inner, 0);
  }
  const large = to - from > Math.PI ? 1 : 0;
  const a = pointAt(outer, from);
  const b = pointAt(outer, to);
  const c = pointAt(inner, to);
  const d = pointAt(inner, from);
  return `M${round(a.x)} ${round(a.y)}A${round(outer)} ${round(outer)} 0 ${large} 1 ${round(b.x)} ${round(b.y)}L${round(c.x)} ${round(c.y)}A${round(inner)} ${round(inner)} 0 ${large} 0 ${round(d.x)} ${round(d.y)}Z`;
}

/** A segment as drawn: where its stroke starts along the middle of the ring and how long it is. */
interface Arc {
  segment: DonutSegment;
  color: ChartColor;
  /** Clockwise from the top, along the middle of the ring; 0 long when there is nothing to draw. */
  start: number;
  length: number;
  /** Where the tooltip points: the segment's middle, or where it would be. */
  point: { x: number; y: number };
}

/**
 * Parts of a whole as a ring, the total in its middle. Hovering a segment, or moving to it with
 * the arrow keys, shows its name and value in the chart tooltip; screen readers hear every part,
 * one at 0 or without a value too, which has no segment to see. Segments grow in when they first
 * appear and move when the values change. A value below 0 has no segment.
 */
export function DonutChart({ segments, format, formatTotal = format, totalLabel, emptyMessage, messages, className, ...labelling }: DonutChartProps) {
  const text = { ...defaultMessages, ...messages };
  const named = useChartLabelling(labelling);
  const emptyId = useId();
  const bar = barChartVariants();
  const stacked = stackedBarChartVariants();
  const slots = donutChartVariants();
  const [active, setActive] = useState(0);
  const targetRefs = useRef<(SVGGElement | null)[]>([]);
  const anchorRefs = useMemo(() => Array.from({ length: segments.length }, () => createRef<HTMLSpanElement>()), [segments.length]);

  const drawn = segments.filter((segment) => isValue(segment.value) && segment.value > 0).length;
  const whole = segments.reduce((sum, segment) => (isValue(segment.value) && segment.value > 0 ? sum + segment.value : sum), 0);
  const total = segments.reduce((sum, segment) => (isValue(segment.value) ? sum + segment.value : sum), 0);
  const empty = drawn === 0;

  // Clockwise from the top: each part its share of the ring less the gap, half the gap before it and half after.
  const shares = segments.map((segment) => (isValue(segment.value) && segment.value > 0 ? (segment.value / whole) * RING : 0));
  const arcs: Arc[] = segments.map((segment, index) => {
    const color = colorAt(segment.color, index);
    const share = shares[index] ?? 0;
    const from = shares.slice(0, index).reduce((sum, before) => sum + before, 0);
    if (share === 0) return { segment, color, start: from, length: 0, point: pointAt(MIDDLE, from / MIDDLE) };
    // The only part is the whole ring, without a gap; its tooltip points at the top.
    if (drawn === 1) return { segment, color, start: 0, length: RING, point: pointAt(MIDDLE, 0) };
    const length = Math.max(MIN_ARC, share - GAP);
    const start = from + (share - length) / 2;
    return { segment, color, start, length, point: pointAt(MIDDLE, (start + length / 2) / MIDDLE) };
  });
  const current = Math.min(active, Math.max(0, segments.length - 1));

  // One tab stop for the chart; the arrow keys, Home and End move from segment to segment.
  const moveFocus = (event: KeyboardEvent<SVGSVGElement>) => {
    const targets: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowDown: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current - 1,
      Home: 0,
      End: segments.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(segments.length - 1, target));
    setActive(next);
    targetRefs.current[next]?.focus();
  };

  return (
    <div role="group" aria-roledescription={text.chart} aria-describedby={empty ? emptyId : undefined} className={slots.root({ className })} {...named}>
      <div className={slots.body()}>
        <div className={slots.figure()}>
          <TooltipProvider>
            <svg role="none" viewBox={`0 0 ${SIZE} ${SIZE}`} className={slots.svg()} onKeyDown={moveFocus}>
              {empty ? <circle cx={CENTER} cy={CENTER} r={MIDDLE} strokeWidth={THICKNESS} className={slots.track()} /> : null}
              {arcs.map((arc, index) => (
                <Segment
                  key={`${index}-${arc.segment.label}`}
                  arc={arc}
                  valueText={isValue(arc.segment.value) ? format(arc.segment.value) : text.noValue}
                  delay={index * STAGGER}
                  focusable={index === current}
                  onFocus={() => setActive(index)}
                  targetRef={(element) => {
                    targetRefs.current[index] = element;
                  }}
                  anchorRef={anchorRefs[index]}
                  slots={slots}
                  bar={bar}
                  stacked={stacked}
                />
              ))}
            </svg>
          </TooltipProvider>
          {/* Where each segment's tooltip points, in the figure's pixels, which are the ring's. */}
          {arcs.map((arc, index) => (
            <span key={`${index}-${arc.segment.label}`} ref={anchorRefs[index]} aria-hidden className={slots.anchor()} style={{ left: arc.point.x, top: arc.point.y }} />
          ))}
          <div className={slots.middle()}>
            {empty ? (
              <p id={emptyId} className={slots.empty()}>
                {emptyMessage ?? text.empty}
              </p>
            ) : (
              <>
                <span className={slots.total()}>{formatTotal(total)}</span>
                {totalLabel ? <span className={slots.caption()}>{totalLabel}</span> : null}
              </>
            )}
          </div>
        </div>
        <ul aria-hidden className={slots.legend()}>
          {arcs.map((arc, index) => (
            <li key={`${index}-${arc.segment.label}`} className={slots.legendItem()}>
              <span className={stacked.dot({ className: cn(slots.legendDot(), fillClasses[arc.color]) })} />
              {arc.segment.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface SegmentProps {
  arc: Arc;
  valueText: string;
  /** Its turn when the segments grow in, in milliseconds. */
  delay: number;
  focusable: boolean;
  onFocus: () => void;
  targetRef: (element: SVGGElement | null) => void;
  anchorRef: RefObject<HTMLSpanElement | null> | undefined;
  slots: ReturnType<typeof donutChartVariants>;
  bar: ReturnType<typeof barChartVariants>;
  stacked: ReturnType<typeof stackedBarChartVariants>;
}

/**
 * A segment: its stroke, which grows in; over it the exact shape it will have, which the pointer
 * finds; under it the focus ring. The tooltip points at its middle: above it in the top half of
 * the ring, below it in the bottom half.
 */
function Segment({ arc, valueText, delay, focusable, onFocus, targetRef, anchorRef, slots, bar, stacked }: SegmentProps) {
  const from = arc.start / MIDDLE;
  const to = (arc.start + arc.length) / MIDDLE;
  const halo = HALO / MIDDLE;
  const side: TooltipSide = arc.point.y <= CENTER ? "top" : "bottom";
  const style = {
    "--arc-length": `${arc.length}`,
    "--arc-rest": `${RING - arc.length}`,
    "--arc-offset": `${-arc.start}`,
    "--arc-ring": `${RING}`,
    "--arc-delay": `${delay}ms`,
  } as CSSProperties;
  return (
    <Tooltip
      describe={false}
      side={side}
      anchor={anchorRef}
      content={
        <span className={bar.tip()}>
          <span className={bar.tipLabel()}>{arc.segment.label}</span>
          <span className={stacked.tipRow()}>
            <span aria-hidden className={stacked.dot({ className: fillClasses[arc.color] })} />
            <span className={bar.tipValue()}>{valueText}</span>
          </span>
        </span>
      }
    >
      <g ref={targetRef} role="img" aria-label={`${arc.segment.label}: ${valueText}`} tabIndex={focusable ? 0 : -1} onFocus={onFocus} className={slots.target()}>
        {arc.length > 0 ? (
          <>
            <path d={sectorPath(OUTER + HALO, INNER - HALO, from - halo, to + halo)} className={slots.halo()} />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={MIDDLE}
              strokeWidth={THICKNESS}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              className={slots.arc({ className: strokeClasses[arc.color] })}
              style={style}
            />
            <path d={sectorPath(OUTER, INNER, from, to)} className={slots.hit()} />
          </>
        ) : null}
      </g>
    </Tooltip>
  );
}
