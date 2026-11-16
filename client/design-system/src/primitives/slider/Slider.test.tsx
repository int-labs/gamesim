import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DecisionRow } from "../../game/decision/DecisionRow";
import { Slider, type SliderProps } from "./Slider";

type LevelProps = Partial<Omit<Extract<SliderProps, { min: number }>, "value" | "onValueChange">> & {
  initial?: number;
  onChange?: (value: number) => void;
};

/** A level slider whose value lives in the page, as on the decision pages. */
function Level({ initial = 0, onChange, ...props }: LevelProps) {
  const [value, setValue] = useState(initial);
  return (
    <DecisionRow label="Features of Products" description="The breadth and sophistication of features you offer." control="slider">
      <Slider
        min={-2}
        max={5}
        fillFrom={0}
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </DecisionRow>
  );
}

describe("Slider", () => {
  it("is named and described by its decision, and says its value", () => {
    render(<Level />);
    const slider = screen.getByRole("slider", { name: "Features of Products" });
    expect(slider).toHaveAccessibleDescription(/The breadth and sophistication of features you offer\./);
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(slider).toHaveAttribute("aria-valuetext", "0");
    expect(slider).toHaveAttribute("min", "-2");
    expect(slider).toHaveAttribute("max", "5");
  });

  it("moves a step at each key, and keeps each value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValueCommit = vi.fn();
    render(<Level onChange={onChange} onValueCommit={onValueCommit} />);
    const slider = screen.getByRole("slider", { name: "Features of Products" });
    // jsdom has no pointer capture, so the keys reach the thumb by Tab.
    await user.tab();
    expect(slider).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(onValueCommit).toHaveBeenLastCalledWith(1);
    expect(slider).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith(-2);
    expect(slider).toHaveAttribute("aria-valuenow", "-2");
  });

  it("stops at the values allowed now, and fades the others", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onValueCommit = vi.fn();
    const { container } = render(<Level initial={2} allowedMin={-1} allowedMax={3} onChange={onChange} onValueCommit={onValueCommit} />);
    const slider = screen.getByRole("slider", { name: "Features of Products" });
    await user.tab();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(onValueCommit).toHaveBeenLastCalledWith(3);
    onChange.mockClear();
    onValueCommit.mockClear();
    // At the last value allowed, a further step changes and keeps nothing.
    await user.keyboard("{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
    expect(slider).toHaveAttribute("aria-valuenow", "3");
    const faded = [...container.querySelectorAll("[aria-disabled='true']")].map((mark) => mark.textContent);
    expect(faded).toEqual(["-2", "4", "5"]);
  });

  it("shows a value past the ones allowed at the nearest one allowed, as today's does", () => {
    render(<Level initial={5} allowedMax={3} />);
    expect(screen.getByRole("slider", { name: "Features of Products" })).toHaveAttribute("aria-valuenow", "3");
  });

  it("fills from its origin to the thumb, and on to the rail's end from an end of the scale", () => {
    const { container, rerender } = render(<Slider aria-label="Change" min={-2} max={5} fillFrom={0} value={3} onValueChange={() => {}} />);
    const fill = () => container.querySelector(".slider-fill");
    const root = () => container.firstElementChild as HTMLElement;
    expect(root().style.getPropertyValue("--slider-fill-start")).toBe(String(2 / 7));
    expect(root().style.getPropertyValue("--slider-fill-end")).toBe(String(5 / 7));
    expect(fill()).not.toHaveAttribute("data-from-start");
    // A score fills from the rail's start.
    rerender(<Slider aria-label="Score" min={0} max={10} value={4} onValueChange={() => {}} />);
    expect(fill()).toHaveAttribute("data-from-start");
    expect(root().style.getPropertyValue("--slider-fill-end")).toBe(String(4 / 10));
  });

  it("says a word as its value and draws no fill under words", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider aria-label="Transaction Fee" labels={["Very Low", "Low", "Medium", "High", "Very High"]} value={2} onValueChange={onValueChange} />,
    );
    const slider = screen.getByRole("slider", { name: "Transaction Fee" });
    expect(slider).toHaveAttribute("aria-valuetext", "Medium");
    expect(slider).toHaveAttribute("max", "4");
    expect(container.querySelector(".slider-fill")).toBeNull();
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith(1);
  });

  it("writes its marks with the page's format, and hides them from screen readers", () => {
    render(<Slider aria-label="Share" min={0} max={5} formatLabel={(mark) => `${mark}%`} value={1} onValueChange={() => {}} />);
    expect(screen.getByText("5%").closest("[aria-hidden]")).not.toBeNull();
    expect(screen.getByRole("slider", { name: "Share" })).toHaveAttribute("aria-valuetext", "1%");
  });

  it("stops answering when the round's decisions are locked", () => {
    render(
      <DecisionRow label="Minimum Credit Score Change" control="slider" disabled>
        <Slider min={-2} max={5} fillFrom={0} value={0} onValueChange={() => {}} />
      </DecisionRow>,
    );
    const slider = screen.getByRole("slider", { name: "Minimum Credit Score Change" });
    expect(slider).toBeDisabled();
    expect(slider.closest("[data-locked]")).not.toBeNull();
  });
});
