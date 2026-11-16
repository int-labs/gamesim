import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { Combobox, type ComboboxOption, type ComboboxProps } from "./Combobox";

const people: ComboboxOption[] = [
  { value: "p1", label: "Herdy Santoso", description: "herdy_intlabs@gmail.com" },
  { value: "p2", label: "Ayu Lestari", description: "ayu@example.com" },
  { value: "p3", label: "José Ramírez", description: "jose@example.com" },
];

function PersonField({ onChange, ...props }: Partial<ComboboxProps> & { onChange?: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(props.value ?? null);
  return (
    <Combobox
      label="Person"
      placeholder="Search by name or email"
      options={people}
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const optionNames = () => within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent);

describe("Combobox", () => {
  it("is named by its label, narrows as one types, and chooses with Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PersonField onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Person" });
    await user.click(input);
    expect(optionNames()).toEqual(["Herdy Santosoherdy_intlabs@gmail.com", "Ayu Lestariayu@example.com", "José Ramírezjose@example.com"]);
    await user.type(input, "ayu");
    expect(optionNames()).toEqual(["Ayu Lestariayu@example.com"]);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("p2");
    await waitFor(() => expect(input).toHaveValue("Ayu Lestari"));
  });

  it("finds an option by its second line, ignoring case and accents", async () => {
    const user = userEvent.setup();
    render(<PersonField />);
    const input = screen.getByRole("combobox", { name: "Person" });
    await user.type(input, "HERDY_INTLABS");
    expect(optionNames()).toEqual(["Herdy Santosoherdy_intlabs@gmail.com"]);
    await user.clear(input);
    await user.type(input, "ramirez");
    expect(optionNames()).toEqual(["José Ramírezjose@example.com"]);
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<PersonField />);
    await user.type(screen.getByRole("combobox", { name: "Person" }), "zzz");
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("lists at most its limit and says how many more match", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 120 }, (_, index) => ({ value: `s${index}`, label: `Simulation ${index + 1}` }));
    render(<PersonField options={many} />);
    await user.click(screen.getByRole("combobox", { name: "Person" }));
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(50);
    expect(screen.getByText("70 more: keep typing to narrow the list")).toBeInTheDocument();
    await user.type(screen.getByRole("combobox", { name: "Person" }), "Simulation 11");
    // 11 and 110 to 119.
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(11);
    expect(screen.queryByText(/more: keep typing/)).not.toBeInTheDocument();
  });

  it("leaves the search to the app when asked, and says it is searching", async () => {
    const onInput = vi.fn();
    const user = userEvent.setup();
    render(<PersonField filter={false} onInputChange={onInput} loading options={[]} />);
    await user.type(screen.getByRole("combobox", { name: "Person" }), "ay");
    expect(onInput).toHaveBeenLastCalledWith("ay");
    expect(await screen.findByText("Searching")).toBeInTheDocument();
    expect(screen.queryByText("No matches")).not.toBeInTheDocument();
  });

  it("shows every option again once one is chosen, and empties with the clear button", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PersonField value="p1" onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Person" });
    expect(input).toHaveValue("Herdy Santoso");
    await user.click(input);
    expect(optionNames()).toHaveLength(3);
    expect(screen.getByRole("option", { name: /Herdy Santoso/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("reads its help and error with it, and sends its value with a form", () => {
    const { container } = render(<PersonField value="p2" name="personId" description="The person the grant is for." error="Choose a person" />);
    const input = screen.getByRole("combobox", { name: "Person" });
    expect(input).toHaveAccessibleDescription("The person the grant is for. Choose a person");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(container.querySelector('input[name="personId"]')).toHaveValue("p2");
  });
});
