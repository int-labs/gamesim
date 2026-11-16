import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChartSeries } from "./series";
import { StackedBarChart, type StackedChartRow } from "./StackedBarChart";

const whole = (value: number) => value.toLocaleString("en-US");

const series: ChartSeries[] = [
  { key: "product", label: "Product", color: 3 },
  { key: "tAndO", label: "T&O", color: 6 },
  { key: "initiatives", label: "Initiatives", color: 1 },
];

const rows: StackedChartRow[] = [
  { label: "Alpha (1)", values: { product: 26, tAndO: 54, initiatives: 20 } },
  { label: "Beta (2)", values: { product: 14, tAndO: 63, initiatives: 23 } },
  { label: "Gamma (3)", values: { product: null, tAndO: null, initiatives: null } },
];

/** A segment's drawn geometry, from the variables it is given. */
function geometry(segment: Element) {
  const style = (segment as HTMLElement).style;
  return { top: Number.parseFloat(style.getPropertyValue("--bar-top")), height: Number.parseFloat(style.getPropertyValue("--bar-height")) };
}

function segmentsOf(column: HTMLElement) {
  return [...column.querySelectorAll(".chart-bar")];
}

function axisOf(container: HTMLElement) {
  return [...container.querySelectorAll(".absolute.-translate-y-1\\/2")].map((label) => label.textContent);
}

describe("StackedBarChart", () => {
  it("is a chart named by its label, a column per team with each series and the total", () => {
    render(<StackedBarChart aria-label="How we invested our time" rows={rows} series={series} format={whole} />);
    const chart = screen.getByRole("group", { name: "How we invested our time" });
    expect(chart).toHaveAttribute("aria-roledescription", "stacked bar chart");
    expect(within(chart).getAllByRole("img").map((column) => column.getAttribute("aria-label"))).toEqual([
      "Alpha (1): Product 26, T&O 54, Initiatives 20, Total 100",
      "Beta (2): Product 14, T&O 63, Initiatives 23, Total 100",
      "Gamma (3): No value",
    ]);
  });

  it("stacks the series from the zero line in order, each segment meeting the next", () => {
    const { container } = render(<StackedBarChart aria-label="Energy" rows={rows} series={series} format={whole} />);
    expect(axisOf(container)).toEqual(["0", "20", "40", "60", "80", "100"]);
    const [product, tAndO, initiatives] = segmentsOf(screen.getByRole("img", { name: /^Alpha/ })).map(geometry);
    // Zero at the bottom of the 270 px plot, 100 at the top line 12 px down.
    expect(product).toEqual({ top: 270 - Math.round(258 * 0.26), height: Math.round(258 * 0.26) });
    expect(tAndO!.top + tAndO!.height).toBe(product!.top);
    expect(initiatives!.top + initiatives!.height).toBe(tAndO!.top);
    expect(initiatives!.top).toBe(12);
    expect(segmentsOf(screen.getByRole("img", { name: /^Gamma/ }))).toHaveLength(0);
  });

  it("draws a loss below the zero line and a gain above it in the same bar", () => {
    render(
      <StackedBarChart
        aria-label="Profit"
        rows={[{ label: "Alpha (1)", values: { product: 60, tAndO: -40, initiatives: 20 } }]}
        series={series}
        format={whole}
      />,
    );
    const [gain, loss, more] = segmentsOf(screen.getByRole("img", { name: /^Alpha/ })).map(geometry);
    expect(loss!.top).toBe(gain!.top + gain!.height);
    expect(more!.top + more!.height).toBe(gain!.top);
  });

  it("writes each value inside its segment in the short format, and none in a segment too short for it", () => {
    render(
      <StackedBarChart
        aria-label="Deposits"
        rows={[{ label: "Alpha (1)", values: { product: 76e9, tAndO: 0.5e9, initiatives: 20e9 } }]}
        series={series}
        format={(value) => `${(value / 1e9).toFixed(2)} billion`}
        formatTick={(value) => `${Math.round(value / 1e9)}B`}
      />,
    );
    const column = screen.getByRole("img", { name: "Alpha (1): Product 76.00 billion, T&O 0.50 billion, Initiatives 20.00 billion, Total 96.50 billion" });
    expect(within(column).getByText("76B")).toBeInTheDocument();
    expect(within(column).getByText("20B")).toBeInTheDocument();
    expect(within(column).queryByText("1B")).not.toBeInTheDocument();
  });

  it("keeps the teams and the zero line when every value is 0, and says so", () => {
    const { container } = render(
      <StackedBarChart
        aria-label="Energy"
        rows={rows.map((row) => ({ ...row, values: { product: 0, tAndO: 0, initiatives: 0 } }))}
        series={series}
        format={whole}
      />,
    );
    expect(axisOf(container)).toEqual(["0"]);
    expect(screen.getByRole("group", { name: "Energy" })).toHaveAccessibleDescription("All values are 0");
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("says so over the plot when no team has a value yet", () => {
    const { container } = render(
      <StackedBarChart aria-label="Energy" rows={[rows[2]!]} series={series} format={whole} emptyMessage="Round has not started" />,
    );
    expect(axisOf(container)).toEqual([]);
    expect(screen.getByText("Round has not started")).toBeInTheDocument();
  });

  it("names the value axis and describes the chart with it", () => {
    render(<StackedBarChart aria-label="Deposits" rows={rows} series={series} format={whole} axisLabel="Growth in Deposits" />);
    expect(screen.getByRole("group", { name: "Deposits" })).toHaveAccessibleDescription("Growth in Deposits");
  });

  it("writes a caption under each team, names it in the legend, and reads it with the team", () => {
    const { container } = render(
      <StackedBarChart
        aria-label="Retail Mass deposits"
        rows={[
          { label: "Alpha (1)", values: { product: 19 }, caption: "1.50%" },
          { label: "Beta (2)", values: { product: 21 }, caption: "1.75%" },
        ]}
        series={[{ key: "product", label: "Retail Mass", color: 3 }]}
        format={whole}
        captionLabel="Interest rate"
      />,
    );
    expect(screen.getByRole("img", { name: "Alpha (1): Retail Mass 19, Interest rate 1.50%" })).toBeInTheDocument();
    expect(screen.getByText("1.75%")).toBeInTheDocument();
    expect(container.lastElementChild?.lastElementChild?.textContent).toBe("Retail MassInterest rate");
  });

  it("leaves the values to the tooltip when asked", () => {
    render(<StackedBarChart aria-label="Energy" rows={rows} series={series} format={whole} showValues={false} />);
    expect(within(screen.getByRole("img", { name: /^Alpha/ })).queryByText("54")).not.toBeInTheDocument();
  });

  it("lists the series in the legend, in order", () => {
    const { container } = render(<StackedBarChart aria-label="Energy" rows={rows} series={series} format={whole} />);
    const legend = container.lastElementChild?.lastElementChild;
    expect(legend?.textContent).toBe("ProductT&OInitiatives");
  });

  it("is one tab stop, the arrow keys moving between teams", async () => {
    const user = userEvent.setup();
    render(<StackedBarChart aria-label="Energy" rows={rows} series={series} format={whole} />);
    await user.tab();
    expect(screen.getByRole("img", { name: /^Alpha/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: /^Beta/ })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("img", { name: /^Gamma/ })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
