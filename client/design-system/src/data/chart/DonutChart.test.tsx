import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokens } from "../../tokens";
import { ChartPanel } from "./ChartPanel";
import { DonutChart, type DonutSegment } from "./DonutChart";

const dollars = (value: number) => `$${value.toLocaleString("en-US")}`;
const millions = (value: number) => `${Math.round(value / 1e6)}M`;

const SIZE = Number.parseFloat(tokens.component.chart["donut-size"]);
const GAP = Number.parseFloat(tokens.component.chart["donut-gap"]);
/** The ring's length along its middle: the ring is a quarter of the radius thick. */
const RING = 2 * Math.PI * (SIZE / 2) * 0.875;

const revenue: DonutSegment[] = [
  { label: "Deposit", value: 50_000_000 },
  { label: "Loan", value: 30_000_000 },
  { label: "Credit Card", value: 20_000_000 },
];

/** A segment's stroke along the ring: how long it is and where it starts. */
function arcOf(part: HTMLElement) {
  const stroke = part.querySelector<SVGCircleElement>(".chart-arc");
  if (!stroke) return null;
  return { length: Number.parseFloat(stroke.style.getPropertyValue("--arc-length")), start: -Number.parseFloat(stroke.style.getPropertyValue("--arc-offset")) };
}

describe("DonutChart", () => {
  it("is a chart named by its label, each part to hear with its value, the total in the middle", () => {
    render(<DonutChart aria-label="Revenue" segments={revenue} format={dollars} formatTotal={millions} totalLabel="revenue" />);
    const chart = screen.getByRole("group", { name: "Revenue" });
    expect(chart).toHaveAttribute("aria-roledescription", "donut chart");
    expect(within(chart).getAllByRole("img").map((part) => part.getAttribute("aria-label"))).toEqual([
      "Deposit: $50,000,000",
      "Loan: $30,000,000",
      "Credit Card: $20,000,000",
    ]);
    expect(within(chart).getByText("100M")).toBeInTheDocument();
    expect(within(chart).getByText("revenue")).toBeInTheDocument();
  });

  it("is named by the title of the ChartPanel it sits in", () => {
    render(
      <ChartPanel title="Revenue">
        <DonutChart segments={revenue} format={dollars} />
      </ChartPanel>,
    );
    expect(screen.getByRole("group", { name: "Revenue" })).toBeInTheDocument();
  });

  it("gives each part its share of the ring clockwise from the top, the gap split either side of it", () => {
    render(<DonutChart aria-label="Revenue" segments={revenue} format={dollars} />);
    const [deposit, loan, card] = ["Deposit", "Loan", "Credit Card"].map((label) => arcOf(screen.getByRole("img", { name: new RegExp(`^${label}:`) }))!);
    expect(deposit!.start).toBeCloseTo(GAP / 2);
    expect(deposit!.length).toBeCloseTo(RING * 0.5 - GAP);
    expect(loan!.start).toBeCloseTo(RING * 0.5 + GAP / 2);
    expect(loan!.length).toBeCloseTo(RING * 0.3 - GAP);
    expect(card!.start).toBeCloseTo(RING * 0.8 + GAP / 2);
    expect(card!.length + card!.start + GAP / 2).toBeCloseTo(RING);
  });

  it("draws one part as the whole ring, without a gap", () => {
    render(<DonutChart aria-label="Revenue" segments={[{ label: "Deposit", value: 12 }]} format={dollars} />);
    const ring = arcOf(screen.getByRole("img", { name: "Deposit: $12" }))!;
    expect(ring.length).toBeCloseTo(RING);
    expect(ring.start).toBeCloseTo(0);
  });

  it("keeps a part at 0, or without a value, a place to move to and hear, and in the legend", () => {
    const { container } = render(
      <DonutChart
        aria-label="Revenue"
        segments={[
          { label: "Deposit", value: 40 },
          { label: "Loan", value: 0 },
          { label: "Credit Card", value: null },
          { label: "Mortgage", value: 10 },
        ]}
        format={dollars}
        messages={{ noValue: "Belum ada nilai" }}
      />,
    );
    expect(arcOf(screen.getByRole("img", { name: "Loan: $0" }))).toBeNull();
    expect(arcOf(screen.getByRole("img", { name: "Credit Card: Belum ada nilai" }))).toBeNull();
    expect(arcOf(screen.getByRole("img", { name: "Mortgage: $10" }))!.length).toBeCloseTo(RING * 0.2 - GAP);
    expect(container.querySelector("ul")?.textContent).toBe("DepositLoanCredit CardMortgage");
  });

  it("gives a part below 0 no segment, and counts it in the total", () => {
    render(
      <DonutChart
        aria-label="Profit"
        segments={[
          { label: "Deposit", value: 60 },
          { label: "Loan", value: -20 },
        ]}
        format={dollars}
      />,
    );
    expect(arcOf(screen.getByRole("img", { name: "Loan: $-20" }))).toBeNull();
    expect(arcOf(screen.getByRole("img", { name: "Deposit: $60" }))!.length).toBeCloseTo(RING);
    expect(screen.getByText("$40")).toBeInTheDocument();
  });

  it("says so in the middle when no part has a value above 0, and is described by it", () => {
    const { container } = render(
      <DonutChart aria-label="Revenue" segments={revenue.map((segment) => ({ ...segment, value: null }))} format={dollars} totalLabel="revenue" emptyMessage="Round has not started" />,
    );
    expect(screen.getByRole("group", { name: "Revenue" })).toHaveAccessibleDescription("Round has not started");
    expect(screen.queryByText("revenue")).not.toBeInTheDocument();
    // The empty ring.
    expect(container.querySelector("circle.stroke-chart-grid")).toBeInTheDocument();
  });

  it("is one tab stop, the arrow keys moving round the parts, each tooltip its name and value", async () => {
    const user = userEvent.setup();
    render(<DonutChart aria-label="Revenue" segments={revenue} format={dollars} />);
    await user.tab();
    expect(screen.getByRole("img", { name: "Deposit: $50,000,000" })).toHaveFocus();
    const tip = (await screen.findByText("$50,000,000", { selector: "[data-open] *" })).closest("[data-open]");
    expect(tip).toHaveTextContent("Deposit$50,000,000");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("img", { name: "Loan: $30,000,000" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("img", { name: "Credit Card: $20,000,000" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("img", { name: "Deposit: $50,000,000" })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
