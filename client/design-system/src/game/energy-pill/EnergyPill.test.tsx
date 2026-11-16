import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnergyPill } from "./EnergyPill";

const MESSAGE = "Not enough energy. Adjust your decisions.";
/** The bubble beside the pill: it carries data-open while it shows. */
const bubble = () => screen.queryByText(MESSAGE, { selector: "[data-open]" });

describe("EnergyPill", () => {
  it("reads the energy left, and announces its changes", () => {
    const { rerender } = render(<EnergyPill value={100} />);
    const pill = screen.getByRole("status");
    expect(pill).toHaveTextContent("Energy: 100");
    expect(pill).not.toHaveTextContent(MESSAGE);
    rerender(<EnergyPill value={94} />);
    expect(pill).toHaveTextContent("Energy: 94");
  });

  it("says there is not enough energy while the decisions cost more than is left", () => {
    render(<EnergyPill value={-3} over />);
    expect(screen.getByRole("status")).toHaveTextContent(`Energy: -3. ${MESSAGE}`);
  });

  it("says so too while a move is refused", () => {
    const { rerender } = render(<EnergyPill value={4} />);
    rerender(<EnergyPill value={-2} refusing />);
    expect(screen.getByRole("status")).toHaveTextContent(`Energy: -2. ${MESSAGE}`);
    rerender(<EnergyPill value={4} />);
    expect(screen.getByRole("status")).toHaveTextContent("Energy: 4");
    expect(screen.getByRole("status")).not.toHaveTextContent(MESSAGE);
  });

  it("shows the message beside it under the pointer, only while there is not enough", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EnergyPill value={100} />);
    await user.hover(screen.getByRole("status"));
    expect(bubble()).not.toBeInTheDocument();
    await user.unhover(screen.getByRole("status"));
    rerender(<EnergyPill value={-3} over />);
    await user.hover(screen.getByRole("status"));
    expect(await screen.findByText(MESSAGE, { selector: "[data-open]" })).toBeInTheDocument();
    await user.unhover(screen.getByRole("status"));
    await waitFor(() => expect(bubble()).not.toBeInTheDocument());
  });

  it("takes its words", () => {
    render(<EnergyPill value={-1} over label="Energi" message="Energi tidak cukup." />);
    expect(screen.getByRole("status")).toHaveTextContent("Energi: -1. Energi tidak cukup.");
  });
});
