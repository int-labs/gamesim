import { render, screen } from "@testing-library/react";
import { NumberFormatProvider } from "../../foundations/format/NumberFormatProvider";
import { NumberField } from "../../primitives/number-field/NumberField";
import { DecisionCell, DecisionPanel, DecisionRow } from "./DecisionRow";
import { ReadOnlyField, ReadOnlyValue } from "./ReadOnlyValue";

function Retail() {
  return (
    <DecisionPanel title="Channel Execution" columns={["Modern", "Traditional"]}>
      <DecisionRow label="Pricing (Base price/unit)" description="The set selling price per unit before discounts or promotions.">
        <DecisionCell>
          <NumberField kind="currency" decimals={0} value={18} onValueChange={() => {}} />
        </DecisionCell>
        <DecisionCell>
          <NumberField kind="currency" decimals={0} value={18} onValueChange={() => {}} />
        </DecisionCell>
      </DecisionRow>
      <DecisionRow label="RRP (Recommended retail price)" description="Price after discounts." tone="brand">
        <DecisionCell>
          <ReadOnlyField>
            <ReadOnlyValue prefix="$" value="17.64" tone="brand" />
          </ReadOnlyField>
        </DecisionCell>
        <DecisionCell>
          <ReadOnlyField>
            <ReadOnlyValue prefix="$" value="16.20" tone="brand" />
          </ReadOnlyField>
        </DecisionCell>
      </DecisionRow>
    </DecisionPanel>
  );
}

describe("ReadOnlyValue", () => {
  it("writes the prefix and then the value, which a number groups", () => {
    render(
      <NumberFormatProvider locale="en-US">
        <ReadOnlyValue prefix="Total capacity:" value={15000} align="end" />
        <ReadOnlyValue value={12.5} decimals={1} suffix="%" />
      </NumberFormatProvider>,
    );
    expect(screen.getByText("Total capacity:").parentElement).toHaveTextContent("Total capacity:15,000");
    expect(screen.getByText("12.5%")).toBeInTheDocument();
  });

  it("puts the value at the end, where a field's value is", () => {
    render(<ReadOnlyValue prefix="$" value="9,999" />);
    expect(screen.getByText("9,999")).toHaveClass("ms-auto", "text-end");
  });
});

describe("ReadOnlyValue in a decision's columns", () => {
  it("is read after the decision's title and its column", () => {
    render(<Retail />);
    const rows = screen.getAllByRole("group");
    const rrp = rows.find((row) => row.getAttribute("aria-labelledby") && row.textContent?.startsWith("RRP"));
    const cells = rrp?.lastElementChild?.children;
    expect(cells?.[0]).toHaveTextContent(/^RRP \(Recommended retail price\), Modern.*\$17\.64$/);
    expect(cells?.[1]).toHaveTextContent(/^RRP \(Recommended retail price\), Traditional.*\$16\.20$/);
  });

  it("sets the row's title and caption in the brand's pink with `tone=\"brand\"`", () => {
    render(<Retail />);
    expect(screen.getByText("RRP (Recommended retail price)")).toHaveClass("text-fg-link");
    expect(screen.getByText("Price after discounts.", { selector: ":not([hidden])" })).toHaveClass("text-fg-link");
    expect(screen.getByText("Pricing (Base price/unit)")).toHaveClass("text-fg-primary");
  });

  it("shows a row's caption once: the cells use it only to describe their controls", () => {
    render(<Retail />);
    const shown = screen.getAllByText("The set selling price per unit before discounts or promotions.").filter((node) => !node.closest("[hidden]"));
    expect(shown).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Pricing (Base price/unit), Modern" })).toHaveAccessibleDescription(
      /The set selling price per unit before discounts or promotions\./,
    );
  });
});

describe("ReadOnlyField", () => {
  it("draws the value card only when asked", () => {
    const { container, rerender } = render(
      <ReadOnlyField>
        <ReadOnlyValue value={1200} />
      </ReadOnlyField>,
    );
    expect(container.firstElementChild).not.toHaveClass("bg-surface-card");
    rerender(
      <ReadOnlyField variant="card">
        <ReadOnlyValue value={1200} />
      </ReadOnlyField>,
    );
    expect(container.firstElementChild).toHaveClass("bg-surface-card");
  });
});
