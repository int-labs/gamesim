import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NumberField } from "../../primitives/number-field/NumberField";
import { DecisionCell, DecisionPanel, DecisionRow } from "./DecisionRow";

function Spend({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState(0);
  return (
    <DecisionPanel title="Set Your Strategy Inputs">
      <DecisionRow label="Marketing Spend ($)" description="The total budget allocated to promote your offerings." disabled={disabled}>
        <NumberField kind="currency" decimals={0} value={value} onValueChange={setValue} />
      </DecisionRow>
    </DecisionPanel>
  );
}

describe("DecisionPanel", () => {
  it("is a region named by its title", () => {
    render(<Spend />);
    expect(screen.getByRole("region", { name: "Set Your Strategy Inputs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Set Your Strategy Inputs" })).toBeInTheDocument();
  });
});

describe("DecisionRow", () => {
  it("names and describes its control with the decision's title and description", async () => {
    const user = userEvent.setup();
    render(<Spend />);
    const field = screen.getByRole("textbox", { name: "Marketing Spend ($)" });
    expect(field).toHaveAccessibleDescription(/The total budget allocated to promote your offerings\./);
    // The title is the field's label: a press on it focuses the field.
    await user.click(screen.getByText("Marketing Spend ($)"));
    expect(field).toHaveFocus();
  });

  it("dims its control and stops it answering once the round's decisions are locked", () => {
    render(<Spend disabled />);
    const field = screen.getByRole("textbox", { name: "Marketing Spend ($)" });
    expect(field).toBeDisabled();
    expect(field.closest("[data-locked]")).not.toBeNull();
  });

  it("shows a slider's level beside the title, with this round's change signed", () => {
    render(
      <DecisionRow label="Features of Products" level={{ value: 18, change: 1 }} control="slider">
        <span>slider</span>
      </DecisionRow>,
    );
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("(+1)")).toBeInTheDocument();
  });

  it("writes an unchanged level as (0) and a lower one with its minus", () => {
    const { rerender } = render(
      <DecisionRow label="Minimum Credit Score Change" level={{ value: 18, change: 0 }} control="slider">
        <span>slider</span>
      </DecisionRow>,
    );
    expect(screen.getByText("(0)")).toBeInTheDocument();
    rerender(
      <DecisionRow label="Minimum Credit Score Change" level={{ value: 16, change: -2 }} control="slider">
        <span>slider</span>
      </DecisionRow>,
    );
    expect(screen.getByText("(-2)")).toBeInTheDocument();
  });
});

function Pricing({ disabled = false, empty = false }: { disabled?: boolean; empty?: boolean }) {
  return (
    <DecisionPanel title="Channel Execution" description="Set specific pricing to capture market share in each channel." columns={["Modern", "Traditional", "Online"]}>
      <DecisionRow label="Pricing (Base price/unit)" description="The set selling price per unit before discounts or promotions." disabled={disabled}>
        <DecisionCell>
          <NumberField kind="currency" decimals={0} value={18} onValueChange={() => {}} />
        </DecisionCell>
        <DecisionCell>{empty ? null : <NumberField kind="currency" decimals={0} value={18} onValueChange={() => {}} />}</DecisionCell>
        <DecisionCell>
          <NumberField kind="currency" decimals={0} value={18} onValueChange={() => {}} />
        </DecisionCell>
      </DecisionRow>
    </DecisionPanel>
  );
}

describe("DecisionRow with columns", () => {
  it("names each cell's field by the decision and its column, and describes it", () => {
    render(<Pricing />);
    expect(screen.getByRole("region", { name: "Channel Execution" })).toBeInTheDocument();
    const modern = screen.getByRole("textbox", { name: "Pricing (Base price/unit), Modern" });
    expect(modern).toHaveAccessibleDescription(/The set selling price per unit before discounts or promotions\./);
    expect(screen.getByRole("textbox", { name: "Pricing (Base price/unit), Online" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Pricing (Base price/unit)" })).toBeInTheDocument();
  });

  it("keeps a column where a sub-product does not take the decision", () => {
    render(<Pricing empty />);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    const cells = screen.getByRole("group", { name: "Pricing (Base price/unit)" }).lastElementChild;
    expect(cells?.children).toHaveLength(3);
  });

  it("dims every cell and stops its field once the round's decisions are locked", () => {
    render(<Pricing disabled />);
    for (const field of screen.getAllByRole("textbox")) {
      expect(field).toBeDisabled();
      expect(field.closest("[data-locked]")).not.toBeNull();
    }
  });
});
