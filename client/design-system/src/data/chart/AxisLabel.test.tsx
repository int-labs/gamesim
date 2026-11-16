import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AxisLabel, fitLines } from "./AxisLabel";

/** One unit a character, so widths read as lengths. */
const byLength = (text: string) => text.length;

describe("fitLines", () => {
  it("keeps a name that fits on one line", () => {
    expect(fitLines("Team Alpha", 20, 2, byLength)).toEqual(["Team Alpha"]);
  });

  it("breaks between words only, over two lines", () => {
    expect(fitLines("Team Alpha", 6, 2, byLength)).toEqual(["Team", "Alpha"]);
  });

  it("ends the last line in an ellipsis when words are left over", () => {
    expect(fitLines("Team Novabank Digital Transformation", 10, 2, byLength)).toEqual(["Team", "Novabank…"]);
    expect(fitLines("Team Sunda Kelapa Holdings", 6, 2, byLength)).toEqual(["Team", "Sunda…"]);
  });

  it("shortens the last line until its ellipsis fits", () => {
    expect(fitLines("Team Merahputih Capital", 8, 2, byLength)).toEqual(["Team", "Merahpu…"]);
  });

  it("gives a word wider than a line a line of its own, for the line to cut", () => {
    expect(fitLines("Papertrail", 5, 2, byLength)).toEqual(["Papertrail"]);
    expect(fitLines("Colophon Press", 5, 2, byLength)).toEqual(["Colophon", "Press"]);
  });

  it("gives nothing for an empty name", () => {
    expect(fitLines("  ", 10, 2, byLength)).toEqual([]);
  });
});

describe("AxisLabel", () => {
  it("shows the whole name, wrapped and clamped, where it cannot be measured", () => {
    render(<AxisLabel label="Team Novabank Digital Transformation" className="block" lineClassName="truncate" unmeasuredClassName="line-clamp-2" />);
    const label = screen.getByText("Team Novabank Digital Transformation");
    // The clamp takes over the label's display until it is measured.
    expect(label).toHaveClass("line-clamp-2");
    expect(label).not.toHaveClass("block");
  });
});
