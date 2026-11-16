import { render, screen } from "@testing-library/react";
import { Zap } from "lucide-react";
import { SlashSeparator } from "./glyphs";
import { Icon, iconSizes } from "./Icon";

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no svg rendered");
  return svg;
}

describe("Icon", () => {
  it("draws at the token size with a 1 px stroke by default", () => {
    const svg = svgOf(render(<Icon icon={Zap} />).container);
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
    // An absolute stroke: 1 px on screen means 1 * 24 / 16 in the 24-unit grid.
    expect(svg).toHaveAttribute("stroke-width", String((1 * 24) / 16));
  });

  it("keeps the stroke constant across sizes", () => {
    for (const size of ["xs", "sm", "md", "lg", "xl", "2xl"] as const) {
      const svg = svgOf(render(<Icon icon={Zap} size={size} stroke="regular" />).container);
      expect(Number(svg.getAttribute("stroke-width")) * (iconSizes[size] / 24)).toBeCloseTo(1.5);
    }
  });

  it("is hidden from assistive technology unless it has a label", () => {
    const decorative = svgOf(render(<Icon icon={Zap} />).container);
    expect(decorative).toHaveAttribute("aria-hidden", "true");

    render(<Icon icon={Zap} label="Energy" />);
    const meaningful = screen.getByRole("img", { name: "Energy" });
    expect(meaningful).not.toHaveAttribute("aria-hidden");
  });

  it("takes the text colour and never shrinks in a flex row", () => {
    const svg = svgOf(render(<Icon icon={Zap} className="text-primary" />).container);
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg.getAttribute("class")).toContain("shrink-0");
    expect(svg.getAttribute("class")).toContain("text-primary");
  });

  it("draws the design system's own glyphs the same way", () => {
    const svg = svgOf(render(<Icon icon={SlashSeparator} size="md" />).container);
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg.querySelector("path")).toHaveAttribute("d", "M15 3 9 21");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
  });
});
