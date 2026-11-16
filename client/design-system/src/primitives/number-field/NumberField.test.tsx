import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { NumberFormatProvider } from "../../foundations/format/NumberFormatProvider";
import { NumberField, type NumberFieldProps } from "./NumberField";

/** A field whose committed value lives in its parent, as in the decision pages. */
function Decision({ initial = 0, onChange, ...props }: Partial<NumberFieldProps> & { initial?: number; onChange?: (value: number) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      aria-label="Marketing spend"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

function setup() {
  // Time also runs on its own, so Testing Library's findBy polling (setTimeout) is not frozen.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("NumberField", () => {
  it("groups the digits as they are typed, and keeps a value that fits at once", async () => {
    const user = setup();
    const onChange = vi.fn();
    render(<Decision decimals={0} onChange={onChange} />);
    const field = screen.getByRole("textbox", { name: "Marketing spend" });
    await user.clear(field);
    await user.type(field, "1250000");
    expect(field).toHaveValue("1,250,000");
    expect(onChange).toHaveBeenLastCalledWith(1_250_000);
  });

  it("keeps a decimal point being typed", async () => {
    const user = setup();
    render(<Decision initial={1} />);
    const field = screen.getByRole("textbox", { name: "Marketing spend" });
    await user.type(field, ".");
    expect(field).toHaveValue("1.");
    await user.type(field, "5");
    expect(field).toHaveValue("1.5");
  });

  it("refuses a value over the maximum 300 ms after the last keystroke, naming the limit", async () => {
    const user = setup();
    const onChange = vi.fn();
    const onValidationError = vi.fn();
    render(<Decision kind="currency" decimals={0} max={1000} onChange={onChange} onValidationError={onValidationError} />);
    const field = screen.getByRole("textbox", { name: "Marketing spend" });
    await user.clear(field);
    await user.type(field, "1500");
    expect(onChange).not.toHaveBeenCalledWith(1500);
    expect(screen.queryByRole("alert")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByRole("alert")).toHaveTextContent("That's above the $1,000 limit. Enter $1,000 or less.");
    expect(screen.getByText("$1,000", { selector: "strong" })).toBeInTheDocument();
    expect(onValidationError).toHaveBeenCalledWith("That's above the $1,000 limit. Enter $1,000 or less.");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("puts back the limit it broke when the player leaves, and says so", async () => {
    const user = setup();
    const onCommit = vi.fn();
    render(<Decision kind="currency" decimals={0} min={100} max={1000} initial={500} onCommit={onCommit} />);
    const field = screen.getByRole("textbox", { name: "Marketing spend" });
    await user.clear(field);
    await user.type(field, "5000");
    await user.tab();
    expect(field).toHaveValue("1,000");
    expect(onCommit).toHaveBeenLastCalledWith(1000);
    expect(await screen.findByRole("alert")).toHaveTextContent("The maximum is $1,000. Reset to $1,000.");

    await user.clear(field);
    await user.type(field, "20");
    await user.keyboard("{Enter}");
    expect(field).toHaveValue("100");
    expect(onCommit).toHaveBeenLastCalledWith(100);
    expect(screen.getByRole("alert")).toHaveTextContent("The minimum is $100. Reset to $100.");
  });

  it("puts back the last value that fitted when another rule refuses the entry", async () => {
    const user = setup();
    render(<Decision decimals={0} max={10_000} initial={400} isAllowed={(value) => value <= 600} />);
    const field = screen.getByRole("textbox", { name: "Marketing spend" });
    await user.clear(field);
    // 9 and 90 fit and are kept as they are typed; 900 does not.
    await user.type(field, "900");
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter 10,000 or less.");
    await user.tab();
    expect(field).toHaveValue("90");
    expect(screen.getByRole("alert")).toHaveTextContent("The maximum is 10,000. Reset to 90.");
  });

  it("drops its message on Escape, at the next keystroke, or after five seconds", async () => {
    const user = setup();
    render(<Decision decimals={0} max={10} />);
    const field = screen.getByRole("textbox", { name: "Marketing spend" });
    const refuse = async () => {
      await user.clear(field);
      await user.type(field, "99");
      await act(() => vi.advanceTimersByTimeAsync(300));
      await screen.findByRole("alert");
    };
    await refuse();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alert")).toBeNull();

    await refuse();
    await user.clear(field);
    await user.type(field, "5");
    expect(screen.queryByRole("alert")).toBeNull();

    await refuse();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a currency's symbol and reads its name, and writes a percentage with its sign", async () => {
    const user = setup();
    render(
      <NumberFormatProvider currency="THB">
        <Decision kind="currency" decimals={0} initial={2500} />
      </NumberFormatProvider>,
    );
    const money = screen.getByRole("textbox", { name: "Marketing spend" });
    expect(screen.getByText("฿")).toHaveAttribute("aria-hidden", "true");
    expect(money).toHaveAccessibleDescription("Thai Baht");
    expect(money).toHaveValue("2,500");

    render(<NumberField aria-label="Market share" kind="percent" value={12.5} max={50} onValueChange={() => {}} />);
    const share = screen.getByRole("textbox", { name: "Market share" });
    expect(share).toHaveValue("12.5 %");
    await user.clear(share);
    await user.type(share, "60");
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByRole("alert")).toHaveTextContent("That's above the 50.00% limit. Enter 50.00% or less.");
  });

  it("follows its value when the page changes it", () => {
    const { rerender } = render(<NumberField aria-label="Marketing spend" value={10} onValueChange={() => {}} />);
    rerender(<NumberField aria-label="Marketing spend" value={2048} onValueChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Marketing spend" })).toHaveValue("2,048");
  });

  it("writes back nothing it only shows: a value from the page stays unrounded", async () => {
    const user = setup();
    const onValueChange = vi.fn();
    const onCommit = vi.fn();
    const field = (value: number) => (
      <NumberField aria-label="Fair share" decimals={2} value={value} onValueChange={onValueChange} onCommit={onCommit} />
    );
    const { rerender } = render(field(1.2345));
    const input = screen.getByRole("textbox", { name: "Fair share" });
    expect(input).toHaveValue("1.23");
    rerender(field(2.3456));
    expect(input).toHaveValue("2.35");
    expect(onValueChange).not.toHaveBeenCalled();
    // Left untouched, it commits the value as it is.
    await user.click(input);
    await user.tab();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenLastCalledWith(2.3456);
  });

  it("does not check a value the page sets", async () => {
    setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<NumberField aria-label="Marketing spend" decimals={0} max={100} value={10} onValueChange={onValueChange} />);
    rerender(<NumberField aria-label="Marketing spend" decimals={0} max={100} value={250} onValueChange={onValueChange} />);
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps what the player types when the value changes meanwhile, and the value they leave wins", async () => {
    const user = setup();
    const onValueChange = vi.fn();
    const onCommit = vi.fn();
    const field = (value: number) => (
      <NumberField aria-label="Marketing spend" decimals={0} value={value} onValueChange={onValueChange} onCommit={onCommit} />
    );
    const { rerender } = render(field(10));
    const input = screen.getByRole("textbox", { name: "Marketing spend" });
    await user.type(input, "5");
    expect(input).toHaveValue("105");
    expect(onValueChange).toHaveBeenLastCalledWith(105);
    // A live refresh lands while they type.
    rerender(field(99));
    expect(input).toHaveValue("105");
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(105);
    expect(onCommit).toHaveBeenLastCalledWith(105);
  });

  it("goes back to the value when it is switched off while the player types", async () => {
    const user = setup();
    const field = (value: number, disabled = false) => (
      <NumberField aria-label="Marketing spend" decimals={0} value={value} disabled={disabled} onValueChange={() => {}} />
    );
    const { rerender } = render(field(10));
    const input = screen.getByRole("textbox", { name: "Marketing spend" });
    await user.type(input, "5");
    expect(input).toHaveValue("105");
    rerender(field(99, true));
    expect(input).toHaveValue("99");
  });
});
