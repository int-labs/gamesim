import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { Button } from "../../primitives/button/Button";
import { Menu, MenuCheckboxItem, MenuItem, MenuLinkItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuSubmenu } from "./Menu";

type Direction = "ascending" | "descending";

function SortMenu({ onSort }: { onSort: (column: string, direction: Direction) => void }) {
  const [sort, setSort] = useState<{ column: string; direction: Direction }>({ column: "created", direction: "descending" });
  const choose = (column: string) => (direction: Direction) => {
    setSort({ column, direction });
    onSort(column, direction);
  };
  return (
    <Menu trigger={<Button variant="secondary">Sort</Button>}>
      <MenuSubmenu label="Simulation Name">
        <MenuRadioGroup value={sort.column === "name" ? sort.direction : null} onValueChange={choose("name")}>
          <MenuRadioItem value="ascending">A → Z</MenuRadioItem>
          <MenuRadioItem value="descending">Z → A</MenuRadioItem>
        </MenuRadioGroup>
      </MenuSubmenu>
      <MenuSubmenu label="Date Created">
        <MenuRadioGroup value={sort.column === "created" ? sort.direction : null} onValueChange={choose("created")}>
          <MenuRadioItem value="descending">Newest first</MenuRadioItem>
          <MenuRadioItem value="ascending">Oldest first</MenuRadioItem>
        </MenuRadioGroup>
      </MenuSubmenu>
    </Menu>
  );
}

describe("Menu", () => {
  it("opens from its button, runs an action and closes, handing focus back to the button", async () => {
    const suspend = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu trigger={<Button variant="secondary">Actions</Button>}>
        <MenuItem onClick={suspend}>Suspend</MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger">Revoke</MenuItem>
      </Menu>,
    );
    const button = screen.getByRole("button", { name: "Actions" });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    await user.click(button);
    const menu = await screen.findByRole("menu");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Suspend", "Revoke"]);
    await user.click(within(menu).getByRole("menuitem", { name: "Suspend" }));
    expect(suspend).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Menu trigger={<Button variant="secondary">Actions</Button>}>
        <MenuItem>Suspend</MenuItem>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("opens a submenu from the keyboard and marks the chosen order", async () => {
    const onSort = vi.fn();
    const user = userEvent.setup();
    render(<SortMenu onSort={onSort} />);
    screen.getByRole("button", { name: "Sort" }).focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Simulation Name", "Date Created"]);
    // Opened from the keyboard, the first row is highlighted; the arrow toward its submenu opens it.
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "Simulation Name" })).toHaveAttribute("data-highlighted"));
    await user.keyboard("{ArrowRight}");
    const orders = await screen.findByRole("menuitemradio", { name: "A → Z" });
    await user.click(orders);
    expect(onSort).toHaveBeenLastCalledWith("name", "ascending");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    // Opened again, the chosen order carries its check and the other column's is cleared.
    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(await screen.findByRole("menuitem", { name: "Simulation Name" }));
    expect(await screen.findByRole("menuitemradio", { name: "A → Z" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Z → A" })).toHaveAttribute("aria-checked", "false");
  });

  it("keeps a checkbox item's menu open while it toggles", async () => {
    const user = userEvent.setup();
    function Columns() {
      const [shown, setShown] = useState(true);
      return (
        <Menu trigger={<Button variant="secondary">Columns</Button>}>
          <MenuCheckboxItem checked={shown} onCheckedChange={setShown}>
            Total Team
          </MenuCheckboxItem>
        </Menu>
      );
    }
    render(<Columns />);
    await user.click(screen.getByRole("button", { name: "Columns" }));
    const option = await screen.findByRole("menuitemcheckbox", { name: "Total Team" });
    expect(option).toHaveAttribute("aria-checked", "true");
    await user.click(option);
    expect(screen.getByRole("menuitemcheckbox", { name: "Total Team" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("jumps to an item by its label when its text is drawn with symbols", async () => {
    const user = userEvent.setup();
    render(
      <Menu trigger={<Button variant="secondary">Sort</Button>}>
        <MenuRadioGroup value={null} onValueChange={() => {}}>
          <MenuRadioItem value="ascending" label="A to Z">
            <span aria-hidden>A → Z</span>
            <span className="sr-only">A to Z</span>
          </MenuRadioItem>
          <MenuRadioItem value="descending" label="Z to A">
            <span aria-hidden>Z → A</span>
            <span className="sr-only">Z to A</span>
          </MenuRadioItem>
        </MenuRadioGroup>
      </Menu>,
    );
    screen.getByRole("button", { name: "Sort" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("z");
    await waitFor(() => expect(screen.getByRole("menuitemradio", { name: "Z to A" })).toHaveAttribute("data-highlighted"));
  });

  it("goes to a page through a real link", async () => {
    const user = userEvent.setup();
    render(
      <Menu trigger={<Button variant="secondary">Account</Button>}>
        <MenuLinkItem href="/people/42">Open profile</MenuLinkItem>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Account" }));
    const link = await screen.findByRole("menuitem", { name: "Open profile" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/people/42");
  });
});
