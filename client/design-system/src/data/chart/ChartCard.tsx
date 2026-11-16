import { useId, type ReactNode } from "react";
import { Card, CardHeader } from "../../primitives/card/Card";
import { BarChart, type BarChartProps } from "./BarChart";

export interface ChartCardProps extends Omit<BarChartProps, "aria-labelledby" | "aria-label"> {
  /** "Revenue Comparison": it also names the chart for screen readers. */
  title: ReactNode;
  /** The title's heading level in the page. Default 3. */
  level?: 2 | 3 | 4;
  /** Beside the title: a menu, a button. */
  actions?: ReactNode;
}

/**
 * A chart card of the Figma Admin simulation page (Revenue Comparison): a white card with a
 * slate 200 edge, 16 px corners and padding, the title in Poppins Medium 16, and 24 px under it
 * the bar chart of one value per team.
 */
export function ChartCard({ title, level = 3, actions, className, ...chart }: ChartCardProps) {
  const titleId = useId();
  return (
    <Card variant="nested" className={className}>
      <CardHeader title={title} level={level} actions={actions} titleId={titleId} />
      <BarChart aria-labelledby={titleId} {...chart} />
    </Card>
  );
}
