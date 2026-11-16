import { render, screen } from "@testing-library/react";
import { Sidebar } from "../../layout/sidebar/Sidebar";
import { RoundChip } from "./RoundChip";

describe("RoundChip", () => {
  it("names the round the simulation is on", () => {
    render(<RoundChip round={2} />);
    expect(screen.getByText("Round: 2")).toBeInTheDocument();
  });

  it("says it in the app's language", () => {
    render(<RoundChip round={1} label="Rondă" />);
    expect(screen.getByText("Rondă: 1")).toBeInTheDocument();
  });

  it("shows the number alone on the collapsed rail, the whole name to screen readers", () => {
    render(
      <Sidebar collapsed>
        <RoundChip round={3} />
      </Sidebar>,
    );
    expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Round: 3")).toHaveClass("sr-only");
  });
});
