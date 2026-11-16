import { render } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive technology and breathes unless motion is reduced", () => {
    const { container } = render(<Skeleton className="h-10 w-24" />);
    const block = container.firstElementChild;
    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block?.className).toContain("animate-pulse");
    expect(block?.className).toContain("motion-reduce:animate-none");
    expect(block?.className).toContain("rounded-lg");
  });

  it("draws a line of text and a circle", () => {
    const { container } = render(
      <>
        <Skeleton shape="text" className="w-3/5" />
        <Skeleton shape="circle" className="size-10" />
      </>,
    );
    const [line, circle] = [...container.children];
    expect(line?.className).toContain("scale-y-60");
    expect(line?.className).toContain("w-3/5");
    expect(circle?.className).toContain("rounded-full");
  });
});
