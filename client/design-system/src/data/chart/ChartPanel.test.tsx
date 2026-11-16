import { render, screen } from "@testing-library/react";
import { BarChart } from "./BarChart";
import { ChartPanel } from "./ChartPanel";
import { StackedBarChart } from "./StackedBarChart";

const whole = (value: number) => value.toLocaleString("en-US");

describe("ChartPanel", () => {
  it("titles its chart with a heading, level 2 unless told otherwise", () => {
    const { rerender } = render(
      <ChartPanel title="Account">
        <p>chart</p>
      </ChartPanel>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Account" })).toBeInTheDocument();
    rerender(
      <ChartPanel title="Account" level={3}>
        <p>chart</p>
      </ChartPanel>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Account" })).toBeInTheDocument();
  });

  it("names the design system's charts inside it by its title, unless they are named already", () => {
    render(
      <>
        <ChartPanel title="Revenue Comparison">
          <BarChart rows={[{ label: "Team Alpha", value: 2 }]} format={whole} />
        </ChartPanel>
        <ChartPanel title="How we invested our time">
          <StackedBarChart aria-label="Energy by area" rows={[{ label: "Team Alpha", values: { product: 2 } }]} series={[{ key: "product", label: "Product" }]} format={whole} />
        </ChartPanel>
      </>,
    );
    expect(screen.getByRole("group", { name: "Revenue Comparison" })).toHaveAttribute("aria-roledescription", "bar chart");
    expect(screen.getByRole("group", { name: "Energy by area" })).toHaveAttribute("aria-roledescription", "stacked bar chart");
  });

  it("leaves a chart outside any panel as it was named", () => {
    render(<BarChart rows={[{ label: "Team Alpha", value: 2 }]} format={whole} />);
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-labelledby");
  });
});
