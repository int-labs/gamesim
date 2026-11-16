import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Tabs, TabsPanel } from "./Tabs";

const rounds = [
  { value: "1", label: "Round-1" },
  { value: "2", label: "Round-2" },
  { value: "3", label: "Round-3", disabled: true },
];

describe("Tabs", () => {
  it("is a named tab list whose tabs show their panels", async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs label="Rounds" tabs={rounds} onValueChange={onValueChange}>
        <TabsPanel value="1">First round</TabsPanel>
        <TabsPanel value="2">Second round</TabsPanel>
      </Tabs>,
    );
    expect(screen.getByRole("tablist", { name: "Rounds" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Round-1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("First round");
    await userEvent.click(screen.getByRole("tab", { name: "Round-2" }));
    expect(onValueChange).toHaveBeenLastCalledWith("2");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Second round");
  });

  it("moves between tabs with the arrow keys, skipping a disabled one", async () => {
    render(<Tabs label="Rounds" tabs={rounds} defaultValue="2" />);
    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "Round-2" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Round-1" })).toHaveFocus();
  });
});
