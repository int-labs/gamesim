import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartPanel } from "./ChartPanel";
import { ComboChart, type ComboChartRow, type ComboSeries } from "./ComboChart";

const customers: ComboSeries = { label: "Number of customers", format: (value) => value.toLocaleString("en-US") };
const rate: ComboSeries = { label: "Charge-off rate", format: (value) => `${value.toFixed(1)}%`, formatTick: (value) => `${value}%` };

const rows: ComboChartRow[] = [
  { label: "4", bar: 2000, line: 1 },
  { label: "3", bar: 8000, line: 5 },
  { label: "2", bar: 13_900, line: 12 },
  { label: "1", bar: 6000, line: 20, muted: true },
  { label: "0", bar: 1000, line: 28.5, muted: true },
];

/** A column's bar: its top and height in pixels from the plot's top, from the variables it is given. */
function barOf(column: HTMLElement) {
  const bar = column.querySelector<HTMLElement>(".chart-bar");
  if (!bar) return null;
  return { top: Number.parseFloat(bar.style.getPropertyValue("--bar-top")), height: Number.parseFloat(bar.style.getPropertyValue("--bar-height")), bar };
}

function startAxisOf(container: HTMLElement) {
  return [...container.querySelectorAll(".inset-e-0.-translate-y-1\\/2")].map((label) => label.textContent);
}

function endAxisOf(container: HTMLElement) {
  return [...container.querySelectorAll(".inset-s-0.-translate-y-1\\/2")].map((label) => label.textContent);
}

describe("ComboChart", () => {
  it("is a chart named by its label, a column per point with its bar and line values", () => {
    render(<ComboChart aria-label="Charge-offs" rows={rows} bar={customers} line={rate} pointLabel="Minimum Credit Score" />);
    const chart = screen.getByRole("group", { name: "Charge-offs" });
    expect(chart).toHaveAttribute("aria-roledescription", "bar and line chart");
    expect(within(chart).getAllByRole("img").map((column) => column.getAttribute("aria-label"))).toEqual([
      "Minimum Credit Score 4: Number of customers 2,000, Charge-off rate 1.0%",
      "Minimum Credit Score 3: Number of customers 8,000, Charge-off rate 5.0%",
      "Minimum Credit Score 2: Number of customers 13,900, Charge-off rate 12.0%",
      "Minimum Credit Score 1: Number of customers 6,000, Charge-off rate 20.0%",
      "Minimum Credit Score 0: Number of customers 1,000, Charge-off rate 28.5%",
    ]);
  });

  it("is named by the title of the ChartPanel it sits in", () => {
    render(
      <ChartPanel title="Expected Charge-Offs on New Loans">
        <ComboChart rows={rows} bar={customers} line={rate} />
      </ChartPanel>,
    );
    expect(screen.getByRole("group", { name: "Expected Charge-Offs on New Loans" })).toBeInTheDocument();
  });

  it("counts the line up the start side and the bars up the end side, on the same five grid lines", () => {
    const { container } = render(<ComboChart aria-label="Charge-offs" rows={rows} bar={customers} line={rate} />);
    expect(startAxisOf(container)).toEqual(["0%", "8%", "16%", "24%", "32%"]);
    expect(endAxisOf(container)).toEqual(["0", "4,000", "8,000", "12,000", "16,000"]);
    expect(container.querySelectorAll(".h-px.bg-chart-grid")).toHaveLength(5);
  });

  it("draws the bars to their scale from the zero line, in the muted gray outside the range", () => {
    render(<ComboChart aria-label="Charge-offs" rows={rows} bar={customers} line={rate} />);
    // 8,000 of 16,000: half of the 128 px between the zero line at 140 and the top line 12 px down.
    const half = barOf(screen.getByRole("img", { name: /^3:/ }))!;
    expect({ top: half.top, height: half.height }).toEqual({ top: 76, height: 64 });
    expect(half.bar).toHaveClass("bg-chart-2");
    expect(barOf(screen.getByRole("img", { name: /^1:/ }))!.bar).toHaveClass("bg-chart-muted");
  });

  it("runs the line through the points to their scale, a point without a value breaking it", () => {
    const { container, rerender } = render(
      <ComboChart
        aria-label="Charge-offs"
        rows={[
          { label: "2", bar: 10, line: 0 },
          { label: "1", bar: 10, line: 16 },
          { label: "0", bar: 10, line: 32 },
        ]}
        bar={customers}
        line={rate}
      />,
    );
    expect([...container.querySelectorAll("polyline")].map((line) => line.getAttribute("points"))).toEqual(["0.5,140 1.5,76 2.5,12"]);
    expect(container.querySelectorAll(".rounded-full.border")).toHaveLength(3 + 1);
    rerender(<ComboChart aria-label="Charge-offs" rows={rows.map((row, index) => ({ ...row, line: index === 2 ? null : row.line }))} bar={customers} line={rate} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
    expect(screen.getByRole("img", { name: /^2:/ })).toHaveAccessibleName("2: Number of customers 13,900, Charge-off rate No value");
  });

  it("names the muted bars in the legend and with their point, when told what they are", () => {
    const { container } = render(<ComboChart aria-label="Charge-offs" rows={rows} bar={customers} line={rate} mutedLabel="Below your risk level" />);
    expect(screen.getByRole("img", { name: "1: Number of customers 6,000, Charge-off rate 20.0%, Below your risk level" })).toBeInTheDocument();
    expect(container.firstElementChild?.firstElementChild?.textContent).toBe("Number of customersCharge-off rateBelow your risk level");
  });

  it("names a series in the tooltip and for screen readers by its own tooltip name, when it has one", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ComboChart
        aria-label="Charge-offs"
        rows={rows}
        bar={{ ...customers, tipLabel: "Customer Count" }}
        line={{ ...rate, tipLabel: "Charge-Off Rate" }}
        pointLabel="Minimum Credit Score"
      />,
    );
    expect(screen.getByRole("img", { name: "Minimum Credit Score 3: Customer Count 8,000, Charge-Off Rate 5.0%" })).toBeInTheDocument();
    // The legend keeps the series' names.
    expect(container.firstElementChild?.firstElementChild?.textContent).toBe("Number of customersCharge-off rate");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    const tip = (await screen.findByText("8,000", { selector: "[data-open] *" })).closest("[data-open]");
    expect(tip).toHaveTextContent("Minimum Credit Score3Customer Count8,000Charge-Off Rate5.0%");
  });

  it("names the series in the legend over the plot, the bars' first", () => {
    const { container } = render(<ComboChart aria-label="Charge-offs" rows={rows} bar={customers} line={rate} />);
    expect(container.firstElementChild?.firstElementChild?.textContent).toBe("Number of customersCharge-off rate");
  });

  it("says so over the plot when no point has a value, and is described by it", () => {
    const { container } = render(
      <ComboChart aria-label="Charge-offs" rows={rows.map((row) => ({ ...row, bar: null, line: null }))} bar={customers} line={rate} emptyMessage="Round has not started" />,
    );
    expect(screen.getByRole("group", { name: "Charge-offs" })).toHaveAccessibleDescription("Round has not started");
    expect(startAxisOf(container)).toEqual([]);
    expect(container.querySelectorAll(".h-px.bg-chart-grid")).toHaveLength(0);
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });

  it("is one tab stop, the arrow keys moving between points, the tooltip giving the point and both values", async () => {
    const user = userEvent.setup();
    render(<ComboChart aria-label="Charge-offs" rows={rows} bar={customers} line={rate} pointLabel="Minimum Credit Score" />);
    await user.tab();
    expect(screen.getByRole("img", { name: /^Minimum Credit Score 4:/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: /^Minimum Credit Score 3:/ })).toHaveFocus();
    const tip = (await screen.findByText("8,000", { selector: "[data-open] *" })).closest("[data-open]");
    expect(tip).toHaveTextContent("Minimum Credit Score3Number of customers8,000Charge-off rate5.0%");
    await user.keyboard("{End}");
    expect(screen.getByRole("img", { name: /^Minimum Credit Score 0:/ })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("img", { name: /^Minimum Credit Score 4:/ })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
