import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KpiBar, KpiBarActions, type KpiRow } from "./KpiBar";

const overall: KpiRow = {
  label: "Overall",
  metrics: [
    { key: "revenue", label: "Overall Revenue", value: "$12.46 Bn", change: 0.12, info: "Total Revenue across the company" },
    { key: "profit", label: "Profit", value: "$1.82 Bn", change: -0.04 },
    { key: "esat", label: "ESAT", value: "72.5%", change: 0 },
    { key: "csat", label: "CSAT", value: "81.3%", change: null },
  ],
};

const segment: KpiRow = {
  label: "Segment",
  metrics: [{ key: "revenue", label: "Segment Revenue", value: "$3.07 Bn", change: 0.31 }],
};

/** A row of the tablet and desktop bar (the folded list renders its own only while open). */
function wideRow(name: string) {
  const [row] = screen.getAllByRole("group", { name });
  if (!row) throw new Error(`No row named ${name}.`);
  return row;
}

describe("KpiBar", () => {
  it("is a region of named rows, each figure with its value and its change", () => {
    render(<KpiBar rows={[overall, segment]} />);
    expect(screen.getByRole("region", { name: "Key metrics" })).toContainElement(wideRow("Overall"));
    const row = wideRow("Overall");
    expect(row).toHaveTextContent("Overall Revenue$12.46 Bn+12%");
    expect(row).toHaveTextContent("Profit$1.82 Bn-4%");
    expect(row).toHaveTextContent("ESAT72.5%0%");
    expect(row).toHaveTextContent("CSAT81.3%N/A");
    expect(wideRow("Segment")).toHaveTextContent("Segment Revenue$3.07 Bn+31%");
  });

  it("explains a figure behind its info button, and has none without an explanation", () => {
    render(<KpiBar rows={[overall]} />);
    expect(screen.getByRole("button", { name: "About Overall Revenue" })).toHaveAccessibleDescription("Total Revenue across the company");
    expect(screen.queryByRole("button", { name: "About Profit" })).not.toBeInTheDocument();
  });

  it("folds the figures under Winning Metrics on smaller screens", async () => {
    const user = userEvent.setup();
    render(<KpiBar rows={[overall, segment]} />);
    const toggle = screen.getByRole("button", { name: "Winning Metrics" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("group", { name: "Segment" })).toHaveLength(1);
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("group", { name: "Segment" })).toHaveLength(2);
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("marks itself busy and shows pale pills while the figures load", () => {
    render(<KpiBar rows={[overall]} loading />);
    expect(screen.getByRole("region", { name: "Key metrics" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("$12.46 Bn")).not.toBeInTheDocument();
    expect(wideRow("Overall").children).toHaveLength(4);
  });

  it("takes its words from messages", async () => {
    const user = userEvent.setup();
    render(
      <KpiBar
        rows={[overall]}
        messages={{ region: "Indikator utama", winningMetrics: "Metrik kemenangan", notAvailable: "T/A", about: (label) => `Tentang ${label}` }}
      />,
    );
    expect(screen.getByRole("region", { name: "Indikator utama" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentang Overall Revenue" })).toBeInTheDocument();
    expect(wideRow("Overall")).toHaveTextContent("CSAT81.3%T/A");
    await user.click(screen.getByRole("button", { name: "Metrik kemenangan" }));
    expect(screen.getAllByRole("group", { name: "Overall" })).toHaveLength(2);
  });

  it("lines up the rows' columns: the first fills its row, except on the two-row desktop bar, where each keeps its width", () => {
    const tracks = (name: string) => {
      const style = wideRow(name).parentElement?.style;
      return [style?.getPropertyValue("--kpi-columns"), style?.getPropertyValue("--kpi-columns-xl")];
    };
    const { rerender } = render(<KpiBar rows={[overall, segment]} />);
    expect(tracks("Overall")).toEqual(["minmax(0, 1fr) repeat(3, auto)", "repeat(4, auto)"]);
    rerender(<KpiBar rows={[overall]} />);
    expect(tracks("Overall")).toEqual(["minmax(0, 1fr) repeat(3, auto)", "minmax(0, 1fr) repeat(3, auto)"]);
    rerender(<KpiBar rows={[segment]} />);
    expect(tracks("Segment")).toEqual(["minmax(0, 1fr)", "minmax(0, 1fr)"]);
    // Pale pills have no width of their own: they share the row.
    rerender(<KpiBar rows={[overall, segment]} loading />);
    expect(tracks("Overall")).toEqual(["repeat(4, minmax(0, 1fr))", "repeat(4, minmax(0, 1fr))"]);
  });

  it("puts the actions at the end of the bar", () => {
    render(<KpiBar rows={[overall]} actions={<button type="button">Submit</button>} />);
    expect(within(screen.getByRole("region", { name: "Key metrics" })).getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });
});

describe("KpiBarActions", () => {
  it("shows the energy and Submit, and two pale pills in their place while the round loads", () => {
    const actions = (loading: boolean) => (
      <div data-testid="bar">
        <KpiBarActions loading={loading}>
          <span>Energy</span>
          <button type="button">Submit</button>
        </KpiBarActions>
      </div>
    );
    const { rerender } = render(actions(false));
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    rerender(actions(true));
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByText("Energy")).not.toBeInTheDocument();
    // Two pills, hidden from assistive technology, where the energy and Submit were.
    const pills = screen.getByTestId("bar").querySelectorAll("[aria-hidden]");
    expect(pills).toHaveLength(2);
  });
});
