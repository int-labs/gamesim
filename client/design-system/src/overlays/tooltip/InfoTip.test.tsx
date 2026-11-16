import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoTip } from "./InfoTip";

const TEXT = "Customer Satisfaction score (CSAT) across the company";
/** The bubble on screen: it carries data-open while it shows. */
const shown = () => screen.queryByText(TEXT, { selector: "[data-open]" });

function Kpi() {
  return (
    <>
      <span>CSAT</span>
      <InfoTip label="About CSAT">{TEXT}</InfoTip>
      <button type="button">Elsewhere</button>
    </>
  );
}

describe("InfoTip", () => {
  it("is a button named by its label and described by its explanation", () => {
    render(<Kpi />);
    expect(screen.getByRole("button", { name: "About CSAT" })).toHaveAccessibleDescription(TEXT);
  });

  it("shows while the pointer rests on it", async () => {
    const user = userEvent.setup();
    render(<Kpi />);
    const button = screen.getByRole("button", { name: "About CSAT" });
    await user.hover(button);
    expect(await screen.findByText(TEXT, { selector: "[data-open]" })).toBeInTheDocument();
    await user.unhover(button);
    await waitFor(() => expect(shown()).not.toBeInTheDocument());
  });

  it("stays open after a press, keeping focus on the button, until Escape", async () => {
    const user = userEvent.setup();
    render(<Kpi />);
    const button = screen.getByRole("button", { name: "About CSAT" });
    await user.click(button);
    const bubble = await screen.findByText(TEXT, { selector: "[data-open]" });
    // Read through the button, so hidden from screen readers.
    expect(bubble).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveFocus();
    await user.unhover(button);
    expect(shown()).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(shown()).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it("closes on a press elsewhere, and on a second press", async () => {
    const user = userEvent.setup();
    render(<Kpi />);
    const button = screen.getByRole("button", { name: "About CSAT" });
    await user.click(button);
    await screen.findByText(TEXT, { selector: "[data-open]" });
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    await waitFor(() => expect(shown()).not.toBeInTheDocument());
    await user.click(button);
    await screen.findByText(TEXT, { selector: "[data-open]" });
    await user.click(button);
    await waitFor(() => expect(shown()).not.toBeInTheDocument());
  });
});
