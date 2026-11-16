import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown } from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { InfoTip } from "../../overlays/tooltip/InfoTip";
import { Badge } from "../../primitives/badge/Badge";
import { Skeleton } from "../../primitives/skeleton/Skeleton";

/** One figure of the bar: "Overall Revenue", "$99.99 Bn", up 12% on the last round. */
export interface KpiMetric {
  /** Stable across rounds. */
  key: string;
  label: string;
  /** Written by the page ("$99.99 Bn", "78.4%"). */
  value: string;
  /** The change on the last round as a ratio (0.12 is +12%); null or missing: N/A. */
  change?: number | null;
  /** What the figure means, behind an info button. */
  info?: ReactNode;
}

/** A row of figures: the company's ("Overall") or the chosen segment's. */
export interface KpiRow {
  /** Names the row for screen readers; Figma keeps it hidden. */
  label: string;
  metrics: KpiMetric[];
}

export interface KpiBarMessages {
  /** A change there is no figure for. */
  notAvailable: string;
  /** The button that opens the figures on a phone. */
  winningMetrics: string;
  /** Names a figure's info button. */
  about: (label: string) => string;
  /** Names the bar as a region of the page. */
  region: string;
}

const defaultMessages: KpiBarMessages = {
  notAvailable: "N/A",
  winningMetrics: "Winning Metrics",
  about: (label) => `About ${label}`,
  region: "Key metrics",
};

/**
 * The player's KPI bar (Figma Navbar Variant2 2097:161669), sticky at the top of the page. On the
 * desktop: a glass bar (a slate gradient that greys the second row, a soft inner glow, a 2 px
 * white edge), one or two rows of figures spread apart with a white line between them, and the
 * energy pill and Submit at the end (one above the other with two rows). A figure: the label in
 * Poppins 16, its info button, the value in Poppins SemiBold 16, and its change in a 52 px badge.
 * Below 1280 px the actions move to the top bar (AppShell mobileActions) and the figures become
 * slate chips (Frame 41): from 1024 px in rows on a white bar, the first chip filling its row
 * (Figma's tablet); below, folded under a "Winning Metrics" button (Figma's phone), two chips to a
 * line from 640 px.
 */
export const kpiBarVariants = tv({
  slots: {
    root: [
      "sticky top-16 z-sticky border-b border-line bg-surface-card px-(--kpi-bar-padding-x) py-(--kpi-bar-fold-padding-y) lg:py-(--kpi-bar-tablet-padding-y)",
      "xl:top-0 xl:border-b-2 xl:border-surface-card xl:bg-gradient-kpi-bar xl:py-(--kpi-bar-padding-y) xl:inset-shadow-kpi-bar",
    ],
    fold: "lg:hidden",
    // Figma's _button_icon_small at full width: white, a slate 300 edge, 8 px corners, the label and
    // its chevron centred.
    trigger: [
      "group/trigger flex h-(--button-height-sm) w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-button bg-surface-card px-3",
      "type-body-lg text-fg-body shadow-xs transition duration-fast ease-standard hover:bg-surface-hover motion-reduce:transition-none",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
    ],
    chevron: "transition-transform duration-fast ease-standard group-data-panel-open/trigger:rotate-180 motion-reduce:transition-none",
    // Edge to edge, so the line under the button crosses the whole bar, as Figma's.
    panel: "-mx-(--kpi-bar-padding-x) collapse-height motion-reduce:transition-none",
    list: "mt-(--kpi-bar-fold-padding-y) flex flex-col gap-(--kpi-bar-chip-gap) border-t border-line px-(--kpi-bar-padding-x) pt-(--kpi-bar-fold-padding-y)",
    // The line under the company's figures belongs to them: 16 above it, 8 and 16 below (Figma).
    group: [
      "grid gap-(--kpi-bar-chip-gap) sm:grid-cols-2",
      "not-last:border-b not-last:border-line not-last:pb-(--kpi-bar-group-gap) not-first:pt-(--kpi-bar-group-gap)",
    ],
    wide: "hidden items-center gap-(--kpi-bar-gap) lg:flex",
    grid: "kpi-columns grid min-w-0 flex-1 items-center gap-(--kpi-bar-chip-gap)",
    row: "col-span-full grid grid-cols-subgrid items-center",
    divider: "col-span-full hidden h-px rounded-full bg-surface-card xl:block",
    actions: "hidden shrink-0 gap-(--kpi-bar-action-gap) xl:flex",
    // No box of its own (and no role): the bar or the top bar lays the two out. On a phone Submit
    // keeps 8 px at its sides, as the pill, to make Figma's 72.
    actionItems: "contents *:min-w-(--kpi-bar-action-width-phone) max-sm:*:px-2 sm:*:min-w-(--kpi-bar-action-width)",
    actionSkeleton: "h-10 rounded-xl",
    metric: [
      "flex h-(--kpi-chip-height) min-w-0 items-center justify-between gap-2 rounded-full bg-surface-panel p-1 inset-ring inset-ring-line-faint",
      "xl:h-auto xl:min-h-(--kpi-bar-row-height) xl:bg-transparent xl:p-0.5 xl:inset-ring-0",
    ],
    labelGroup: "flex min-w-0 items-center gap-1 ps-2",
    // Short of room, a label ends in an ellipsis; its value and change always show whole.
    // The label steps back in slate so the value leads (Figma draws both in gray 900).
    label: "truncate type-body text-fg-muted xl:type-kpi-label",
    // Its 24 px target reaches over the gaps, so the glyph sits Figma's 4 px after the label.
    info: "-mx-1",
    valueGroup: "flex shrink-0 items-center gap-2 xl:gap-1.5",
    value: "type-body font-semibold whitespace-nowrap text-fg-primary tabular-nums xl:type-kpi-value",
    delta: "w-(--kpi-bar-delta-width)",
    zero: "bg-(--kpi-bar-delta-zero-bg) text-fg-body",
    skeleton: "h-(--kpi-chip-height) w-full rounded-full xl:h-(--kpi-bar-row-height)",
  },
  variants: {
    /**
     * One row of figures (the enterprise pages, Figma 2101:460128): the actions side by side, and
     * the figures touching, the first filling the row with its value at its end, as Figma's; short
     * of room, its label gives way first. Two rows: the actions stacked, each figure packed, and
     * the rows spreading them apart.
     */
    single: {
      // Short of room, the first figure's label takes a second line before it ends in an ellipsis.
      true: { actions: "flex-row", grid: "xl:gap-x-0", metric: "xl:justify-between", label: "xl:line-clamp-2 xl:whitespace-normal" },
      false: {
        actions: "flex-col",
        grid: "xl:justify-between xl:gap-x-(--kpi-bar-column-gap) xl:gap-y-(--kpi-bar-row-gap)",
        // A figure keeps its width; short of room, its label wraps between words, as today's.
        metric: "xl:min-w-auto xl:justify-start",
        label: "xl:overflow-visible xl:whitespace-normal",
      },
    },
  },
});

type Slots = ReturnType<typeof kpiBarVariants>;

export interface KpiBarProps {
  /** One or two rows of figures, in the same order in each row, so their columns line up. */
  rows: KpiRow[];
  /** KpiBarActions, at the end of the desktop bar. Give the same to AppShell's mobileActions, for smaller screens. */
  actions?: ReactNode;
  /** Figures still loading: pale pills in their place. */
  loading?: boolean;
  messages?: Partial<KpiBarMessages>;
  className?: string;
}

/** The round's figures at the top of the player's page, with the energy left and Submit. */
export function KpiBar({ rows, actions, loading = false, messages, className }: KpiBarProps) {
  const text = { ...defaultMessages, ...messages };
  const single = rows.length <= 1;
  const slots = kpiBarVariants({ single });
  const columns = Math.max(1, ...rows.map((row) => row.metrics.length));
  // The rows share their columns, so a figure sits over the one below it (the kpi-columns utility).
  // The first fills its row and the others keep their width: the chips, and Figma's single row.
  const fill = columns > 1 ? `minmax(0, 1fr) repeat(${columns - 1}, auto)` : "minmax(0, 1fr)";
  // Each keeps its width, the row spreading them apart: Figma's two rows.
  const spread = `repeat(${columns}, auto)`;
  // Pale pills have no width of their own: they share the row.
  const even = `repeat(${columns}, minmax(0, 1fr))`;
  const columnTracks = {
    "--kpi-columns": loading ? even : fill,
    "--kpi-columns-xl": loading ? even : single ? fill : spread,
  } as CSSProperties;
  return (
    <section aria-label={text.region} aria-busy={loading || undefined} className={slots.root({ className })}>
      <Collapsible.Root className={slots.fold()}>
        <Collapsible.Trigger className={slots.trigger()}>
          {text.winningMetrics}
          <Icon icon={ChevronDown} size="sm" className={slots.chevron()} />
        </Collapsible.Trigger>
        <Collapsible.Panel className={slots.panel()}>
          <div className={slots.list()}>
            {rows.map((row) => (
              <div key={row.label} role="group" aria-label={row.label} className={slots.group()}>
                {row.metrics.map((metric) => (
                  <Figure key={metric.key} metric={metric} loading={loading} text={text} slots={slots} />
                ))}
              </div>
            ))}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
      <div className={slots.wide()}>
        <div className={slots.grid()} style={columnTracks}>
          {rows.map((row, index) => (
            <Fragment key={row.label}>
              {index > 0 ? <div aria-hidden className={slots.divider()} /> : null}
              <div role="group" aria-label={row.label} className={slots.row()}>
                {row.metrics.map((metric) => (
                  <Figure key={metric.key} metric={metric} loading={loading} text={text} slots={slots} />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
        {actions ? <div className={slots.actions()}>{actions}</div> : null}
      </div>
    </section>
  );
}

export interface KpiBarActionsProps {
  /** The EnergyPill, then Submit. */
  children: ReactNode;
  /** The round is still loading: two pale pills in their place, as today's bar. */
  loading?: boolean;
}

/**
 * The energy pill and Submit, the same size, as Figma: 72 px on phones, 102 px from 640 px, wider
 * only for a longer label. Give one element to both KpiBar's actions and AppShell's mobileActions:
 * the desktop bar stacks them (side by side with one row of figures), the top bar lines them up.
 */
export function KpiBarActions({ children, loading = false }: KpiBarActionsProps) {
  const slots = kpiBarVariants();
  return (
    <div className={slots.actionItems()}>
      {loading ? (
        <>
          <Skeleton className={slots.actionSkeleton()} />
          <Skeleton className={slots.actionSkeleton()} />
        </>
      ) : (
        children
      )}
    </div>
  );
}

interface FigureProps {
  metric: KpiMetric;
  loading: boolean;
  text: KpiBarMessages;
  slots: Slots;
}

/** A figure: its label and info button, its value and change (a pale pill while loading). */
function Figure({ metric, loading, text, slots }: FigureProps) {
  const format = useNumberFormat();
  if (loading) return <Skeleton className={slots.skeleton()} />;
  const { change } = metric;
  const known = change !== null && change !== undefined && Number.isFinite(change);
  const tone = !known || change === 0 ? undefined : change > 0 ? "success" : "danger";
  return (
    <div className={slots.metric()}>
      <span className={slots.labelGroup()}>
        <span className={slots.label()}>{metric.label}</span>
        {metric.info ? (
          <InfoTip label={text.about(metric.label)} className={slots.info()}>
            {metric.info}
          </InfoTip>
        ) : null}
      </span>
      <span className={slots.valueGroup()}>
        <span className={slots.value()}>{metric.value}</span>
        <Badge size="md" tone={tone} className={slots.delta({ className: tone ? undefined : slots.zero() })}>
          {known ? format.percent(change, { signed: true }) : text.notAvailable}
        </Badge>
      </span>
    </div>
  );
}
