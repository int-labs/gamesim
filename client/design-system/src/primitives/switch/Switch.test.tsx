import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("is a switch named by its label, flipped by itself, its words or the keyboard", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    function Row() {
      const [hide, setHide] = useState(false);
      return (
        <Switch
          label="Hide unselected segments and products"
          labelPosition="start"
          checked={hide}
          onCheckedChange={(next) => {
            setHide(next);
            onCheckedChange(next);
          }}
        />
      );
    }
    render(<Row />);
    const control = screen.getByRole("switch", { name: "Hide unselected segments and products" });
    expect(control).toHaveAttribute("aria-checked", "false");
    await user.click(control);
    expect(control).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByText("Hide unselected segments and products"));
    expect(control).toHaveAttribute("aria-checked", "false");
    await user.keyboard(" ");
    expect(control).toHaveFocus();
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it("reads the line under its label as the description, not as part of its name", () => {
    render(<Switch label="Reduce effects" description="Fewer animations and no confetti." />);
    const control = screen.getByRole("switch", { name: "Reduce effects" });
    expect(control).toHaveAccessibleDescription("Fewer animations and no confetti.");
  });

  it("takes an aria-label when it has no visible label", () => {
    render(<Switch aria-label="Show passkeys" />);
    expect(screen.getByRole("switch", { name: "Show passkeys" })).toBeInTheDocument();
  });

  it("does not flip when disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Hide unselected segments and products" disabled onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch", { name: "Hide unselected segments and products" });
    await user.click(control);
    await user.click(screen.getByText("Hide unselected segments and products"));
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("sends its value with a form when on", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Settings">
        <Switch label="Hide unselected segments and products" name="hideUnselected" />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "Settings" });
    expect(new FormData(form).get("hideUnselected")).toBeNull();
    await user.click(screen.getByRole("switch"));
    expect(new FormData(form).get("hideUnselected")).toBe("on");
  });
});
