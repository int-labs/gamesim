import type { Meta, StoryObj } from "@storybook/react-vite";
import { RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { expect, screen, userEvent } from "storybook/test";
import {
  Button,
  Card,
  CardHeader,
  ChartCard,
  Heading,
  StackedBarChart,
  type ChartRow,
  type ChartSeries,
  type StackedBarChartProps,
  type StackedChartRow,
} from "../../src";
import { expectTooltip } from "../support/tooltip";

const meta = {
  title: "Data/Charts",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The chart cards of the Admin simulation page (Figma Revenue Comparison, 3310:177820): one value per team as square blue bars from a zero line, round values up the side, the teams along the bottom. Hovering a team's column, or moving to it with the arrow keys, shows its name and value in the chart tooltip. StackedBarChart splits each team's bar by series, for the feedback slides: the values inside the segments, a legend under it, and no card of its own.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Figma's labels: "$3,000M" up the side, "2,260M" in the tooltip. */
const millions = (value: number) => `${(value / 1e6).toLocaleString("en-US")}M`;
const dollarMillions = (value: number) => `$${millions(value)}`;
const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
const percent = (value: number) => new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);

const revenue: ChartRow[] = [
  { label: "Team Alpha", value: 2_200_000_000 },
  { label: "Team Beta", value: 3_000_000_000 },
  { label: "Team Gamma", value: 1_550_000_000 },
  { label: "Team Delta", value: 2_260_000_000 },
  { label: "Team Epsilon", value: 2_650_000_000 },
];

/** The Figma card (Variant2): five teams, Figma's numbers and labels. */
export const RevenueComparison: Story = {
  render: () => <ChartCard title="Revenue Comparison" rows={revenue} format={millions} formatTick={dollarMillions} className="max-w-lg" />,
};

/** Hovering Team Delta, as Figma draws it; here reached with the arrow keys. */
export const TeamTooltip: Story = {
  render: RevenueComparison.render,
  play: async ({ canvas }) => {
    for (let step = 0; step < 10 && document.activeElement !== canvas.getByRole("img", { name: "Team Alpha: 2,200M" }); step += 1) await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await expect(canvas.getByRole("img", { name: "Team Delta: 2,260M" })).toHaveFocus();
    await expectTooltip("2,260M");
  },
};

/** Before the round starts (Figma Default): the teams are known, the values not yet. */
export const RoundNotStarted: Story = {
  render: () => (
    <ChartCard
      title="Revenue Comparison"
      rows={revenue.map((row) => ({ ...row, value: null }))}
      format={millions}
      emptyMessage="Round has not started"
      className="max-w-lg"
    />
  ),
};

/** Profit can be a loss: bars go down from the zero line, and a team without decisions has none. */
export const ProfitWithLosses: Story = {
  render: () => (
    <ChartCard
      title="Risk Adjusted Profit"
      rows={[
        { label: "Team Alpha", value: 420_000_000 },
        { label: "Team Beta", value: -180_000_000 },
        { label: "Team Gamma", value: 910_000_000 },
        { label: "Team Delta", value: null },
        { label: "Team Epsilon", value: -35_000_000 },
      ]}
      format={compactMoney}
      className="max-w-lg"
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Team Delta: No value" })).toBeInTheDocument();
  },
};

const tenTeams: ChartRow[] = [
  "Team Anakin",
  "Team Novabank Digital Transformation",
  "Team Kopi Susu",
  "Team Garuda Emas",
  "Team Merah Putih Capital",
  "Team Borobudur",
  "Team Sunda Kelapa Holdings",
  "Team Nusantara",
  "Team Rinjani",
  "Team Komodo",
].map((label, index) => ({ label, value: [0.78, 0.64, 0.91, 0.55, 0.7, 0.83, 0.47, 0.69, 0.88, 0.6][index] ?? null }));

/** Ten teams with long names: labels wrap to two lines and are cut; the tooltip has the whole name. */
export const TenTeams: Story = {
  render: () => <ChartCard title="Customer Satisfaction (CSAT)" rows={tenTeams} format={percent} className="max-w-lg" />,
};

const banks = ["Harbour Capital", "Northstar Bank", "Lumen Financial", "Cedar Trust", "Atlas Savings", "Summit Bancorp"];

/** Six banks on a card two to a row at 1280 px, as the Admin's simulation page: "Northstar" stays whole, "Bank" goes under it. */
export const BankNames: Story = {
  render: () => (
    <ChartCard
      title="Customer Satisfaction (CSAT)"
      rows={banks.map((label, index) => ({ label, value: [0.69, 0.69, 0.68, 0.69, 0.68, 0.69][index] ?? null }))}
      format={percent}
      className="max-w-md"
    />
  ),
};

const journalTeams = ["Papertrail", "Colophon", "Ampersand", "Signature", "Deckle", "Inkwell", "Marginalia", "Letterpress", "Northstar", "Typewriter", "Quill", "Parchment"];

/** Twelve teams named in one word each, as Journal's: a name too long for its column ends in "…", never broken inside the word. */
export const OneWordNames: Story = {
  render: () => (
    <ChartCard
      title="Revenue"
      rows={journalTeams.map((label, index) => ({ label, value: (index + 3) * 1_150_000 }))}
      format={compactMoney}
      className="max-w-lg"
    />
  ),
};

/** Today's metrics panel on the simulation page, in the Figma cards: two across on a slate panel. */
export const SimulationMetrics: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Heading level={2} variant="section-title">
        Real-Time Metrics
      </Heading>
      <div className="grid grid-cols-1 gap-4 rounded-xl bg-surface-panel p-5 lg:grid-cols-2">
        <ChartCard title="Revenue" rows={revenue} format={compactMoney} />
        <ChartCard
          title="Risk Adjusted Profit"
          rows={revenue.map((row, index) => ({ ...row, value: [410e6, -120e6, 880e6, 305e6, 640e6][index] ?? null }))}
          format={compactMoney}
        />
        <ChartCard title="Customer Satisfaction (CSAT)" rows={revenue.map((row, index) => ({ ...row, value: [0.78, 0.64, 0.91, 0.55, 0.7][index] ?? null }))} format={percent} />
        <ChartCard title="Employee Satisfaction (ESAT)" rows={revenue.map((row, index) => ({ ...row, value: [0.61, 0.73, null, 0.68, 0.8][index] ?? null }))} format={percent} />
      </div>
    </div>
  ),
};

const rounds: ChartRow[][] = [
  revenue.map((row) => ({ ...row, value: null })),
  revenue,
  revenue.map((row, index) => ({ ...row, value: [2.6e9, 2.4e9, 3.4e9, 1.9e9, 2.9e9][index] ?? null })),
];

/** Values arriving live: the bars grow in, then move to each new value. */
export const LiveUpdates: Story = {
  tags: ["no-screenshot"],
  render: function Render() {
    const [round, setRound] = useState(0);
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <Button variant="secondary" iconStart={RefreshCw} onClick={() => setRound((value) => (value + 1) % rounds.length)} className="self-start">
          Next update
        </Button>
        <ChartCard title="Revenue Comparison" rows={rounds[round] ?? []} format={compactMoney} emptyMessage="Round has not started" />
      </div>
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Round has not started")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next update" }));
    await expect(canvas.getByRole("img", { name: "Team Beta: $3B" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next update" }));
    await expect(canvas.getByRole("img", { name: "Team Gamma: $3.4B" })).toBeInTheDocument();
    await expect(screen.queryByText("Round has not started")).not.toBeInTheDocument();
  },
};

/** "76B" up the side and in the segments; "75.62B" in the tooltip, as today's feedback slides write deposits. */
const billions = (value: number) => `${(value / 1e9).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;
const billionsExact = (value: number) => `${(value / 1e9).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;
const whole = (value: number) => value.toLocaleString("en-US");

/** Today's feedback teams, with the server's "(n)" after each name. */
const teams = ["Bankruptcy Avoidance Squad (1)", "Juliebear Bank (2)", "Deutsche Bonk (3)", "Leeman Siblings (4)", "The Loan Rangers (5)"];

/** Today's energy slide: its series names and its pink, yellow and indigo. */
const energySeries: ChartSeries[] = [
  { key: "product", label: "Total Product Energy", color: 3 },
  { key: "tAndO", label: "Total T&O", color: 6 },
  { key: "initiatives", label: "Enterprise Initiatives", color: 1 },
];
const energy: StackedChartRow[] = teams.map((label, index) => ({
  label,
  values: [
    { product: 26, tAndO: 54, initiatives: 20 },
    { product: 14, tAndO: 63, initiatives: 23 },
    { product: 59, tAndO: 22, initiatives: 15 },
    { product: 50, tAndO: 35, initiatives: 15 },
    { product: 33, tAndO: 42, initiatives: 25 },
  ][index] ?? {},
}));

const segments: ChartSeries[] = [
  { key: "retailMass", label: "Retail Mass" },
  { key: "retailAffluent", label: "Retail Affluent" },
  { key: "sme", label: "SME" },
  { key: "corporate", label: "Corporate" },
];
const deposits: StackedChartRow[] = teams.map((label, index) => ({
  label,
  values: [
    { retailMass: 19.4e9, retailAffluent: 17.1e9, sme: 12.2e9, corporate: 24.9e9 },
    { retailMass: 21.8e9, retailAffluent: 15.6e9, sme: 11.3e9, corporate: 23.4e9 },
    { retailMass: 18.2e9, retailAffluent: 19.7e9, sme: 13.9e9, corporate: 21.6e9 },
    { retailMass: 20.5e9, retailAffluent: 16.4e9, sme: 10.8e9, corporate: 25.9e9 },
    { retailMass: 22.9e9, retailAffluent: 18.3e9, sme: 12.7e9, corporate: 20.1e9 },
  ][index] ?? {},
}));

/** The chart on a white card, as a slide or a page shows it, named by the card's title. */
function StackedCard({ title, ...chart }: StackedBarChartProps & { title: string }) {
  const titleId = useId();
  return (
    <Card className="max-w-3xl">
      <CardHeader title={title} titleId={titleId} level={3} />
      <StackedBarChart aria-labelledby={titleId} {...chart} />
    </Card>
  );
}

/** Today's "How we invested our time": each team's energy by where it went, the values in the segments. */
export const EnergyByArea: Story = {
  render: () => <StackedCard title="How we invested our time" rows={energy} series={energySeries} format={whole} />,
};

/** Deposits by segment, in the tens of billions: short values on the axis and in the segments, the whole value in the tooltip. */
export const DepositsBySegment: Story = {
  render: () => (
    <StackedCard
      title="Total Deposits Raised"
      rows={deposits}
      series={segments}
      format={billionsExact}
      formatTick={billions}
      axisLabel="Growth in Deposits"
    />
  ),
};

const rates = ["1.50%", "1.75%", "1.25%", "2.00%", "1.60%"];

/** One series makes one bar per team: today's Retail Mass slide, each team's interest rate under its bar. */
export const OneSeries: Story = {
  render: () => (
    <StackedCard
      title="Deposits Raised From Retail Mass Segment"
      rows={deposits.map((row, index) => ({ label: row.label, values: { retailMass: row.values.retailMass }, caption: rates[index] }))}
      series={[{ key: "retailMass", label: "Retail Mass", color: 3 }]}
      format={billionsExact}
      formatTick={billions}
      axisLabel="Billions"
      captionLabel="Interest rate"
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "Juliebear Bank (2): Retail Mass 21.80B, Interest rate 1.75%" })).toBeInTheDocument();
  },
};

/** A round nobody has played: every value 0. The teams and the zero line stay, with a line saying so. */
export const UntouchedRound: Story = {
  render: () => (
    <StackedCard
      title="How we invested our time"
      rows={energy.map((row) => ({ label: row.label, values: { product: 0, tAndO: 0, initiatives: 0 } }))}
      series={energySeries}
      format={whole}
      emptyMessage="No energy spent this round"
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No energy spent this round")).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Juliebear Bank (2): Total Product Energy 0, Total T&O 0, Enterprise Initiatives 0, Total 0" })).toBeInTheDocument();
  },
};

/** A loss goes below the zero line, a gain above it, in the same bar. */
export const GainsAndLosses: Story = {
  render: () => (
    <StackedCard
      title="Profit by Segment"
      rows={teams.map((label, index) => ({
        label,
        values: [
          { retailMass: 1.2e9, sme: -0.4e9, corporate: 0.9e9 },
          { retailMass: 0.8e9, sme: 0.3e9, corporate: -0.6e9 },
          { retailMass: -0.5e9, sme: 0.2e9, corporate: 1.4e9 },
          { retailMass: 1.1e9, sme: 0.6e9, corporate: 0.7e9 },
          { retailMass: null, sme: null, corporate: null },
        ][index] ?? {},
      }))}
      series={segments.filter((segment) => segment.key !== "retailAffluent")}
      format={billionsExact}
      formatTick={billions}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "The Loan Rangers (5): No value" })).toBeInTheDocument();
  },
};

/** Moving to a team with the arrow keys shows each series' value and the total in the tooltip. */
export const StackedTooltip: Story = {
  render: DepositsBySegment.render,
  play: async ({ canvas }) => {
    const first = canvas.getByRole("img", { name: /^Bankruptcy Avoidance Squad \(1\):/ });
    for (let step = 0; step < 10 && document.activeElement !== first; step += 1) await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(canvas.getByRole("img", { name: "Deutsche Bonk (3): Retail Mass 18.20B, Retail Affluent 19.70B, SME 13.90B, Corporate 21.60B, Total 73.40B" })).toHaveFocus();
    await expectTooltip("73.40B");
  },
};

/** Long team names: each keeps to its own column, broken between words and cut with "…"; the tooltip has it whole. */
export const LongNames: Story = {
  render: () => (
    <div className="max-w-md">
      <StackedCard
        title="Total Deposits Raised"
        rows={deposits.map((row, index) => ({ ...row, label: ["Papertrail Inkwell Margin", "Ampersand", "Signature Deckle", "Colophon Letterpress", "Northstar"][index] ?? row.label }))}
        series={segments}
        format={billionsExact}
        formatTick={billions}
      />
    </div>
  ),
};

/** Ten teams on a narrow card: a value wider than its bar is left to the tooltip. */
export const NarrowBars: Story = {
  render: () => (
    <div className="max-w-md">
      <StackedCard
        title="Total Deposits Raised"
        rows={[...deposits, ...deposits].map((row, index) => ({ ...row, label: `Team ${index + 1}` }))}
        series={segments}
        format={billionsExact}
        formatTick={billions}
      />
    </div>
  ),
};
