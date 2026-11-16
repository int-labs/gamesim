import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("is a named checkbox that reports its new state", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Select Team Alpha" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole("checkbox", { name: "Select Team Alpha" });
    expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(box).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard(" ");
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("shows a partial selection", () => {
    render(<Checkbox aria-label="Select all rows on this page" indeterminate />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  });
});
