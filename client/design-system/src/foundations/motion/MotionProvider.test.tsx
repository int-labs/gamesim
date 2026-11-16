import { render, screen } from "@testing-library/react";
import { MotionProvider, useReducedEffects } from "./MotionProvider";

function Probe() {
  return <span>{useReducedEffects() ? "reduced" : "full"}</span>;
}

describe("MotionProvider", () => {
  afterEach(() => {
    delete document.documentElement.dataset.motion;
  });

  it("leaves effects on by default", () => {
    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByText("full")).toBeInTheDocument();
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it("reduces effects on request and marks the page for the CSS variants", () => {
    const { rerender, unmount } = render(
      <MotionProvider reduceEffects>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByText("reduced")).toBeInTheDocument();
    expect(document.documentElement.dataset.motion).toBe("reduced");

    rerender(
      <MotionProvider reduceEffects={false}>
        <Probe />
      </MotionProvider>,
    );
    expect(screen.getByText("full")).toBeInTheDocument();
    expect(document.documentElement.dataset.motion).toBeUndefined();

    rerender(
      <MotionProvider reduceEffects>
        <Probe />
      </MotionProvider>,
    );
    unmount();
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it("follows the system setting outside a provider", () => {
    render(<Probe />);
    // jsdom reports no reduced-motion preference.
    expect(screen.getByText("full")).toBeInTheDocument();
  });
});
