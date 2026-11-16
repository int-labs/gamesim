import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { InitiativeHistory, InitiativeTable, type InitiativeRow } from "./InitiativeTable";

const LIMIT = 2;
const OPTIONS: InitiativeRow[] = [
  { key: "rotation", name: "Bank-Wide Job Rotation Program", description: "Build cross-functional knowledge.", cost: 9_000_000, energy: 45 },
  { key: "ideas", name: "Culture of Innovation Challenge", description: "Crowdsource new ideas.", cost: 6_000_000, energy: 30 },
  { key: "risk", name: "Enterprise Risk Management Overhaul", description: "Modern risk governance.", cost: 22_000_000, energy: 80 },
  { key: "cyber", name: "Cybersecurity Uplift Program", description: "Protect the bank.", cost: 12_000_000, energy: 50 },
];

/** A page that keeps the choices and applies the limit, as today's initiative pages do. */
function Initiatives({ before = [], disabled = false, onRefused }: { before?: string[]; disabled?: boolean; onRefused?: (row: InitiativeRow) => void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const rows = OPTIONS.map((option): InitiativeRow => {
    if (before.includes(option.key)) return { ...option, state: "before" };
    if (chosen.includes(option.key)) return { ...option, state: "chosen" };
    if (chosen.length >= LIMIT) return { ...option, state: "unavailable", reason: `You can select up to ${LIMIT} initiatives.` };
    return option;
  });
  return (
    <InitiativeTable
      aria-label="Select your Initiatives"
      rows={rows}
      disabled={disabled}
      onRefused={onRefused}
      onToggle={(key, on) => setChosen(on ? [...chosen, key] : chosen.filter((entry) => entry !== key))}
    />
  );
}

describe("InitiativeTable", () => {
  it("names each box by its initiative, and chooses it from the box or anywhere on its row", async () => {
    const user = userEvent.setup();
    render(<Initiatives />);
    expect(screen.getByRole("table", { name: "Select your Initiatives" })).toBeInTheDocument();
    const rotation = screen.getByRole("checkbox", { name: "Bank-Wide Job Rotation Program" });
    await user.click(rotation);
    expect(rotation).toBeChecked();
    await user.click(screen.getByText("Crowdsource new ideas."));
    expect(screen.getByRole("checkbox", { name: "Culture of Innovation Challenge" })).toBeChecked();
    await user.click(screen.getByText("Crowdsource new ideas."));
    expect(screen.getByRole("checkbox", { name: "Culture of Innovation Challenge" })).not.toBeChecked();
  });

  it("marks a chosen row, and fixes the rest at the limit with the reason", async () => {
    const user = userEvent.setup();
    const onRefused = vi.fn();
    render(<Initiatives onRefused={onRefused} />);
    await user.click(screen.getByRole("checkbox", { name: "Bank-Wide Job Rotation Program" }));
    await user.click(screen.getByRole("checkbox", { name: "Culture of Innovation Challenge" }));
    const rotation = screen.getByRole("checkbox", { name: "Bank-Wide Job Rotation Program" });
    expect(rotation.closest("tr")).toHaveAttribute("data-chosen");
    const risk = screen.getByRole("checkbox", { name: "Enterprise Risk Management Overhaul" });
    expect(risk).toHaveAttribute("data-disabled");
    expect(risk).toHaveAccessibleDescription("You can select up to 2 initiatives.");
    await user.click(screen.getByText("Modern risk governance."));
    expect(onRefused).toHaveBeenCalledWith(expect.objectContaining({ key: "risk", state: "unavailable" }));
    expect(risk).not.toBeChecked();
  });

  it("shows an initiative chosen in an earlier round checked, dimmed and fixed", () => {
    render(<Initiatives before={["cyber"]} />);
    const cyber = screen.getByRole("checkbox", { name: "Cybersecurity Uplift Program" });
    expect(cyber).toBeChecked();
    expect(cyber).toHaveAttribute("data-disabled");
    expect(cyber).toHaveAccessibleDescription("Chosen in an earlier round.");
    expect(cyber.closest("tr")).toHaveAttribute("data-locked");
  });

  it("answers no press once the round's decisions are locked", async () => {
    const user = userEvent.setup();
    const onRefused = vi.fn();
    render(<Initiatives disabled onRefused={onRefused} />);
    await user.click(screen.getByText("Build cross-functional knowledge."));
    expect(screen.getByRole("checkbox", { name: "Bank-Wide Job Rotation Program" })).not.toBeChecked();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it("lets the keyboard scroll the table when no box answers", () => {
    render(<Initiatives disabled />);
    expect(screen.getByRole("region", { name: "Select your Initiatives" })).toHaveAttribute("tabindex", "0");
  });

  it("reads each initiative's cost and energy", () => {
    render(<Initiatives />);
    const row = screen.getByRole("checkbox", { name: "Enterprise Risk Management Overhaul" }).closest("tr") as HTMLElement;
    expect(within(row).getByText("Cost: $22M")).toBeInTheDocument();
    expect(within(row).getByText("Energy: 80")).toBeInTheDocument();
  });

  it("groups initiatives under their sections' bands", () => {
    render(
      <InitiativeTable
        aria-label="Select your Initiatives"
        sections={[
          { label: "People", rows: OPTIONS.slice(0, 2) },
          { label: "Risk", rows: OPTIONS.slice(2) },
        ]}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "People" })).toHaveAttribute("colspan", "4");
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });
});

describe("InitiativeHistory", () => {
  it("lists each earlier round's initiatives", () => {
    render(
      <InitiativeHistory
        aria-label="Initiatives History"
        rounds={[
          { round: "Round 1", date: "Wed 16 Apr, 2:13 PM", initiatives: ["Branch Re-design", "Global Industry Framework"] },
          { round: "Round 2", date: "Fri 18 Apr, 12:00 PM", initiatives: [] },
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "Initiatives History" });
    const [, first, second] = within(table).getAllByRole("row");
    expect(within(first!).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Branch Re-design", "Global Industry Framework"]);
    expect(second).toHaveTextContent("No initiatives selected");
  });

  it("says so before any round has initiatives", () => {
    render(<InitiativeHistory aria-label="Initiatives History" rounds={[]} />);
    expect(screen.getByRole("cell", { name: "No initiatives history available" })).toHaveAttribute("colspan", "3");
  });
});
