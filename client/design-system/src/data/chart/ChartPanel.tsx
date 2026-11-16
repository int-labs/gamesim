import { createContext, useContext, useId, type ReactNode } from "react";
import { Heading } from "../../foundations/text/Heading";
import { tv } from "../../lib/tv";

/** The id of the title of the ChartPanel a chart sits in, which names the chart. */
const ChartTitleContext = createContext<string | undefined>(undefined);

export interface ChartLabelling {
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

/** What names a chart: its own label, or else the title of the ChartPanel it sits in. */
export function useChartLabelling(labelling: ChartLabelling): ChartLabelling {
  const titleId = useContext(ChartTitleContext);
  if (labelling["aria-labelledby"] || labelling["aria-label"]) return labelling;
  return titleId ? { "aria-labelledby": titleId } : labelling;
}

/**
 * A chart on the player's product page (Figma 5204:98482, the charge-offs and Account cards beside
 * the decisions): the slate panel with 16 px corners and 24 px inside, its title in Poppins
 * SemiBold 18, the chart 16 under it. Stretched taller than its chart (Figma's column matches the
 * decisions' height), the panel centres the chart in the room under the title, as Figma's do.
 */
export const chartPanelVariants = tv({
  slots: {
    root: "flex min-w-0 flex-col gap-4 rounded-2xl bg-surface-panel p-6",
    body: "flex min-h-0 flex-1 flex-col justify-center",
  },
});

export interface ChartPanelProps {
  /** "Account", "Expected Charge-Offs on New Loans": it also names the chart for screen readers. */
  title: ReactNode;
  /** The title's heading level in the page. Default 2, as the decisions' panel beside it. */
  level?: 2 | 3 | 4;
  /** The chart: HorizontalBarChart, DonutChart, ComboChart, or another of the design system's. */
  children: ReactNode;
  className?: string;
}

/** The slate panel that holds one of the player's charts under its title, which names the chart. */
export function ChartPanel({ title, level = 2, children, className }: ChartPanelProps) {
  const titleId = useId();
  const slots = chartPanelVariants();
  return (
    <div className={slots.root({ className })}>
      <Heading id={titleId} level={level} variant="heading">
        {title}
      </Heading>
      <div className={slots.body()}>
        <ChartTitleContext.Provider value={titleId}>{children}</ChartTitleContext.Provider>
      </div>
    </div>
  );
}
