import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  DataTable,
  HeatCell,
  heatScores,
  PageHeader,
  Slide,
  SlideDeck,
  StackedBarChart,
  type ChartSeries,
  type DataTableColumn,
  type SlideDeckProps,
  type StackedChartRow,
} from "../../src";
import { withStoryRouter } from "../support/router";

const meta = {
  title: "Data/Slide deck",
  decorators: [withStoryRouter],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Figma's slides viewer (3344:153468): a 16:9 slide in a white frame, Previous and Next under it with the slide's number between them. A slide is laid out at Figma's 809 x 455 and grows to fill the frame, or the screen in full screen; the content fills the slide under its title. The arrow keys, Page Up, Page Down, Home and End move between slides while focus is in the deck.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const teams = ["Bankruptcy Avoidance Squad (1)", "Juliebear Bank (2)", "Deutsche Bonk (3)", "Leeman Siblings (4)", "The Loan Rangers (5)"];
const whole = (value: number) => value.toLocaleString("en-US");
const rates = ["1.50%", "1.75%", "1.25%", "2.00%", "1.60%"];
const billions = (value: number) => `${(value / 1e9).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;
const billionsExact = (value: number) => `${(value / 1e9).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;

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

interface Revenue {
  line: string;
  byTeam: number[];
}
// Today's revenue slide: a line per segment's product down the side, a column per team, in $bn.
const revenue: Revenue[] = [
  { line: "Retail Mass Deposit Revenue", byTeam: [2.41, 2.12, 2.66, 2.28, 2.53] },
  { line: "Retail Mass Loan Revenue", byTeam: [1.87, 2.05, 1.59, 1.92, 1.74] },
  { line: "Retail Mass Credit Card Revenue", byTeam: [0.92, 1.08, 0.87, 1.15, 0.96] },
  { line: "Retail Affluent Deposit Revenue", byTeam: [1.33, 1.21, 1.47, 1.18, 1.39] },
  { line: "Retail Affluent Wealth Revenue", byTeam: [0.71, 0.64, 0.71, 0.77, 0.69] },
];
// Each value on the tone of its place among the teams, as today's table colours it.
const revenueColumns: DataTableColumn<Revenue>[] = [
  { id: "line", header: "Business Unit", cell: (row) => row.line, primary: true },
  ...teams.map((team, index) => ({
    id: team,
    header: team.replace(/ \(\d\)$/, ""),
    cell: (row: Revenue) => <HeatCell score={heatScores(row.byTeam)[index] ?? 0.5}>{(row.byTeam[index] ?? 0).toFixed(2)}</HeatCell>,
    align: "end" as const,
    // A team's name wraps in its header, so five fit the slide.
    className: "whitespace-normal",
  })),
];

interface Standing {
  team: string;
  score: number;
}
const league: Standing[] = teams.map((team, index) => ({ team, score: [412, 388, 455, 367, 401][index] ?? 0 })).sort((a, b) => a.score - b.score);
const leagueColumns: DataTableColumn<Standing>[] = [
  { id: "team", header: "Team", cell: (row) => row.team, primary: true },
  { id: "score", header: "Total Score", cell: (row) => row.score, align: "end", width: 140 },
];

/** Today's feedback deck, with the charts and tables the Admin will show. */
function FeedbackDeck(props: Partial<SlideDeckProps>) {
  return (
    <SlideDeck
      title="Feedback slides, Year 1"
      footer={(number, total) => `© 2025 by Int Labs for Client XXX. All Rights Reserved | ${number}/${total}`}
      className="min-h-0 flex-1"
      {...props}
    >
      <Slide>
        <p className="m-auto text-center type-page-title font-normal whitespace-pre-line text-fg-primary">{'To all teams,\n"How will you be successful in the future?"'}</p>
      </Slide>
      <Slide title="How we invested our time">
        <StackedBarChart aria-label="How we invested our time" rows={energy} series={energySeries} format={whole} fill />
      </Slide>
      <Slide title="Total Deposits Raised">
        <StackedBarChart
          aria-label="Total Deposits Raised"
          rows={deposits}
          series={segments}
          format={billionsExact}
          formatTick={billions}
          axisLabel="Growth in Deposits"
          fill
        />
      </Slide>
      <Slide title="Deposits Raised From Retail Mass Segment">
        <StackedBarChart
          aria-label="Deposits Raised From Retail Mass Segment"
          rows={deposits.map((row, index) => ({ label: row.label, values: { retailMass: row.values.retailMass }, caption: rates[index] }))}
          series={[{ key: "retailMass", label: "Retail Mass", color: 3 }]}
          format={billionsExact}
          formatTick={billions}
          axisLabel="Billions"
          captionLabel="Interest rate"
          fill
        />
      </Slide>
      <Slide title="Retail & Affluent Revenue Breakdown ($bn)">
        <DataTable label="Retail & Affluent Revenue Breakdown" columns={revenueColumns} rows={revenue} rowKey={(row) => row.line} density="compact" />
      </Slide>
      {/* Today's league reveals a team at a time, from the last place up. */}
      <Slide title="The League Year 1" steps={league.length}>
        {(step) => <DataTable label="The League Year 1" columns={leagueColumns} rows={league.slice(league.length - 1 - step)} rowKey={(row) => row.team} />}
      </Slide>
    </SlideDeck>
  );
}

/** An Admin page as Figma draws it: the breadcrumb and the simulation's name, then the deck filling the rest of the screen. */
function SlidesPage(props: Partial<SlideDeckProps>) {
  return (
    <div className="flex h-dvh flex-col gap-5 bg-surface-page p-(--page-padding)">
      <PageHeader title="Novabank Growth Simulation" />
      <FeedbackDeck {...props} />
    </div>
  );
}

/** The first slide (Figma 3344:153468): only Next, and the slide's number. */
export const FirstSlide: Story = {
  render: () => <SlidesPage />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("region", { name: "Feedback slides, Year 1" })).toBeInTheDocument();
    await expect(canvas.getByText("Slide 1/6")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next" })).toBeInTheDocument();
  },
};

/** A chart slide (Figma 3344:153492): the chart fills the slide under its title; Previous and Next at the slide's edges. */
export const ChartSlide: Story = {
  render: () => <SlidesPage defaultIndex={2} />,
};

/** Today's revenue table, five lines by five teams on heat tiles, at a 1280 px laptop: it fits the slide. */
export const TableAt1280: Story = {
  globals: { viewport: { value: "laptop", isRotated: false } },
  render: () => <SlidesPage defaultIndex={4} />,
};

/**
 * On a phone the slide shrinks to fit the width instead of scrolling sideways, as pinch-zoom
 * enlarges it there; Previous and Next show their arrows, their names left to screen readers.
 */
export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <SlidesPage defaultIndex={2} />,
  play: async ({ canvas }) => {
    // Nothing scrolls sideways: the slide is no wider than the room it has.
    const stage = canvas.getByRole("region", { name: "Feedback slides, Year 1" }).firstElementChild as HTMLElement;
    await expect(stage.scrollWidth).toBeLessThanOrEqual(stage.clientWidth);
    await expect(canvas.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next" })).toBeInTheDocument();
  },
};

/** The last slide (Figma 3344:153515), the league shown whole: only Previous. */
export const LastSlide: Story = {
  render: () => <SlidesPage defaultIndex={5} />,
  play: async ({ canvas }) => {
    // Next reveals the league a team at a time, then goes.
    for (let step = 0; step < 4; step += 1) await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getByText("Slide 6/6")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  },
};

/** Keys move the deck while focus is in it; a press on a slide keeps them there. */
export const Keyboard: Story = {
  tags: ["no-screenshot"],
  render: () => <SlidesPage />,
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getByText("Slide 2/6")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByText("Slide 3/6")).toBeInTheDocument();
    await userEvent.keyboard("{End}");
    await expect(canvas.getByText("Slide 6/6")).toBeInTheDocument();
    // The league's teams, one key each; then Next goes and focus moves to Previous, so the keys still reach the deck.
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await expect(canvas.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Previous" })).toHaveFocus();
    // Page Up steps back through the league before it leaves the slide.
    await userEvent.keyboard("{PageUp}");
    await expect(canvas.getByText("Slide 6/6")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next" })).toBeInTheDocument();
    await userEvent.keyboard("{Home}");
    await expect(canvas.getByText("Slide 1/6")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Next" })).toHaveFocus();
    // The first slide settles in (the others have slid out) before the page is checked.
    await waitFor(() => expect(canvasElement.querySelectorAll("[aria-roledescription='slide']")).toHaveLength(1));
    const slide = await canvas.findByRole("group", { name: "1 of 6" });
    await waitFor(() => expect(getComputedStyle(slide.parentElement?.parentElement ?? slide).opacity).toBe("1"));
  },
};

/** The league shows a team at a time: Next reveals the next place before it moves on, and Previous steps back. */
export const RevealSteps: Story = {
  tags: ["no-screenshot"],
  render: () => <SlidesPage defaultIndex={5} />,
  play: async ({ canvas }) => {
    const table = () => within(canvas.getByRole("table", { name: "The League Year 1" }));
    await expect(table().getAllByRole("row")).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(table().getAllByRole("row")).toHaveLength(3);
    for (let step = 0; step < 3; step += 1) await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(table().getAllByRole("row")).toHaveLength(6);
    await expect(canvas.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Previous" }));
    await expect(table().getAllByRole("row")).toHaveLength(5);
  },
};
