import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartPanel } from "./ChartPanel";
import { HorizontalBarChart, type HorizontalChartRow } from "./HorizontalBarChart";
import type { ChartSeries } from "./series";

const whole = (value: number) => value.toLocaleString("en-US");
const millions = (value: number) => `${value / 1e6}M`;

const series: ChartSeries[] = [
  { key: "current", label: "Current accounts" },
  { key: "new", label: "New accounts" },
];

const accounts: HorizontalChartRow[] = [{ label: "Number of Accounts", values: { current: 15_000_000, new: 5_000_000 } }];

/** A segment's drawn geometry, from the variables it is given, in percent of its track. */
function geometry(segment: Element) {
  const style = (segment as HTMLElement).style;
  return { start: Number.parseFloat(style.getPropertyValue("--bar-start")), width: Number.parseFloat(style.getPropertyValue("--bar-width")) };
}

function axisOf(container: HTMLElement) {
  return [...container.querySelectorAll(".top-0.-translate-x-1\\/2")].map((label) => label.textContent);
}

describe("HorizontalBarChart", () => {
  it("is a chart named by its label, each series of each bar a part to hear", () => {
    render(<HorizontalBarChart aria-label="Account" rows={accounts} series={series} format={whole} />);
    const chart = screen.getByRole("group", { name: "Account" });
    expect(chart).toHaveAttribute("aria-roledescription", "horizontal bar chart");
    expect(within(chart).getAllByRole("img").map((part) => part.getAttribute("aria-label"))).toEqual([
      "Number of Accounts: Current accounts 15,000,000",
      "Number of Accounts: New accounts 5,000,000",
    ]);
  });

  it("is named by the title of the ChartPanel it sits in", () => {
    render(
      <ChartPanel title="Account">
        <HorizontalBarChart rows={accounts} series={series} format={whole} />
      </ChartPanel>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Account" })).toBeInTheDocument();
  });

  it("splits the bar from the zero line in the series' order, on round axis values", () => {
    const { container } = render(<HorizontalBarChart aria-label="Account" rows={accounts} series={series} format={whole} formatTick={millions} />);
    expect(axisOf(container)).toEqual(["0M", "5M", "10M", "15M", "20M"]);
    const current = geometry(screen.getByRole("img", { name: /Current accounts/ }));
    const added = geometry(screen.getByRole("img", { name: /New accounts/ }));
    expect(current).toEqual({ start: 0, width: 75 });
    expect(added).toEqual({ start: 75, width: 25 });
  });

  it("writes each value in its segment in the short format, the whole one left to the tooltip", async () => {
    const user = userEvent.setup();
    render(<HorizontalBarChart aria-label="Account" rows={accounts} series={series} format={whole} formatTick={millions} />);
    expect(within(screen.getByRole("img", { name: /Current accounts/ })).getByText("15M")).toBeInTheDocument();
    expect(within(screen.getByRole("img", { name: /New accounts/ })).getByText("5M")).toBeInTheDocument();
    await user.tab();
    // One bar: Figma's tooltip, the series' name over its value.
    const tip = (await screen.findByText("15,000,000", { selector: "[data-open] *" })).closest("[data-open]");
    expect(tip).toHaveTextContent("Current accounts15,000,000");
  });

  it("leaves the values to the tooltip when asked", () => {
    render(<HorizontalBarChart aria-label="Account" rows={accounts} series={series} format={whole} formatTick={millions} showValues={false} />);
    expect(within(screen.getByRole("img", { name: /Current accounts/ })).queryByText("15M")).not.toBeInTheDocument();
  });

  it("draws a loss left of the zero line, which it marks", () => {
    const { container } = render(
      <HorizontalBarChart
        aria-label="Profit"
        rows={[{ label: "Retail", values: { current: 30, new: -10 } }]}
        series={series}
        format={whole}
      />,
    );
    expect(axisOf(container)).toEqual(["-10", "0", "10", "20", "30"]);
    expect(geometry(screen.getByRole("img", { name: "Retail: Current accounts 30" }))).toEqual({ start: 25, width: 75 });
    expect(geometry(screen.getByRole("img", { name: "Retail: New accounts -10" }))).toEqual({ start: 0, width: 25 });
    expect(container.querySelector(".bg-chart-grid")).toHaveStyle({ left: "25%" });
  });

  it("keeps a series at 0 a place to move to and hear, and a bar without values says so", () => {
    render(
      <HorizontalBarChart
        aria-label="Accounts"
        rows={[
          { label: "Deposit", values: { current: 12, new: 0 } },
          { label: "Loan", values: { current: null, new: null } },
        ]}
        series={series}
        format={whole}
        messages={{ noValue: "Belum ada nilai" }}
      />,
    );
    const none = screen.getByRole("img", { name: "Deposit: New accounts 0" });
    expect(none).not.toHaveClass("chart-bar-horizontal");
    expect(screen.getByRole("img", { name: "Loan: Belum ada nilai" })).toBeInTheDocument();
  });

  it("says so over the plot when no bar has a value, or when every value is 0, and is described by it", () => {
    const { container, rerender } = render(
      <HorizontalBarChart aria-label="Account" rows={[{ label: "Number of Accounts", values: { current: null, new: null } }]} series={series} format={whole} emptyMessage="Round has not started" />,
    );
    expect(screen.getByRole("group", { name: "Account" })).toHaveAccessibleDescription("Round has not started");
    expect(axisOf(container)).toEqual([]);
    rerender(<HorizontalBarChart aria-label="Account" rows={[{ label: "Number of Accounts", values: { current: 0, new: 0 } }]} series={series} format={whole} />);
    expect(screen.getByRole("group", { name: "Account" })).toHaveAccessibleDescription("All values are 0");
    expect(axisOf(container)).toEqual(["0"]);
  });

  it("names every series of every bar, and each tooltip its bar, when there are several", async () => {
    const user = userEvent.setup();
    render(
      <HorizontalBarChart
        aria-label="Accounts"
        rows={[
          { label: "Deposit", values: { current: 12, new: 3 } },
          { label: "Loan", values: { current: 8, new: 2 } },
        ]}
        series={series}
        format={whole}
      />,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("img", { name: "Loan: Current accounts 8" })).toHaveFocus();
    const tip = (await screen.findByText("8", { selector: "[data-open] *" })).closest("[data-open]");
    expect(tip).toHaveTextContent("LoanCurrent accounts8");
  });

  it("lists the series in the legend, in order", () => {
    const { container } = render(<HorizontalBarChart aria-label="Account" rows={accounts} series={series} format={whole} />);
    expect(container.firstElementChild?.lastElementChild?.textContent).toBe("Current accountsNew accounts");
  });

  it("is one tab stop, the arrow keys, Home and End moving between the parts", async () => {
    const user = userEvent.setup();
    render(
      <HorizontalBarChart
        aria-label="Accounts"
        rows={[
          { label: "Deposit", values: { current: 12, new: 3 } },
          { label: "Loan", values: { current: 8, new: 2 } },
        ]}
        series={series}
        format={whole}
      />,
    );
    await user.tab();
    expect(screen.getByRole("img", { name: "Deposit: Current accounts 12" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("img", { name: "Deposit: New accounts 3" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("img", { name: "Loan: New accounts 2" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("img", { name: "Loan: Current accounts 8" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("img", { name: "Deposit: Current accounts 12" })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
