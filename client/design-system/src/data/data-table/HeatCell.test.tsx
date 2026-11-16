import { render, screen } from "@testing-library/react";
import { HeatCell, heatBand, heatScores } from "./HeatCell";

describe("heatScores", () => {
  it("places each value in its row from 0 to 1", () => {
    expect(heatScores([1.5, 2.5, 2])).toEqual([0, 1, 0.5]);
  });

  it("gives every value of an even row 0.5, as today's table", () => {
    expect(heatScores([1.2, 1.2, 1.2])).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("heatBand", () => {
  it("cuts today's four bands: over 0.85, over 0.6, over 0.3, and the rest", () => {
    expect([1, 0.86, 0.85, 0.61, 0.6, 0.31, 0.3, 0].map(heatBand)).toEqual(["high", "high", "good", "good", "fair", "fair", "low", "low"]);
  });
});

describe("HeatCell", () => {
  it("writes the value on its band's tone, and a word for screen readers when given", () => {
    render(
      <HeatCell score={0.9} srLabel="highest">
        2.66
      </HeatCell>,
    );
    const cell = screen.getByText("2.66");
    expect(cell).toHaveAttribute("data-band", "high");
    expect(cell).toHaveTextContent("2.66 (highest)");
  });
});
