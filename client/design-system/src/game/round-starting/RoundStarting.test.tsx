import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RoundStarting } from "./RoundStarting";

describe("RoundStarting", () => {
  it("covers the screen with its words, named by them, the drawing left to the eye", async () => {
    render(<RoundStarting open title="New round is starting!" illustration={<svg data-testid="drawing" />} />);
    const cover = await screen.findByRole("dialog", { name: "New round is starting!" });
    expect(cover).toHaveClass("fixed", "inset-0", "bg-surface-page");
    expect(screen.getByRole("heading", { name: "New round is starting!" })).toHaveClass("type-interstitial");
    expect(screen.getByTestId("drawing").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("stays until the game takes it away, whatever is pressed", async () => {
    const { rerender } = render(<RoundStarting open title="New round is starting!" />);
    await screen.findByRole("dialog", { name: "New round is starting!" });
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.body);
    expect(screen.getByRole("dialog", { name: "New round is starting!" })).toBeInTheDocument();
    rerender(<RoundStarting open={false} title="New round is starting!" />);
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows Figma's drawing unless the game brings its own", async () => {
    render(<RoundStarting open title="New round is starting!" />);
    const cover = await screen.findByRole("dialog", { name: "New round is starting!" });
    const drawing = cover.querySelector("svg");
    expect(drawing).not.toBeNull();
    expect(drawing?.querySelectorAll("path").length).toBeGreaterThan(20);
    expect(drawing?.querySelector("path")).toHaveClass("fill-(--round-starting-accent)");
  });

  it("draws nothing while closed", () => {
    render(<RoundStarting open={false} title="New round is starting!" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
