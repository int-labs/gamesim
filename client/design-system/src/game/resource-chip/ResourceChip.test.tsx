import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberFormatProvider } from "../../foundations/format/NumberFormatProvider";
import { ResourceChip, ResourceChips } from "./ResourceChip";

describe("ResourceChip", () => {
  it("writes a cost compact in the app's currency, and reads it whole", () => {
    render(<ResourceChip kind="cost" value={250_000_000} />);
    expect(screen.getByText("Cost: $250M")).toBeInTheDocument();
    // Seen: the amount after the currency's icon.
    expect(screen.getByText("250M")).toBeInTheDocument();
  });

  it("keeps a cost's decimals, as today's cost digits", () => {
    render(<ResourceChip kind="cost" value={1_500_000} decimals={1} />);
    expect(screen.getByText("Cost: $1.5M")).toBeInTheDocument();
  });

  it("shows another currency's own symbol", () => {
    render(
      <NumberFormatProvider currency="THB">
        <ResourceChip kind="cost" value={12_000_000} />
      </NumberFormatProvider>,
    );
    expect(screen.getByText("Cost: ฿12M")).toBeInTheDocument();
    expect(screen.getByText("฿")).toBeInTheDocument();
  });

  it("writes an energy and a level as whole numbers, a level's change signed", () => {
    render(
      <ResourceChips>
        <ResourceChip kind="energy" value={20} />
        <ResourceChip kind="level" value={18} change={-1} />
      </ResourceChips>,
    );
    expect(screen.getByText("Energy: 20")).toBeInTheDocument();
    expect(screen.getByText("Level: 18 (-1)")).toBeInTheDocument();
  });

  it("explains itself while the pointer rests on it", async () => {
    const user = userEvent.setup();
    render(<ResourceChip kind="energy" value={20} />);
    await user.hover(screen.getByText("Energy: 20"));
    expect(await screen.findByText(/Effort or resources needed to implement an action\./, { selector: "[data-open]" })).toBeInTheDocument();
  });

  it("takes its words", () => {
    render(<ResourceChip kind="energy" value={4} messages={{ name: { cost: "Biaya", energy: "Energi", level: "Level" } }} />);
    expect(screen.getByText("Energi: 4")).toBeInTheDocument();
  });

  it("is a plain pill beside a menu's option: the same words, no tooltip", async () => {
    const user = userEvent.setup();
    render(<ResourceChip kind="energy" value={8} size="sm" />);
    expect(screen.getByText("Energy: 8")).toBeInTheDocument();
    await user.hover(screen.getByText("Energy: 8"));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.queryByText(/Effort or resources needed/)).not.toBeInTheDocument();
  });
});
