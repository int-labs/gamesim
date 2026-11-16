import type { Meta, StoryObj } from "@storybook/react-vite";
import { RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { expect, userEvent } from "storybook/test";
import {
  Button,
  Card,
  ChartPanel,
  ComboChart,
  DecisionPanel,
  DecisionRow,
  DonutChart,
  HorizontalBarChart,
  NumberField,
  PreviousValue,
  Slider,
  type ChartSeries,
  type ComboChartRow,
  type ComboSeries,
  type DonutSegment,
  type HorizontalChartRow,
  type NumberFieldProps,
} from "../../src";
import { expectTooltip } from "../support/tooltip";

const meta = {
  title: "Data/Player Charts",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The charts beside a product's decisions on the player's pages (Figma 5204:98482 and 2193:396973), each on its slate ChartPanel: Account, a bar split into current and new accounts (HorizontalBarChart); Revenue, a donut of the business unit's products with the total in its middle (DonutChart); and on a loan, the expected charge-offs, bars for the customers at each credit score and a line for the charge-off rate on a second scale (ComboChart). Hovering a part, or moving to it with the arrow keys, shows its values in the chart tooltip.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Figma's chart column (Frame 38740) on the white product card beside the decisions (Products, 711:97660): the panels 16 apart. */
function ChartColumn({ children }: { children: ReactNode }) {
  return (
    <Card variant="container" className="w-full max-w-md gap-4">
      {children}
    </Card>
  );
}

const whole = (value: number) => value.toLocaleString("en-US");
/** "15.9M" in a segment and "5M" on the axis; the tooltip has the whole number. */
const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
/** Figma's "108M" in the donut's middle. */
const compactWhole = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value);
const dollars = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const accountSeries: ChartSeries[] = [
  { key: "current", label: "Current accounts" },
  { key: "new", label: "New accounts" },
];
const accounts: HorizontalChartRow[] = [{ label: "Number of Accounts", values: { current: 15_890_028, new: 5_046_200 } }];

/** Figma's Account card (5204:98482): the accounts the product holds and the ones it opens this round. */
export const Account: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Account">
        <HorizontalBarChart rows={accounts} series={accountSeries} format={whole} formatTick={compact} />
      </ChartPanel>
    </ChartColumn>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("group", { name: "Account" })).toHaveAttribute("aria-roledescription", "horizontal bar chart");
    await expect(canvas.getByRole("img", { name: "Number of Accounts: New accounts 5,046,200" })).toBeInTheDocument();
  },
};

/** Figma's tooltip on the current accounts: the series over its dot and the whole number, here reached with the keyboard. */
export const AccountTooltip: Story = {
  render: Account.render,
  play: async ({ canvas }) => {
    const current = canvas.getByRole("img", { name: "Number of Accounts: Current accounts 15,890,028" });
    for (let step = 0; step < 10 && document.activeElement !== current; step += 1) await userEvent.tab();
    await expect(current).toHaveFocus();
    await expectTooltip("15,890,028");
  },
};

const revenue: DonutSegment[] = [
  { label: "Deposit", value: 47_827_883 },
  { label: "Loan", value: 38_412_560 },
  { label: "Credit Card", value: 21_904_117, color: 4 },
];

/** Figma's Revenue card (2193:396973): the business unit's revenue by product, its total in the middle. */
export const Revenue: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Revenue">
        <DonutChart segments={revenue} format={dollars} formatTotal={compactWhole} totalLabel="revenue" />
      </ChartPanel>
    </ChartColumn>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("group", { name: "Revenue" })).toHaveAttribute("aria-roledescription", "donut chart");
    await expect(canvas.getByText("108M")).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Credit Card: $21,904,117" })).toBeInTheDocument();
  },
};

/** Figma's tooltip on Deposit: its name over its dot and revenue, above the segment. */
export const RevenueTooltip: Story = {
  render: Revenue.render,
  play: async ({ canvas }) => {
    const deposit = canvas.getByRole("img", { name: "Deposit: $47,827,883" });
    for (let step = 0; step < 10 && document.activeElement !== deposit; step += 1) await userEvent.tab();
    await expect(deposit).toHaveFocus();
    await expectTooltip("$47,827,883");
  },
};

/** Figma's credit scores, 20 down to 0, and the customers at each; the last five the bank does not lend to at this risk level. */
const customers = [1130, 3500, 5040, 6590, 8750, 10600, 12150, 13280, 13900, 13180, 12150, 10810, 8960, 7820, 6380, 5040, 4010, 3190, 2270, 1440, 820];
const rates = [0.25, 0.75, 1.5, 2.25, 3, 4, 5, 6, 7, 8.25, 9.75, 11.25, 12.75, 14.75, 16.75, 19, 21.25, 23.75, 26, 29, 32];
const chargeOffs: ComboChartRow[] = customers.map((count, index) => ({ label: `${20 - index}`, bar: count, line: rates[index] ?? null, muted: index >= 16 }));
/** The legend names the series; the tooltip, as Figma's, says "Customer Count" and "Charge-Off Rate". */
const customerSeries: ComboSeries = { label: "Number of customers", tipLabel: "Customer Count", format: whole };
const rateSeries: ComboSeries = { label: "Charge-off rate", tipLabel: "Charge-Off Rate", format: (value) => `${value.toFixed(1)}%`, formatTick: (value) => `${value}%` };

/** Figma's charge-offs card (5204:98482): customers by credit score, and the charge-off rate on the second scale. */
export const ChargeOffs: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Expected Charge-Offs on New Loans">
        <ComboChart rows={chargeOffs} bar={customerSeries} line={rateSeries} pointLabel="Minimum Credit Score" />
      </ChartPanel>
    </ChartColumn>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("group", { name: "Expected Charge-Offs on New Loans" })).toHaveAttribute("aria-roledescription", "bar and line chart");
    await expect(canvas.getByRole("img", { name: "Minimum Credit Score 15: Customer Count 10,600, Charge-Off Rate 4.0%" })).toBeInTheDocument();
  },
};

/** Figma's tooltip at a credit score: the score, the customers and the rate, here reached with the arrow keys. */
export const ChargeOffsTooltip: Story = {
  render: ChargeOffs.render,
  play: async ({ canvas }) => {
    const first = canvas.getByRole("img", { name: /^Minimum Credit Score 20:/ });
    for (let step = 0; step < 10 && document.activeElement !== first; step += 1) await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await expect(canvas.getByRole("img", { name: /^Minimum Credit Score 15:/ })).toHaveFocus();
    await expectTooltip("10,600");
  },
};

/** The gray bars named in the legend and the tooltip, which Figma leaves to the colour alone. */
export const ChargeOffsOutOfRange: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Expected Charge-Offs on New Loans">
        <ComboChart rows={chargeOffs} bar={customerSeries} line={rateSeries} pointLabel="Minimum Credit Score" mutedLabel="Below your risk level" />
      </ChartPanel>
    </ChartColumn>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Minimum Credit Score 2: Customer Count 2,270, Charge-Off Rate 26.0%, Below your risk level" })).toBeInTheDocument();
  },
};

/** Figma's two product pages side by side: a deposit (Revenue and Account) and a loan (charge-offs and Account). */
export const ProductPages: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <ChartColumn>
        <ChartPanel title="Revenue">
          <DonutChart segments={revenue} format={dollars} formatTotal={compactWhole} totalLabel="revenue" />
        </ChartPanel>
        <ChartPanel title="Account">
          <HorizontalBarChart rows={accounts} series={accountSeries} format={whole} formatTick={compact} />
        </ChartPanel>
      </ChartColumn>
      <ChartColumn>
        <ChartPanel title="Expected Charge-Offs on New Loans">
          <ComboChart rows={chargeOffs} bar={customerSeries} line={rateSeries} pointLabel="Minimum Credit Score" />
        </ChartPanel>
        <ChartPanel title="Account">
          <HorizontalBarChart
            rows={[{ label: "Number of Accounts", values: { current: 412_380, new: 96_450 } }]}
            series={accountSeries}
            format={whole}
            formatTick={compact}
          />
        </ChartPanel>
      </ChartColumn>
    </div>
  ),
};

/** A decision's field, its value kept in the story. */
function Field({ initial = 0, ...props }: Omit<NumberFieldProps, "value" | "onValueChange"> & { initial?: number }) {
  const [value, setValue] = useState(initial);
  return <NumberField value={value} onValueChange={setValue} {...props} />;
}

/** A level slider's row: the level beside the title, the thumb on this round's change. */
function LevelRow({ label, description }: { label: string; description: string }) {
  const [change, setChange] = useState(0);
  return (
    <DecisionRow label={label} description={description} level={{ value: 18 + change, change }} control="slider">
      <Slider min={-2} max={5} fillFrom={0} value={change} onValueChange={setChange} />
    </DecisionRow>
  );
}

/**
 * Figma's loan page (5204:98482): the charts beside the decisions, their column as tall as the
 * decisions' panel, each chart centred in the room under its title.
 */
export const BesideTheDecisions: Story = {
  render: () => (
    <Card variant="container" className="max-w-6xl gap-4 lg:flex-row">
      <DecisionPanel title="Set Your Strategy Inputs" className="lg:w-(--decision-panel-width) lg:shrink-0">
        <DecisionRow label="Projected Market Share (%)" description="Estimated share of market that you plan to capture this year.">
          <Field kind="percent" decimals={1} fixedDecimals emphasis initial={12.5} />
          <PreviousValue value="12.5%" />
        </DecisionRow>
        <DecisionRow label="Average Interest Rate (%)" description="The weighted average percentage rate charged across all loan products in your portfolio.">
          <Field kind="percent" decimals={1} fixedDecimals initial={6.5} />
          <PreviousValue value="6.0%" />
        </DecisionRow>
        <LevelRow label="Features of Products" description="The breadth and sophistication level of features you offer on this product." />
        <DecisionRow label="Marketing Spend ($)" description="The total budget allocated to promote your offerings.">
          <Field kind="currency" decimals={0} initial={5000} />
          <PreviousValue value="$5k" />
        </DecisionRow>
        <LevelRow label="Minimum Credit Score Change" description="Adjust the change to the minimum credit score required for loan approvals." />
      </DecisionPanel>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ChartPanel title="Expected Charge-Offs on New Loans" className="flex-1">
          <ComboChart rows={chargeOffs} bar={customerSeries} line={rateSeries} pointLabel="Minimum Credit Score" />
        </ChartPanel>
        <ChartPanel title="Account" className="flex-1">
          <HorizontalBarChart
            rows={[{ label: "Number of Accounts", values: { current: 412_380, new: 96_450 } }]}
            series={accountSeries}
            format={whole}
            formatTick={compact}
          />
        </ChartPanel>
      </div>
    </Card>
  ),
};

/** Before the round's figures: the charts keep their frames and say so. */
export const WithoutValues: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Revenue">
        <DonutChart segments={revenue.map((segment) => ({ ...segment, value: null }))} format={dollars} totalLabel="revenue" emptyMessage="Round has not started" />
      </ChartPanel>
      <ChartPanel title="Account">
        <HorizontalBarChart
          rows={[{ label: "Number of Accounts", values: { current: null, new: null } }]}
          series={accountSeries}
          format={whole}
          emptyMessage="Round has not started"
        />
      </ChartPanel>
      <ChartPanel title="Expected Charge-Offs on New Loans">
        <ComboChart
          rows={chargeOffs.map((row) => ({ ...row, bar: null, line: null }))}
          bar={customerSeries}
          line={rateSeries}
          pointLabel="Minimum Credit Score"
          emptyMessage="Round has not started"
        />
      </ChartPanel>
    </ChartColumn>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("Round has not started")).toHaveLength(3);
    await expect(canvas.getByRole("img", { name: "Number of Accounts: No value" })).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Deposit: No value" })).toBeInTheDocument();
  },
};

/** A product without revenue yet has no segment, but keeps its place in the legend, a keypress away and read out; no new accounts, the same. */
export const ZeroParts: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Revenue">
        <DonutChart
          segments={[{ label: "Deposit", value: 47_827_883 }, { label: "Loan", value: 0 }, { label: "Credit Card", value: 21_904_117, color: 4 }]}
          format={dollars}
          formatTotal={compactWhole}
          totalLabel="revenue"
        />
      </ChartPanel>
      <ChartPanel title="Account">
        <HorizontalBarChart
          rows={[{ label: "Number of Accounts", values: { current: 15_890_028, new: 0 } }]}
          series={accountSeries}
          format={whole}
          formatTick={compact}
        />
      </ChartPanel>
    </ChartColumn>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Loan: $0" })).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Number of Accounts: New accounts 0" })).toBeInTheDocument();
  },
};

/** One product only: the whole ring, without a gap. Six: the palette in order, the smallest a sliver. */
export const DonutParts: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Revenue">
        <DonutChart segments={[{ label: "Deposit", value: 47_827_883 }]} format={dollars} formatTotal={compactWhole} totalLabel="revenue" />
      </ChartPanel>
      <ChartPanel title="Revenue Breakdown">
        <DonutChart
          segments={[
            { label: "Deposit", value: 47_827_883 },
            { label: "Loan", value: 38_412_560 },
            { label: "Credit Card", value: 21_904_117 },
            { label: "Mortgage", value: 12_500_000 },
            { label: "Payments", value: 6_250_000 },
            { label: "Wealth", value: 900_000 },
          ]}
          format={dollars}
          formatTotal={compactWhole}
          totalLabel="revenue"
        />
      </ChartPanel>
    </ChartColumn>
  ),
};

/** SME's products, long names: the legend stays beside the donut, a long name wrapping onto a second line. */
export const LongNames: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Revenue">
        <DonutChart
          segments={[
            { label: "Business Deposit", value: 2_310_000_000 },
            { label: "Capital Loan", value: 1_870_000_000 },
            { label: "Retail Transaction Services", value: 1_760_000_000, color: 4 },
          ]}
          format={dollars}
          formatTotal={compactWhole}
          totalLabel="revenue"
        />
      </ChartPanel>
    </ChartColumn>
  ),
};

/** Several bars share one axis, a loss going left of the zero line. */
export const HorizontalRows: Story = {
  render: () => (
    <ChartColumn>
      <ChartPanel title="Profit by Segment">
        <HorizontalBarChart
          rows={[
            { label: "Retail Mass", values: { interest: 42_000_000, fees: 12_500_000 } },
            { label: "Retail Affluent", values: { interest: 31_000_000, fees: -4_000_000 } },
            { label: "SME", values: { interest: 18_000_000, fees: 6_000_000 } },
          ]}
          series={[
            { key: "interest", label: "Interest income" },
            { key: "fees", label: "Fees", color: 3 },
          ]}
          format={dollars}
          formatTick={compact}
        />
      </ChartPanel>
    </ChartColumn>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Retail Affluent: Fees -$4,000,000" })).toBeInTheDocument();
  },
};

/** On a phone: the legend goes under the donut, and every second credit score is written under the bars. */
export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: ProductPages.render,
  play: async ({ canvasElement }) => {
    const page = canvasElement.ownerDocument.documentElement;
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
  },
};

const rounds: { accounts: HorizontalChartRow[]; revenue: DonutSegment[] }[] = [
  { accounts: [{ label: "Number of Accounts", values: { current: null, new: null } }], revenue: revenue.map((segment) => ({ ...segment, value: null })) },
  { accounts, revenue },
  {
    accounts: [{ label: "Number of Accounts", values: { current: 18_402_310, new: 3_120_000 } }],
    revenue: [
      { label: "Deposit", value: 52_100_000 },
      { label: "Loan", value: 29_800_000 },
      { label: "Credit Card", value: 33_450_000, color: 4 },
    ],
  },
];

/** Figures arriving round by round: the segments grow in, then move to each new value. */
export const LiveUpdates: Story = {
  tags: ["no-screenshot"],
  render: function Render() {
    const [round, setRound] = useState(0);
    const figures = rounds[round] ?? rounds[0]!;
    return (
      <div className="flex w-full max-w-md flex-col gap-4">
        <Button variant="secondary" iconStart={RefreshCw} onClick={() => setRound((value) => (value + 1) % rounds.length)} className="self-start">
          Next round
        </Button>
        <ChartColumn>
          <ChartPanel title="Revenue">
            <DonutChart segments={figures.revenue} format={dollars} formatTotal={compactWhole} totalLabel="revenue" emptyMessage="Round has not started" />
          </ChartPanel>
          <ChartPanel title="Account">
            <HorizontalBarChart rows={figures.accounts} series={accountSeries} format={whole} formatTick={compact} emptyMessage="Round has not started" />
          </ChartPanel>
        </ChartColumn>
      </div>
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("Round has not started")).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "Next round" }));
    await expect(canvas.getByRole("img", { name: "Deposit: $47,827,883" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next round" }));
    await expect(canvas.getByRole("img", { name: "Number of Accounts: Current accounts 18,402,310" })).toBeInTheDocument();
  },
};
