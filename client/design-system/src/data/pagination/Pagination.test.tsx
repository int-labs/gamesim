import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("is a navigation landmark marking the current page, with a gap for the hidden ones", () => {
    render(<Pagination page={1} pageCount={10} onPageChange={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toHaveTextContent("Previous12310Next");
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("asks for the page chosen, the next and the previous", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={5} pageCount={10} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Page 6" }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    // The current page asks for nothing.
    onPageChange.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Page 5" }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("stops at the last page", () => {
    render(<Pagination page={10} pageCount={10} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("shows the pages alone unless given rows per page", () => {
    render(<Pagination page={1} pageCount={3} onPageChange={() => {}} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers rows per page, named by its visible label, and reports the choice", async () => {
    const onRowsPerPageChange = vi.fn();
    render(<Pagination page={1} pageCount={10} onPageChange={() => {}} rowsPerPage={10} onRowsPerPageChange={onRowsPerPageChange} />);
    const select = screen.getByRole("combobox", { name: "Rows per page:" });
    expect(select).toHaveTextContent("10");
    await userEvent.click(select);
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["10", "25", "50"]);
    await userEvent.click(screen.getByRole("option", { name: "25" }));
    expect(onRowsPerPageChange).toHaveBeenLastCalledWith(25);
  });

  it("keeps the app's own page size among the choices, in order", async () => {
    render(<Pagination page={1} pageCount={10} onPageChange={() => {}} rowsPerPage={20} rowsPerPageOptions={[10, 50]} />);
    const select = screen.getByRole("combobox", { name: "Rows per page:" });
    expect(select).toHaveTextContent("20");
    await userEvent.click(select);
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["10", "20", "50"]);
  });
});
