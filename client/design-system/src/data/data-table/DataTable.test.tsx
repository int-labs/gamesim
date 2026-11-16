import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DataTable, type DataTableColumn, type DataTableSort } from "./DataTable";

interface Simulation {
  id: string;
  name: string;
  rounds: number;
}

const rows: Simulation[] = [
  { id: "s1", name: "Veritas Capital Market Drill", rounds: 2 },
  { id: "s2", name: "Stratos Finance Innovation Sprint", rounds: 5 },
];

const columns: DataTableColumn<Simulation>[] = [
  { id: "name", header: "Simulation Name", cell: (row) => row.name, sortable: true },
  { id: "rounds", header: "Rounds", cell: (row) => `${row.rounds} / 5`, align: "end", sortable: true },
];

describe("DataTable", () => {
  it("is a table named for assistive technology, with a header row and one row per item", () => {
    render(<DataTable label="Simulations" columns={columns} rows={rows} rowKey={(row) => row.id} />);
    const table = screen.getByRole("table", { name: "Simulations" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Simulation Name", "Rounds"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByRole("cell", { name: "2 / 5" })).toBeInTheDocument();
  });

  it("asks for an order and shows the one it is given, without sorting itself", async () => {
    const onSortChange = vi.fn();
    const sort: DataTableSort = { column: "name", direction: "ascending" };
    const { rerender } = render(
      <DataTable label="Simulations" columns={columns} rows={rows} rowKey={(row) => row.id} sort={sort} onSortChange={onSortChange} />,
    );
    const name = screen.getByRole("columnheader", { name: "Simulation Name" });
    expect(name).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Rounds" })).toHaveAttribute("aria-sort", "none");
    await userEvent.click(within(name).getByRole("button"));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "descending" });
    await userEvent.click(screen.getByRole("button", { name: "Rounds" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "rounds", direction: "ascending" });
    // The rows keep the order they were given.
    rerender(
      <DataTable
        label="Simulations"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={{ column: "rounds", direction: "descending" }}
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Veritas Capital Market Drill");
  });

  it("opens a row through a real link that the keyboard reaches, and by a click anywhere on the row", async () => {
    const opened = vi.fn();
    render(
      <DataTable
        label="Simulations"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        rowLink={(row) => (
          <a
            href={`#/simulations/${row.id}`}
            onClick={(event) => {
              event.preventDefault();
              opened(row.id);
            }}
          />
        )}
      />,
    );
    const link = screen.getByRole("link", { name: "Open Veritas Capital Market Drill" });
    await userEvent.tab();
    expect(link).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(opened).toHaveBeenLastCalledWith("s1");
    await userEvent.click(screen.getByRole("cell", { name: "Stratos Finance Innovation Sprint" }));
    expect(opened).toHaveBeenLastCalledWith("s2");
  });

  it("opens a row in a new tab for Cmd, Ctrl or the middle button, and not when the click ends a text selection", async () => {
    const opened = vi.fn();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(
      <DataTable
        label="Simulations"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        rowHref={(row) => `/simulations/${row.id}`}
      />,
    );
    const link = screen.getByRole("link", { name: "Open Veritas Capital Market Drill" });
    link.addEventListener("click", (event) => {
      event.preventDefault();
      opened();
    });
    const cell = screen.getByRole("cell", { name: "Veritas Capital Market Drill" });
    await user.keyboard("[MetaLeft>]");
    await user.click(cell);
    await user.keyboard("[/MetaLeft]");
    expect(open).toHaveBeenLastCalledWith((link as HTMLAnchorElement).href, "_blank", "noopener");
    await user.keyboard("[ControlLeft>]");
    await user.click(cell);
    await user.keyboard("[/ControlLeft]");
    expect(open).toHaveBeenCalledTimes(2);
    fireEvent(cell, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(open).toHaveBeenCalledTimes(3);
    // The right button keeps its menu.
    fireEvent(cell, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
    expect(open).toHaveBeenCalledTimes(3);
    expect(opened).not.toHaveBeenCalled();
    // Selecting a name to copy it leaves the row where it is.
    const range = document.createRange();
    range.selectNodeContents(cell);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.click(cell);
    expect(opened).not.toHaveBeenCalled();
    window.getSelection()?.removeAllRanges();
    // A plain click follows the link in the same tab.
    await user.click(cell);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(3);
    open.mockRestore();
  });

  it("selects rows, and all rows on the page, from outside", async () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <DataTable
        label="People"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        selectedKeys={new Set(["s1"])}
        onSelectionChange={onSelectionChange}
      />,
    );
    const all = screen.getByRole("checkbox", { name: "Select all rows on this page" });
    expect(all).toHaveAttribute("aria-checked", "mixed");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Stratos Finance Innovation Sprint" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["s1", "s2"]));
    rerender(
      <DataTable
        label="People"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        selectedKeys={new Set(["s1", "s2", "elsewhere"])}
        onSelectionChange={onSelectionChange}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Select all rows on this page" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    // Clearing the page keeps the selection made on other pages.
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["elsewhere"]));
  });

  it("shows skeleton rows while loading, says so, and marks the table busy", () => {
    render(<DataTable label="Audit" columns={columns} rows={[]} rowKey={(row) => row.id} loading loadingRows={3} />);
    const table = screen.getByRole("table", { name: "Audit" });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("shows the empty state across the whole body", () => {
    render(<DataTable label="Grants" columns={columns} rows={[]} rowKey={(row) => row.id} empty={<p>No grants yet</p>} />);
    const cell = screen.getByRole("cell", { name: "No grants yet" });
    expect(cell).toHaveAttribute("colspan", "2");
  });
});
