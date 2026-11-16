import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { Card, StatementTable, Tabs, TabsPanel, tokens, type StatementRow } from "../../src";

const meta = {
  title: "Data/Statement Table",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A player's statements under a product's card and on the report pages (Figma Tables 904:131713): Business Performance, the P&L, the Balance Sheet and the Cash Flow, each a StatementTable under the underline Tabs on a 32 px container card. The game computes and formats every figure and the change; the table lays them out: totals and headings in SemiBold on slate, the lines under a parent further in and in italic, a slate band between groups, and on a narrow screen the figures scroll sideways under labels that stay in view.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface Statement {
  value: string;
  label: string;
  table: ReactNode;
}

/** Figma's frame: the tabs over the table, 24 apart, on the 32 px container card (1150 wide). */
function StatementCard({ statements, initial, className }: { statements: Statement[]; initial?: string; className?: string }) {
  return (
    <Card variant="container" className={className ?? "w-full max-w-6xl"}>
      <Tabs label="Statements" tabs={statements.map(({ value, label }) => ({ value, label }))} defaultValue={initial}>
        {statements.map((statement) => (
          <TabsPanel key={statement.value} value={statement.value} className="pt-6">
            {statement.table}
          </TabsPanel>
        ))}
      </Tabs>
    </Card>
  );
}

/** A token's red, green and blue. */
const channels = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
/** The red, green and blue the browser computed for an element's background. */
const background = (element: Element) => (getComputedStyle(element).backgroundColor.match(/\d+/g) ?? []).slice(0, 3).map(Number);
const slate = channels(tokens.color.surface.panel);
const white = channels(tokens.color.surface.card);

const years = ["YEAR 3000", "YEAR 3001", "YEAR 3002"];

// Figma's Business Performance of Retail Mass (898:125792), its accounts without the stray dollar sign.
const businessPerformance: StatementRow[] = [
  { id: "accounts", label: "Total Number of Accounts", values: ["13,017,589", "13,254,789", "12,985,769"], change: "(0.0%)" },
  { id: "deposit", label: "Average Deposit", values: ["$578,286", "$489,510", "$489,510"], change: "(+57.5%)" },
  { id: "loan", label: "Average Loan", values: ["$578,286", "$489,510", "$489,510"], change: "(+57.5%)" },
  { id: "credit", label: "Average Credit", values: ["$578,286", "$489,510", "$489,510"], change: "(+57.5%)" },
  { id: "share", label: "Market Share", values: ["20.0%", "21%", "21%"], change: "(-32.75%)", gapBefore: true },
  { id: "cost-income", label: "Cost to Income Ratio", values: ["4.8%", "5%", "5%"], change: "(+57.5%)" },
  { id: "loan-deposit", label: "Loan to Deposit Ratio", values: ["20.4%", "21%", "21%"], change: "(0.0%)" },
  { id: "npl", label: "Non-performing Loan" },
  { id: "npl-loan", label: "Loan", values: ["1.7%", "2%", "2%"], change: "(-32.75%)", indent: 1 },
  { id: "npl-card", label: "Credit Card", values: ["1.7%", "2%", "2%"], change: "(-32.75%)", indent: 1 },
  { id: "acquisition", label: "Account Acquisition Cost", values: ["$154", "$144", "$114"], change: "(-32.75%)", gapBefore: true },
  { id: "revenue", label: "Revenue Per Account", values: ["$15,424", "$20,452", "$20,452"], change: "(+57.5%)" },
];

// Banking's P&L after two rounds, as a team reads it, in Figma's PNL look (1020:34663).
const profitAndLoss: StatementRow[] = [
  { id: "interest-income", label: "Interest Income", values: ["$5,540,791,948", "$5,115,259,024"], change: "(-7.7%)" },
  { id: "interest-expense", label: "Interest Expense", values: ["$2,770,395,974", "$2,557,629,512"], change: "(-7.7%)" },
  { id: "nii", label: "Net Interest Income", values: ["$2,770,395,974", "$2,557,629,512"], change: "(-7.7%)", kind: "total" },
  { id: "fees", label: "Fees Income", values: ["$522,716,222", "$482,571,606"], change: "(-7.7%)", indent: 2 },
  { id: "other-income", label: "Other Non-Interest Income Total", values: ["$748,772,260", "$692,034,536"], change: "(-7.6%)", indent: 2 },
  { id: "non-interest", label: "Non-Interest Income", values: ["$1,271,488,481", "$1,174,606,142"], change: "(-7.6%)", kind: "total" },
  { id: "revenue", label: "Total Revenue", values: ["$4,041,884,455", "$3,732,235,654"], change: "(-7.7%)", kind: "total" },
  { id: "staff", label: "Staff Costs", values: ["$110,000,000", "$110,000,000"], change: "(0.0%)", indent: 1 },
  { id: "opex", label: "Other Operating Expenses", values: ["$2,644,637,390", "$2,468,505,788"], change: "(-6.7%)", indent: 1 },
  { id: "marketing", label: "Sales & Marketing", values: ["$140,000,000", "$140,000,000"], change: "(0.0%)", indent: 2 },
  { id: "back-office", label: "Back Office Expense", values: ["$504,672,659", "$484,551,285"], change: "(-4.0%)", indent: 2 },
  { id: "channel", label: "Channel and Service", values: ["$1,830,115,876", "$1,686,270,683"], change: "(-7.9%)", indent: 2 },
  { id: "initiatives", label: "Strategic Initiatives & Other Costs", values: ["$158,398,855", "$146,233,820"], change: "(-7.7%)", indent: 2 },
  { id: "depreciation", label: "Depreciation & Amortization", values: ["$11,450,000", "$11,450,000"], change: "(0.0%)", indent: 2 },
  { id: "expenses", label: "Total Expenses", values: ["$2,754,637,390", "$2,578,505,788"], change: "(-6.4%)", kind: "total" },
  { id: "provisions", label: "Provisions", values: ["$0", "$0"], change: "N/A", kind: "total", gapBefore: true },
  { id: "pbt", label: "Profit Before Tax", values: ["$1,287,247,066", "$1,153,729,867"], change: "(-10.4%)", gapBefore: true },
  { id: "tax", label: "Income Tax Expense", values: ["$463,408,944", "$415,342,753"], change: "(-10.4%)" },
  { id: "pat", label: "Profit After Tax", values: ["$823,838,122", "$738,387,114"], change: "(-10.4%)", kind: "total" },
  { id: "capital", label: "Capital Charge", values: ["$155,617,020", "$143,926,602"], change: "(-7.5%)" },
  { id: "rap", label: "Risk Adjusted Profit", values: ["$668,221,102", "$594,460,512"], change: "(-11.0%)", kind: "total" },
  { id: "dividends", label: "Dividends", values: ["$4,119,191", "$3,691,936"], change: "(-10.4%)" },
  { id: "retained", label: "Retained Earnings", values: ["$819,718,931", "$1,554,414,109"], change: "(+89.6%)", kind: "total" },
];

// Figma's Balance Sheet (904:131714).
const balanceSheet: StatementRow[] = [
  { id: "assets", label: "Assets", kind: "section" },
  { id: "cash", label: "Cash and Cash Equivalents ($Mn)", values: ["$5,000", "$5,000"], change: "(0.0%)" },
  { id: "loans", label: "Loans and Advances ($Mn)", values: ["$30,000", "$30,000"], change: "(0.0%)" },
  { id: "investments", label: "Investments ($Mn)", values: ["$10,000", "$10,000"], change: "(0.0%)" },
  { id: "fixed", label: "Fixed Assets ($Mn)", values: ["$2,000", "$2,000"], change: "(0.0%)" },
  { id: "liabilities", label: "Liabilities", kind: "section" },
  { id: "deposits", label: "Deposits ($Mn)", values: ["$40,000", "$40,000"], change: "(0.0%)" },
  { id: "borrowings", label: "Borrowings ($Mn)", values: ["$5,000", "$5,000"], change: "(0.0%)" },
  { id: "other-liabilities", label: "Other Liabilities ($Mn)", values: ["$1,000", "$1,000"], change: "(0.0%)" },
  { id: "equity", label: "Equity", kind: "section" },
  { id: "share-capital", label: "Share Capital ($Mn)", values: ["$5,000", "$5,000"], change: "(0.0%)" },
  { id: "retained", label: "Retained Earnings ($Mn)", values: ["$3,000", "$3,000"], change: "(0.0%)" },
];

// Figma's Cash Flow (904:132458).
const cashFlow: StatementRow[] = [
  { id: "operating", label: "Operating Activities", kind: "section" },
  { id: "interest-income", label: "Interest Income ($Mn)", values: ["$12,000", "$11,000"], change: "(-8.3%)" },
  { id: "interest-expense", label: "Interest Expense ($Mn)", values: ["$8,000", "($7,500)"], change: "(+6.3%)" },
  { id: "fees", label: "Net Fee Income ($Mn)", values: ["$2,000", "$1,800"], change: "(-10.0%)" },
  { id: "investing", label: "Investing Activities", kind: "section" },
  { id: "purchases", label: "Purchase of Investments ($Mn)", values: ["$3,000", "$2,900"], change: "(+3.3%)" },
  { id: "proceeds", label: "Proceeds from Investments ($Mn)", values: ["$4,000", "$3,900"], change: "(-2.5%)" },
  { id: "fixed", label: "Purchase of Fixed Assets ($Mn)", values: ["$1,000", "($9,500)"], change: "(-2.5%)" },
  { id: "financing", label: "Financing Activities", kind: "section" },
  { id: "shares", label: "Issuance of Shares ($Mn)", values: ["$2,000", "$1,900"], change: "(-5.0%)" },
  { id: "repayment", label: "Repayment of Borrowings ($Mn)", values: ["$1,000", "($9,500)"], change: "(+5.0%)" },
  { id: "dividend", label: "Dividend Paid ($Mn)", values: ["$5,000", "$45,000"], change: "(+10.0%)" },
];

const businessPerformanceTable = <StatementTable label="Business Performance" columns={years} changeHeader="YoY Change" rows={businessPerformance} />;
const profitAndLossTable = <StatementTable label="PnL" columns={["Year 1", "Year 2"]} changeHeader="YoY Change" rows={profitAndLoss} />;

/** Figma's Business Performance tab: the bands part the volumes, the ratios and the costs; a parent's lines sit further in, in italic. */
export const BusinessPerformance: Story = {
  render: () => (
    <StatementCard
      statements={[
        { value: "bizperf", label: "Business Performance", table: businessPerformanceTable },
        { value: "pnl", label: "PnL", table: profitAndLossTable },
      ]}
    />
  ),
  play: async ({ canvas, canvasElement }) => {
    const table = canvas.getByRole("table", { name: "Business Performance" });
    await expect(table.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(2);
    await expect(canvas.getByRole("rowheader", { name: "Loan" })).toHaveStyle({ fontStyle: "italic" });
    await expect(canvas.getByRole("rowheader", { name: "Non-performing Loan" })).toHaveStyle({ fontStyle: "normal" });
    // 44 px rows and header, as Figma's.
    for (const name of ["Total Number of Accounts", "Loan"]) {
      await expect(canvas.getByRole("rowheader", { name }).getBoundingClientRect().height).toBe(44);
    }
    await expect(canvasElement.querySelector("th")?.getBoundingClientRect().height).toBe(44);
    // The figures line up at the end of Figma's 164 px columns.
    const header = canvas.getByRole("columnheader", { name: "YEAR 3000" });
    await expect(Math.round(header.getBoundingClientRect().width)).toBe(164);
  },
};

/** The P&L tab, with Banking's lines after two rounds: totals in SemiBold on slate, two levels of lines under their parents, bands before Provisions and before the profit. */
export const ProfitAndLoss: Story = {
  render: () => (
    <StatementCard
      initial="pnl"
      statements={[
        { value: "bizperf", label: "Business Performance", table: businessPerformanceTable },
        { value: "pnl", label: "PnL", table: profitAndLossTable },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    const total = canvas.getByRole("rowheader", { name: "Net Interest Income" });
    await expect(total).toHaveStyle({ fontWeight: "600" });
    await expect(background(total)).toEqual(slate);
    const line = canvas.getByRole("rowheader", { name: "Interest Income" });
    await expect(line).toHaveStyle({ fontWeight: "400" });
    await expect(background(line)).toEqual(white);
    // One level is 20 px further in than the lines, two are 40.
    const start = (name: string) => parseFloat(getComputedStyle(canvas.getByRole("rowheader", { name })).paddingInlineStart);
    await expect(start("Interest Income")).toBe(20);
    await expect(start("Staff Costs")).toBe(40);
    await expect(start("Sales & Marketing")).toBe(60);
    // The tabs switch the statement, and back.
    await userEvent.click(canvas.getByRole("tab", { name: "Business Performance" }));
    await waitFor(() => expect(canvas.getByRole("table", { name: "Business Performance" })).toBeVisible());
    await userEvent.click(canvas.getByRole("tab", { name: "PnL" }));
    await waitFor(() => expect(canvas.getByRole("table", { name: "PnL" })).toBeVisible());
  },
};

const reportStatements: Statement[] = [
  {
    value: "balance",
    label: "Balance Sheet",
    table: <StatementTable label="Balance Sheet" columns={["YEAR 3000", "YEAR 3001"]} changeHeader="YoY Change" labelHeader="KEY INDICATORS" rows={balanceSheet} />,
  },
  {
    value: "cash",
    label: "Cash Flow",
    table: <StatementTable label="Cash Flow" columns={["YEAR 3000", "YEAR 3001"]} changeHeader="YoY Change" labelHeader="KEY INDICATORS" rows={cashFlow} />,
  },
];

/** Figma's Balance Sheet tab: a heading on slate over each group, and Figma's "KEY INDICATORS" over the labels. */
export const BalanceSheet: Story = {
  render: () => <StatementCard statements={reportStatements} />,
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("rowheader", { name: "Liabilities" });
    await expect(heading).toHaveStyle({ fontWeight: "600" });
    await expect(background(heading)).toEqual(slate);
    await expect(canvas.getByRole("columnheader", { name: "KEY INDICATORS" })).toBeInTheDocument();
  },
};

/** Figma's Cash Flow tab: the operating, investing and financing activities, each under its heading. */
export const CashFlow: Story = {
  render: () => <StatementCard initial="cash" statements={reportStatements} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("table", { name: "Cash Flow" })).toBeVisible();
    await expect(canvas.getAllByRole("rowheader").filter((cell) => getComputedStyle(cell).fontWeight === "600")).toHaveLength(3);
  },
};

const rounds = ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5"];
const manyRounds: StatementRow[] = profitAndLoss.slice(0, 7).map((row) => ({
  ...row,
  values: row.values ? rounds.map((_, index) => row.values?.[index % 2] ?? null) : undefined,
}));

/** Five rounds in a tablet's column: the figures scroll sideways inside the frame, the labels stay in view, and the keyboard can scroll it. */
export const NarrowWithFiveRounds: Story = {
  render: () => (
    <StatementCard
      className="w-full max-w-2xl"
      statements={[{ value: "pnl", label: "PnL", table: <StatementTable label="PnL" columns={rounds} changeHeader="YoY Change" rows={manyRounds} /> }]}
    />
  ),
  play: async ({ canvas }) => {
    const region = await canvas.findByRole("region", { name: "PnL" });
    await expect(region).toHaveAttribute("tabindex", "0");
    const label = canvas.getByRole("rowheader", { name: "Net Interest Income" });
    const before = label.getBoundingClientRect().left;
    region.scrollLeft = 240;
    await waitFor(() => expect(region.scrollLeft).toBeGreaterThan(0));
    await expect(label.getBoundingClientRect().left).toBe(before);
    // A long label wraps rather than squeezing the figures.
    await expect(canvas.getByRole("rowheader", { name: "Other Non-Interest Income Total" }).getBoundingClientRect().width).toBeGreaterThanOrEqual(220);
    region.scrollLeft = 0;
  },
};

/** A game that knows which way is good for a line can say so: green where it went well, red where it didn't. Banking's lines don't say, so its changes stay gray. */
export const ChangeTones: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <StatementTable
        label="Business Performance"
        columns={["Round 1", "Round 2"]}
        changeHeader="YoY Change"
        rows={[
          { id: "share", label: "Market Share", values: ["50.00%", "45.34%"], change: "(-9.3%)", changeTone: "negative" },
          { id: "accounts", label: "Total Number of Accounts", values: ["52,407,379", "57,066,472"], change: "(+8.9%)", changeTone: "positive" },
          { id: "cost", label: "Account Acquisition Cost", values: ["$116", "$116"], change: "(0.0%)" },
          { id: "revenue", label: "Total Revenue", values: ["$3,732,235,654", "$4,041,884,455"], change: "(+8.3%)", changeTone: "positive", kind: "total" },
        ]}
      />
    </div>
  ),
};

/** An admin can give a line its own colour and a firm rule under it (a cash flow config's row colour and bottom border); Figma draws neither. */
export const ConfiguredLines: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <StatementTable
        label="Cash Flow"
        columns={["Year 1", "Year 2"]}
        changeHeader="YoY Change"
        rows={[
          { id: "financing", label: "Financing Activities", kind: "section" },
          { id: "debt", label: "Debt Issuance/Repayment", values: ["2,793,000,000", "3,053,120,000"], change: "(+9.3%)" },
          { id: "equity", label: "Equity Transactions", values: ["328,130,251", "318,319,491"], change: "(-3.0%)" },
          { id: "dividend", label: "Dividend Paid", values: ["54,688,382", "53,053,255"], change: "(-3.0%)", ruleBelow: true },
          { id: "net", label: "Net Cash Flow", values: ["3,175,818,633", "3,424,492,746"], change: "(+7.8%)", kind: "total", color: tokens.color.warning.soft },
        ]}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(background(canvas.getByRole("rowheader", { name: "Net Cash Flow" }))).toEqual(channels(tokens.color.warning.soft));
    await expect(parseFloat(getComputedStyle(canvas.getByRole("rowheader", { name: "Dividend Paid" })).borderBottomWidth)).toBe(2);
  },
};

/** A level with nothing to report says so, in place of the table. */
export const Empty: Story = {
  render: () => (
    <div className="w-full max-w-4xl">
      <StatementTable label="Business Performance" columns={["Round 1"]} changeHeader="YoY Change" rows={[]} empty="No performance data available for this level." />
    </div>
  ),
};
