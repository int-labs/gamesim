import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarChart } from "./BarChart";
import { ChartCard } from "./ChartCard";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);

const revenue = [
  { label: "Team Alpha", value: 2_150_000_000 },
  { label: "Team Beta", value: 3_000_000_000 },
  { label: "Team Gamma", value: 1_550_000_000 },
  { label: "Team Delta", value: 2_260_000_000 },
  { label: "Team Epsilon", value: 2_600_000_000 },
];

/** A bar's drawn geometry, from the variables it is given. */
function barOf(column: HTMLElement) {
  const bar = column.firstElementChild as HTMLElement;
  return { top: Number.parseFloat(bar.style.getPropertyValue("--bar-top")), height: Number.parseFloat(bar.style.getPropertyValue("--bar-height")) };
}

describe("ChartCard", () => {
  it("is a bar chart named by the card's title, one image per team with its value", () => {
    render(<ChartCard title="Revenue Comparison" rows={revenue} format={money} />);
    expect(screen.getByRole("heading", { level: 3, name: "Revenue Comparison" })).toBeInTheDocument();
    const chart = screen.getByRole("group", { name: "Revenue Comparison" });
    expect(chart).toHaveAttribute("aria-roledescription", "bar chart");
    expect(within(chart).getAllByRole("img").map((column) => column.getAttribute("aria-label"))).toEqual([
      "Team Alpha: $2.15B",
      "Team Beta: $3B",
      "Team Gamma: $1.55B",
      "Team Delta: $2.26B",
      "Team Epsilon: $2.6B",
    ]);
  });
});

describe("BarChart", () => {
  it("draws round axis values and bars to scale from the zero line", () => {
    const { container } = render(<BarChart aria-label="Revenue" rows={revenue} format={money} />);
    const ticks = [...container.querySelectorAll(".absolute.-translate-y-1\\/2")].map((label) => label.textContent);
    expect(ticks).toEqual(["$0", "$1B", "$2B", "$3B"]);
    const beta = barOf(screen.getByRole("img", { name: "Team Beta: $3B" }));
    const gamma = barOf(screen.getByRole("img", { name: "Team Gamma: $1.55B" }));
    // The top axis value sits 12 px down a 270 px plot, zero at its bottom.
    expect(beta).toEqual({ top: 12, height: 258 });
    expect(gamma.top + gamma.height).toBe(270);
    expect(gamma.height).toBe(Math.round(258 * (1.55 / 3)));
  });

  it("writes the axis with formatTick when given", () => {
    const { container } = render(<BarChart aria-label="Revenue" rows={revenue} format={money} formatTick={(value) => `${value / 1e9}B`} />);
    const ticks = [...container.querySelectorAll(".absolute.-translate-y-1\\/2")].map((label) => label.textContent);
    expect(ticks).toEqual(["0B", "1B", "2B", "3B"]);
  });

  it("draws a loss below the zero line", () => {
    render(
      <BarChart
        aria-label="Profit"
        rows={[
          { label: "Team Alpha", value: 400_000_000 },
          { label: "Team Beta", value: -300_000_000 },
        ]}
        format={money}
      />,
    );
    const gain = barOf(screen.getByRole("img", { name: "Team Alpha: $400M" }));
    const loss = barOf(screen.getByRole("img", { name: "Team Beta: -$300M" }));
    const zero = gain.top + gain.height;
    expect(loss.top).toBe(zero);
    expect(loss.height).toBeGreaterThan(0);
    expect(zero).toBeLessThan(270);
  });

  it("leaves a team without a value without a bar, and says so", () => {
    render(
      <BarChart
        aria-label="Revenue"
        rows={[revenue[0]!, { label: "Team Zeta", value: null }]}
        format={money}
        messages={{ noValue: "Belum ada nilai" }}
      />,
    );
    expect(barOf(screen.getByRole("img", { name: "Team Zeta: Belum ada nilai" })).height).toBe(0);
  });

  it("shows its empty message over the plot when no team has a value, and is described by it", () => {
    render(
      <BarChart
        aria-label="Revenue"
        rows={revenue.map((row) => ({ ...row, value: null }))}
        format={money}
        emptyMessage="Round has not started"
      />,
    );
    const chart = screen.getByRole("group", { name: "Revenue" });
    expect(chart).toHaveAccessibleDescription("Round has not started");
    expect(within(chart).getAllByRole("img")).toHaveLength(5);
  });

  it("is one tab stop, moved through with the arrow keys, Home and End, the tooltip following", async () => {
    const user = userEvent.setup();
    render(<BarChart aria-label="Revenue" rows={revenue} format={money} />);
    await user.tab();
    expect(screen.getByRole("img", { name: "Team Alpha: $2.15B" })).toHaveFocus();
    expect(await screen.findByText("$2.15B", { selector: "[data-open] *" })).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: "Team Beta: $3B" })).toHaveFocus();
    expect(await screen.findByText("$3B", { selector: "[data-open] *" })).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(screen.getByRole("img", { name: "Team Epsilon: $2.6B" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("img", { name: "Team Alpha: $2.15B" })).toHaveFocus();
    // Tab leaves the chart: the other teams are not stops of their own.
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
