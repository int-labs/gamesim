import { render, screen, within } from "@testing-library/react";
import { StatementTable, type StatementRow } from "./StatementTable";

const rows: StatementRow[] = [
  { id: "interest-income", label: "Interest Income", values: ["$5,540,791,948", "$5,115,259,024"], change: "(-7.7%)" },
  { id: "net-interest-income", label: "Net Interest Income", values: ["$2,770,395,974", "$2,557,629,512"], change: "(-7.7%)", kind: "total" },
  { id: "operating-expense", label: "Operating Expense" },
  { id: "salary", label: "Salary", values: ["$110,000,000", "$110,000,000"], change: "(0.0%)", indent: 1 },
  { id: "provisions", label: "Provisions", values: ["$0", null], change: "N/A", gapBefore: true },
];

/** The row at an index among those assistive technology reads: the header row is 0. */
function rowAt(index: number) {
  const row = screen.getAllByRole("row")[index];
  if (!row) throw new Error(`no row ${index}`);
  return row;
}

describe("StatementTable", () => {
  it("is a table named for assistive technology: a header row, then a line per row headed by its label", () => {
    render(<StatementTable label="PnL" columns={["Year 1", "Year 2"]} changeHeader="YoY Change" rows={rows} />);
    const table = screen.getByRole("table", { name: "PnL" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Line item", "Year 1", "Year 2", "YoY Change"]);
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual([
      "Interest Income",
      "Net Interest Income",
      "Operating Expense",
      "Salary",
      "Provisions",
    ]);
    expect(within(rowAt(1)).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["$5,540,791,948", "$5,115,259,024", "(-7.7%)"]);
  });

  it("keeps the labels' header for screen readers only, unless it is given words", () => {
    const { rerender } = render(<StatementTable label="Balance Sheet" columns={["Year 1"]} rows={rows} />);
    expect(screen.getByText("Line item")).toHaveClass("sr-only");
    rerender(<StatementTable label="Balance Sheet" columns={["Year 1"]} labelHeader="KEY INDICATORS" rows={rows} />);
    expect(screen.getByRole("columnheader", { name: "KEY INDICATORS" })).toBeInTheDocument();
    expect(screen.queryByText("Line item")).not.toBeInTheDocument();
  });

  it("has no change column without its header", () => {
    render(<StatementTable label="Balance Sheet" columns={["Year 1", "Year 2"]} rows={rows} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.queryByText("(-7.7%)")).not.toBeInTheDocument();
  });

  it("sets a total and a section in SemiBold on slate, and a line in Regular on white", () => {
    render(
      <StatementTable
        label="Balance Sheet"
        columns={["Year 1"]}
        rows={[
          { id: "assets", label: "Assets", kind: "section" },
          { id: "cash", label: "Cash", values: ["849,275,106,254"] },
          { id: "total", label: "Total Assets", values: ["1,635,092,016,090"], kind: "total" },
        ]}
      />,
    );
    for (const name of ["Assets", "Total Assets"]) {
      expect(screen.getByRole("rowheader", { name })).toHaveClass("bg-surface-panel", "font-semibold");
    }
    expect(screen.getByRole("cell", { name: "1,635,092,016,090" })).toHaveClass("bg-surface-panel", "font-semibold");
    expect(screen.getByRole("rowheader", { name: "Cash" })).toHaveClass("bg-surface-card", "font-normal");
  });

  it("sets a line under a parent further in and in italic, one step per level", () => {
    render(
      <StatementTable
        label="PnL"
        columns={["Year 1"]}
        rows={[
          { id: "parent", label: "Operating Expense" },
          { id: "child", label: "Salary", indent: 1 },
          { id: "grandchild", label: "Bonus", indent: 2 },
          { id: "note", label: "Memo", italic: true },
        ]}
      />,
    );
    const parent = screen.getByRole("rowheader", { name: "Operating Expense" });
    expect(parent).not.toHaveClass("italic");
    expect(parent.style.getPropertyValue("--statement-level")).toBe("");
    expect(screen.getByRole("rowheader", { name: "Salary" })).toHaveClass("italic", "statement-indent");
    expect(screen.getByRole("rowheader", { name: "Salary" }).style.getPropertyValue("--statement-level")).toBe("1");
    expect(screen.getByRole("rowheader", { name: "Bonus" }).style.getPropertyValue("--statement-level")).toBe("2");
    expect(screen.getByRole("rowheader", { name: "Memo" })).toHaveClass("italic");
  });

  it("keeps a total or a heading upright when it is set in", () => {
    render(
      <StatementTable
        label="Cash Flow"
        columns={["Year 1"]}
        rows={[
          { id: "net", label: "Net Cash from Operations", values: ["1,000"], kind: "total", indent: 1 },
          { id: "group", label: "Operating Activities", kind: "section", indent: 1 },
        ]}
      />,
    );
    for (const name of ["Net Cash from Operations", "Operating Activities"]) {
      const label = screen.getByRole("rowheader", { name });
      expect(label).not.toHaveClass("italic");
      expect(label.style.getPropertyValue("--statement-level")).toBe("1");
    }
  });

  it("parts the groups with a band that assistive technology skips", () => {
    const { container } = render(<StatementTable label="PnL" columns={["Year 1", "Year 2"]} changeHeader="YoY Change" rows={rows} />);
    const band = container.querySelector('tr[aria-hidden="true"]');
    expect(band).not.toBeNull();
    expect(band?.nextElementSibling).toHaveTextContent("Provisions");
    expect(band?.querySelector("td")).toHaveAttribute("colspan", "4");
    // The header row and the five lines; the band is not one of them.
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("shows a figure the game doesn't have as N/A in gray, and leaves a heading's cells empty", () => {
    render(
      <StatementTable label="PnL" columns={["Year 1", "Year 2"]} changeHeader="YoY Change" rows={rows} messages={{ noValue: "Belum ada" }} />,
    );
    expect(within(rowAt(5)).getByText("Belum ada")).toHaveClass("text-fg-subtle");
    // Operating Expense, the parent line.
    expect(within(rowAt(3)).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["", "", ""]);
  });

  it("keeps the change gray unless the game says which way the line reads", () => {
    render(
      <StatementTable
        label="Business Performance"
        columns={["Round 1", "Round 2"]}
        changeHeader="YoY Change"
        rows={[
          { id: "accounts", label: "Total Number of Accounts", values: ["1", "2"], change: "(+100.0%)" },
          { id: "revenue", label: "Total Revenue", values: ["1", "2"], change: "(+100.0%)", kind: "total" },
          { id: "share", label: "Market Share", values: ["1", "2"], change: "(+100.0%)", changeTone: "positive" },
          { id: "npl", label: "Non Performing Loan", values: ["1", "2"], change: "(+100.0%)", changeTone: "negative" },
        ]}
      />,
    );
    const changeOf = (index: number) => within(rowAt(index)).getAllByRole("cell")[2];
    expect(changeOf(1)).toHaveClass("text-fg-subtle");
    // Gray 500 is under 4.5:1 on a total's slate: gray 600 there.
    expect(changeOf(2)).toHaveClass("text-fg-muted");
    expect(changeOf(3)).toHaveClass("text-fg-success");
    expect(changeOf(4)).toHaveClass("text-fg-danger");
  });

  it("takes a config's own colour for a line, in every cell, and a firm rule under it", () => {
    render(
      <StatementTable
        label="Cash Flow"
        columns={["Year 1"]}
        changeHeader="YoY Change"
        rows={[
          { id: "net", label: "Net Cash Flow", values: ["1,000"], change: "(+5.0%)", color: "#fef3c7", ruleBelow: true, indent: 1 },
          { id: "plain", label: "Dividend Paid", values: ["54,688,382"], change: "(-3.0%)" },
        ]}
      />,
    );
    const cells = [screen.getByRole("rowheader", { name: "Net Cash Flow" }), ...within(rowAt(1)).getAllByRole("cell")];
    for (const cell of cells) {
      expect(cell.style.backgroundColor).toBe("rgb(254, 243, 199)");
      expect(cell).toHaveClass("border-b-2", "border-b-fg-primary");
    }
    // The colour sits beside the indent, not in place of it.
    expect(cells[0]?.style.getPropertyValue("--statement-level")).toBe("1");
    expect(screen.getByRole("rowheader", { name: "Dividend Paid" }).style.backgroundColor).toBe("");
    expect(screen.getByRole("rowheader", { name: "Dividend Paid" })).not.toHaveClass("border-b-2");
  });

  it("says why there is nothing to show, in place of the table, when it has no lines", () => {
    const { rerender } = render(
      <StatementTable label="Business Performance" columns={["Round 1"]} rows={[]} empty="No performance data available for this level." />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No performance data available for this level.")).toBeInTheDocument();
    // Without a message, the header stands alone, as today's statements do.
    rerender(<StatementTable label="Business Performance" columns={["Round 1"]} rows={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
