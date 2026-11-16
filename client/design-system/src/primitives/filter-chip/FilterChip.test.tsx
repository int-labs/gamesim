import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FilterChip } from "./FilterChip";

describe("FilterChip", () => {
  it("is a button that says it removes the filter it shows, and removes it", async () => {
    const remove = vi.fn();
    render(<FilterChip onRemove={remove}>Simulation Status - Active</FilterChip>);
    const chip = screen.getByRole("button", { name: "Remove Simulation Status - Active" });
    expect(chip).toHaveAttribute("type", "button");
    await userEvent.click(chip);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("takes the removal words in another language", () => {
    render(
      <FilterChip onRemove={() => {}} removeLabel="Hapus">
        Status - Aktif
      </FilterChip>,
    );
    expect(screen.getByRole("button", { name: "Hapus Status - Aktif" })).toBeInTheDocument();
  });
});
