import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { nextRange, type DayRange } from "./Calendar";
import { DatePicker, DateRangePicker, type DatePickerProps } from "./DatePicker";

function StartDate({ onChange, ...props }: Partial<DatePickerProps> & { onChange?: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(props.value ?? null);
  return (
    <DatePicker
      label="Start date"
      today="2026-09-24"
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const dayButton = (name: RegExp) => within(screen.getByRole("grid")).getByRole("button", { name });

describe("DatePicker", () => {
  it("is named by its label and says what it holds", async () => {
    const onChange = vi.fn();
    render(<StartDate onChange={onChange} />);
    const field = screen.getByRole("button", { name: "Start date Select a date" });
    expect(field).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(field);
    expect(await screen.findByRole("dialog", { name: "Choose a date" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeInTheDocument();
    await userEvent.click(dayButton(/^Saturday, 26 September 2026/));
    expect(onChange).toHaveBeenLastCalledWith("2026-09-26");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Start date 26 Sept 2026" })).toBeInTheDocument();
  });

  it("opens on the chosen day's month and marks today and the chosen day for screen readers", async () => {
    render(<StartDate value="2026-10-05" />);
    await userEvent.click(screen.getByRole("button", { name: "Start date 5 Oct 2026" }));
    expect(await screen.findByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(dayButton(/^Monday, 5 October 2026, selected$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(dayButton(/^Thursday, 24 September 2026, today$/)).toBeInTheDocument();
  });

  it("keeps the days outside min and max from being chosen", async () => {
    const onChange = vi.fn();
    render(<StartDate onChange={onChange} min="2026-09-24" max="2026-09-28" />);
    await userEvent.click(screen.getByRole("button", { name: /Start date/ }));
    await screen.findByRole("dialog");
    expect(dayButton(/^Wednesday, 23 September 2026/)).toBeDisabled();
    expect(dayButton(/^Tuesday, 29 September 2026/)).toBeDisabled();
    expect(dayButton(/^Monday, 28 September 2026/)).toBeEnabled();
    await userEvent.click(dayButton(/^Tuesday, 29 September 2026/));
    // The months with no day to choose are out of reach.
    expect(screen.getByRole("button", { name: "Previous month" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Next month" })).toHaveAttribute("aria-disabled", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chooses today, and empties a field that may stay empty", async () => {
    const onChange = vi.fn();
    render(<StartDate onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Start date/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Today" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-09-24");
    await userEvent.click(screen.getByRole("button", { name: "Start date 24 Sept 2026" }));
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("offers no Clear when the field is required, and no Today outside the allowed days", async () => {
    render(<StartDate required value="2026-10-05" min="2026-10-01" />);
    await userEvent.click(screen.getByRole("button", { name: /Start date/ }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("closes on Escape and hands focus back to the field", async () => {
    render(<StartDate />);
    const field = screen.getByRole("button", { name: /Start date/ });
    await userEvent.click(field);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(field).toHaveFocus();
  });

  it("reads its help and error with it, and marks itself invalid", () => {
    render(<StartDate description="Access starts on this day." error="Choose a start date" />);
    const field = screen.getByRole("button", { name: /Start date/ });
    expect(field).toHaveAccessibleDescription("Access starts on this day. Choose a start date");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("sends its day with a form as yyyy-mm-dd", () => {
    const { container } = render(<StartDate name="startsOn" value="2026-09-24" />);
    expect(container.querySelector('input[type="hidden"][name="startsOn"]')).toHaveValue("2026-09-24");
  });
});

describe("DateRangePicker", () => {
  function AuditDays({ onChange }: { onChange: (value: DayRange) => void }) {
    const [value, setValue] = useState<DayRange>({ from: null, to: null });
    return (
      <DateRangePicker
        label="Days"
        today="2026-09-24"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it("sets the first day, then the last, then closes and shows the span", async () => {
    const onChange = vi.fn();
    render(<AuditDays onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Days Select a date" }));
    await userEvent.click(dayButton(/^Monday, 14 September 2026/));
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-09-14", to: null });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(dayButton(/^Sunday, 20 September 2026/));
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-09-14", to: "2026-09-20" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Days 14 Sept 2026 to 20 Sept 2026" })).toBeInTheDocument();
  });

  it("puts the days in order when the end is pressed first, and starts again on a third press", async () => {
    const onChange = vi.fn();
    render(<AuditDays onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Days/ }));
    await userEvent.click(dayButton(/^Sunday, 20 September 2026/));
    await userEvent.click(dayButton(/^Monday, 14 September 2026/));
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-09-14", to: "2026-09-20" });
    await userEvent.click(screen.getByRole("button", { name: /Days/ }));
    await userEvent.click(dayButton(/^Tuesday, 1 September 2026/));
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-09-01", to: null });
  });
});

describe("nextRange", () => {
  it("starts, finishes in order, and starts again", () => {
    expect(nextRange({ from: null, to: null }, "2026-09-14")).toEqual({ from: "2026-09-14", to: null });
    expect(nextRange({ from: "2026-09-14", to: null }, "2026-09-20")).toEqual({ from: "2026-09-14", to: "2026-09-20" });
    expect(nextRange({ from: "2026-09-14", to: null }, "2026-09-10")).toEqual({ from: "2026-09-10", to: "2026-09-14" });
    expect(nextRange({ from: "2026-09-14", to: null }, "2026-09-14")).toEqual({ from: "2026-09-14", to: "2026-09-14" });
    expect(nextRange({ from: "2026-09-14", to: "2026-09-20" }, "2026-09-02")).toEqual({ from: "2026-09-02", to: null });
  });
});
