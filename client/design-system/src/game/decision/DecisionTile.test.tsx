import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Figure, Figures } from "../../data/figures/Figures";
import { NumberField } from "../../primitives/number-field/NumberField";
import { Slider } from "../../primitives/slider/Slider";
import { ResourceChip, ResourceChips } from "../resource-chip/ResourceChip";
import { DecisionTile, DecisionTiles } from "./DecisionTile";

function Hires({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState(12);
  return (
    <DecisionTiles>
      <DecisionTile
        title="Number of RMs"
        description="Number of Relationship Managers hired."
        figures={
          <Figures>
            <Figure label="Current Number of people:" value={99} />
            <Figure label="Total People at Year-End:" value={106 + value} total />
          </Figures>
        }
        label="New RMs"
        chips={
          <ResourceChips>
            <ResourceChip kind="cost" value={1_000_000} />
          </ResourceChips>
        }
        disabled={disabled}
      >
        <NumberField decimals={0} value={value} onValueChange={setValue} />
      </DecisionTile>
    </DecisionTiles>
  );
}

describe("DecisionTile", () => {
  it("names its field by the field's own label and the tile by its title", async () => {
    const user = userEvent.setup();
    render(<Hires />);
    const tile = screen.getByRole("group", { name: "Number of RMs" });
    const field = within(tile).getByRole("textbox", { name: "New RMs" });
    expect(field).toHaveAccessibleDescription(/Number of Relationship Managers hired\./);
    // The label above the field is its label: a press on it focuses the field.
    await user.click(screen.getByText("New RMs"));
    expect(field).toHaveFocus();
  });

  it("names its control by the title when the control has no label of its own", () => {
    const { container } = render(
      <DecisionTile title="Training" description="Training hours or programs per RM." level={{ value: 18, change: -2 }}>
        <Slider min={-2} max={5} fillFrom={0} value={-2} onValueChange={() => {}} />
      </DecisionTile>,
    );
    const slider = screen.getByRole("slider", { name: "Training" });
    expect(slider).toHaveAccessibleDescription(/Training hours or programs per RM\./);
    // The title names the slider itself, so the tile is no group of its own.
    expect(container.firstElementChild).not.toHaveAttribute("role");
    expect(screen.getByText("(-2)")).toBeInTheDocument();
  });

  it("keeps the round's figures beside the field, each read with its label", () => {
    render(<Hires />);
    const figures = screen.getAllByRole("term").map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(figures).toEqual([
      ["Current Number of people:", "99"],
      ["Total People at Year-End:", "118"],
    ]);
  });

  it("dims the field and its chips once the round's decisions are locked, and keeps the figures", () => {
    render(<Hires disabled />);
    const field = screen.getByRole("textbox", { name: "New RMs" });
    expect(field).toBeDisabled();
    expect(field.closest("[data-locked]")).not.toBeNull();
    expect(screen.getByText("Cost: $1M").closest("[data-locked]")).not.toBeNull();
    expect(screen.getByText("Current Number of people:").closest("[data-locked]")).toBeNull();
  });
});

describe("DecisionTiles", () => {
  it("lays out as many tiles in a row as the segment's columns", () => {
    const { container, rerender } = render(<DecisionTiles>{null}</DecisionTiles>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.getPropertyValue("--decision-tiles-columns")).toBe("3");
    rerender(<DecisionTiles columns={1}>{null}</DecisionTiles>);
    expect(card.style.getPropertyValue("--decision-tiles-columns")).toBe("1");
  });
});
