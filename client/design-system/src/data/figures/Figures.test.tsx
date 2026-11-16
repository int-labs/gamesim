import { render, screen } from "@testing-library/react";
import { NumberFormatProvider } from "../../foundations/format/NumberFormatProvider";
import { Figure, Figures } from "./Figures";

describe("Figures", () => {
  it("reads each figure with its label, as a description list", () => {
    render(
      <Figures>
        <Figure label="Past Salary" value="$99,999" />
        <Figure label="Average Salary" value="$104,000" total />
      </Figures>,
    );
    const terms = screen.getAllByRole("term");
    const definitions = screen.getAllByRole("definition");
    expect(terms.map((term) => term.tagName)).toEqual(["DT", "DT"]);
    expect(terms.map((term) => term.textContent)).toEqual(["Past Salary", "Average Salary"]);
    expect(definitions.map((definition) => definition.textContent)).toEqual(["$99,999", "$104,000"]);
  });

  it("groups a number in the app's locale, with the decimals asked for", () => {
    render(
      <NumberFormatProvider locale="en-US">
        <Figures>
          <Figure label="Current Number of people:" value={1250} />
          <Figure label="Churn rate (%):" value={4.75} decimals={2} />
        </Figures>
      </NumberFormatProvider>,
    );
    expect(screen.getAllByRole("definition").map((definition) => definition.textContent)).toEqual(["1,250", "4.75"]);
  });

  it("sets the total in bold, label and figure", () => {
    render(
      <Figures>
        <Figure label="Estimated churn:" value={5} />
        <Figure label="Total People at Year-End:" value={106} total />
      </Figures>,
    );
    expect(screen.getByText("Total People at Year-End:")).toHaveClass("font-bold");
    expect(screen.getByText("106")).toHaveClass("font-bold");
    expect(screen.getByText("Estimated churn:")).not.toHaveClass("font-bold");
  });
});
