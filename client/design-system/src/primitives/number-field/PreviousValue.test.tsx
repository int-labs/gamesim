import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviousValue } from "./PreviousValue";

describe("PreviousValue", () => {
  it("writes a short value on one line, a number grouped", () => {
    const { container, rerender } = render(<PreviousValue value="$5k" />);
    expect(container.firstElementChild).toHaveTextContent("Previous:$5k");
    expect(container.firstElementChild).toHaveClass("whitespace-nowrap");
    rerender(<PreviousValue value={1250000} label="Sebelumnya" />);
    expect(container.firstElementChild).toHaveTextContent("Sebelumnya:1,250,000");
  });

  it("says None, not a dash, for a round without a value", () => {
    const { container } = render(<PreviousValue value={null} />);
    expect(container.firstElementChild).toHaveTextContent("Previous:None");
  });

  it("puts a long value under its label, on up to two lines, whole in a tooltip", async () => {
    const user = userEvent.setup();
    const text = "Premium savings with a loyalty bonus";
    const { container } = render(<PreviousValue value={text} />);
    expect(container.firstElementChild).toHaveClass("flex-col");
    const value = screen.getByText(text);
    expect(value).toHaveClass("line-clamp-2");
    await user.hover(value);
    expect(await screen.findByText(text, { selector: "[data-open]" })).toBeInTheDocument();
  });
});
