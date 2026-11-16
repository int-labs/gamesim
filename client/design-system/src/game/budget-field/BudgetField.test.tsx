import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NumberFormatProvider } from "../../foundations/format/NumberFormatProvider";
import { tokens } from "../../tokens";
import { BudgetField, type BudgetFieldProps } from "./BudgetField";

const HINT_DURATION = Number.parseFloat(tokens.component["budget-field"]["hint-duration"]);

/** A spend of 1,500,000 with a cap of 4,000,000: the page keeps what fits, as today's campaigns do. */
function Spend({ initial = 1_500_000, refuse = false, ...props }: Partial<BudgetFieldProps> & { initial?: number; refuse?: boolean }) {
  const [spend, setSpend] = useState(initial);
  // No cap given is a cap of 4,000,000; an explicit undefined is no budget.
  const cap = "cap" in props ? props.cap : 4_000_000;
  return (
    <NumberFormatProvider currency="THB">
      <BudgetField
        aria-label="Channel Spend"
        {...props}
        value={spend}
        cap={cap}
        onCommit={(next) => {
          if (refuse || (cap !== undefined && next > cap)) return false;
          setSpend(next);
        }}
      />
    </NumberFormatProvider>
  );
}

describe("BudgetField", () => {
  it("says how much more fits once part of the budget is spent, and the cap otherwise", () => {
    const { rerender } = render(<Spend showRoom />);
    expect(screen.getByRole("textbox", { name: "Channel Spend" })).toHaveAccessibleDescription(/Up to ฿2,500,000 more/);
    expect(screen.getByText("Up to ฿2,500,000 more")).toBeVisible();
    rerender(<Spend />);
    expect(screen.getByRole("textbox", { name: "Channel Spend" })).toHaveAccessibleDescription(/Max ฿4,000,000/);
    expect(screen.queryByText("Up to ฿2,500,000 more")).toBeNull();
  });

  it("turns red past the cap as the player types, with the cap and Use max under it", async () => {
    const user = userEvent.setup();
    render(<Spend />);
    const field = screen.getByRole("textbox", { name: "Channel Spend" });
    await user.clear(field);
    await user.type(field, "5000000");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Max ฿4,000,000")).toHaveClass("text-fg-danger");
    expect(screen.getByRole("button", { name: "Use max ฿4,000,000" })).toBeInTheDocument();
  });

  it("puts the kept amount back when the page refuses one, and shows the cap for a while", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Spend />);
      const field = screen.getByRole("textbox", { name: "Channel Spend" });
      await user.clear(field);
      await user.type(field, "5000000{Enter}");
      expect(field).toHaveValue("1,500,000");
      expect(screen.getByText("Max ฿4,000,000", { selector: "p" })).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(HINT_DURATION);
      });
      // The cap goes back to being the field's description, out of sight.
      expect(screen.queryByText("Max ฿4,000,000", { selector: "p" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fills the field to its cap with Use max, and hands the focus back to the field", async () => {
    const user = userEvent.setup();
    render(<Spend />);
    const field = screen.getByRole("textbox", { name: "Channel Spend" });
    await user.clear(field);
    await user.type(field, "5000000{Enter}");
    await user.click(screen.getByRole("button", { name: "Use max ฿4,000,000" }));
    expect(field).toHaveValue("4,000,000");
    expect(field).toHaveFocus();
    expect(screen.queryByRole("button", { name: /Use max/ })).toBeNull();
  });

  it("keeps any amount without a budget", async () => {
    const user = userEvent.setup();
    render(<Spend cap={undefined} />);
    const field = screen.getByRole("textbox", { name: "Channel Spend" });
    await user.clear(field);
    await user.type(field, "9000000{Enter}");
    expect(field).toHaveValue("9,000,000");
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/Max/)).toBeNull();
  });

  it("marks a kept amount over a smaller cap, but not once the round's decisions are locked", () => {
    const { rerender } = render(<Spend initial={5_000_000} />);
    const field = screen.getByRole("textbox", { name: "Channel Spend" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Max ฿4,000,000", { selector: "p" })).toBeInTheDocument();
    rerender(<Spend initial={5_000_000} disabled />);
    expect(field).toBeDisabled();
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Max ฿4,000,000", { selector: "p" })).toBeNull();
  });
});
