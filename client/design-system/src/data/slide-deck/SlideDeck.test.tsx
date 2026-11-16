import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Slide, SlideDeck, type SlideDeckProps } from "./SlideDeck";

function Deck(props: Partial<SlideDeckProps>) {
  return (
    <SlideDeck title="Feedback slides" footer={(number, total) => `© 2025 by Int Labs for Client. All Rights Reserved | ${number}/${total}`} {...props}>
      <Slide title="How we invested our time">Energy chart</Slide>
      <Slide title="Total Deposits Raised">
        <input aria-label="Note" />
      </Slide>
      <Slide title="The League Year 1" steps={3}>
        {(step) => `Teams shown: ${step + 1}`}
      </Slide>
    </SlideDeck>
  );
}

const position = (text: string) => screen.findByText(text, { selector: "p" });

describe("SlideDeck", () => {
  it("shows a slide at a time, named by its title, with Next only on the first and Previous only on the last", async () => {
    const user = userEvent.setup();
    render(<Deck />);
    expect(screen.getByRole("region", { name: "Feedback slides" })).toHaveAttribute("aria-roledescription", "slide deck");
    expect(screen.getByRole("group", { name: "How we invested our time" })).toHaveAttribute("aria-roledescription", "slide");
    expect(screen.getByRole("heading", { level: 2, name: "How we invested our time" })).toBeInTheDocument();
    expect(screen.getByText("© 2025 by Int Labs for Client. All Rights Reserved | 1/3")).toBeInTheDocument();
    expect(screen.getByText("Slide 1/3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await position("Slide 2/3");
    expect(await screen.findByRole("group", { name: "Total Deposits Raised" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await position("Slide 3/3");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
  });

  it("reveals a slide's steps before it moves on, and steps back through them", async () => {
    const user = userEvent.setup();
    render(<Deck defaultIndex={2} />);
    expect(await screen.findByText("Teams shown: 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Teams shown: 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Teams shown: 1")).toBeInTheDocument();
    // Back from the league's first step, then forward again: the slide before shows whole, the league starts over.
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await position("Slide 2/3");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Teams shown: 1")).toBeInTheDocument();
  });

  it("moves with the arrow keys, Page Up and Down, Home and End, and leaves the keys to a field", async () => {
    const user = userEvent.setup();
    render(<Deck />);
    await user.click(screen.getByText("Energy chart"));
    expect(screen.getByRole("region", { name: "Feedback slides" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    await position("Slide 2/3");
    await user.click(await screen.findByRole("textbox", { name: "Note" }));
    await user.keyboard("{ArrowRight}{End}");
    expect(screen.getByText("Slide 2/3")).toBeInTheDocument();
    await user.click(screen.getByText("Slide 2/3"));
    await user.keyboard("{End}");
    await position("Slide 3/3");
    await user.keyboard("{PageUp}");
    await position("Slide 2/3");
    await user.keyboard("{Home}");
    await position("Slide 1/3");
  });

  it("tells screen readers each new slide's number and title", async () => {
    const user = userEvent.setup();
    render(<Deck />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("Slide 2 of 3: Total Deposits Raised")).toBeInTheDocument());
    expect(screen.getByText("Slide 2 of 3: Total Deposits Raised").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("keeps focus in the deck when Previous or Next goes at an end", async () => {
    const user = userEvent.setup();
    render(<Deck defaultIndex={1} />);
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await position("Slide 1/3");
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toHaveFocus());
  });

  it("follows the page when it holds the slide, and tells it of each move", async () => {
    const user = userEvent.setup();
    function Held() {
      const [index, setIndex] = useState(1);
      return <Deck index={index} onIndexChange={setIndex} />;
    }
    render(<Held />);
    expect(screen.getByText("Slide 2/3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await position("Slide 3/3");
  });

  it("offers full screen only where the browser allows it", () => {
    render(<Deck />);
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();
  });
});

describe("SlideDeck's size", () => {
  // jsdom lays nothing out: the room a deck has, whether it is a phone and full screen are set here.
  const sizes = ["clientWidth", "clientHeight"] as const;
  const original = sizes.map((size) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, size));

  const room = (width: number, height: number) => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => height });
  };
  const phone = (matches: boolean) =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  // The frame the slide is drawn in: its inline width is the slide's, 809 at its own size.
  const frameWidth = () => (screen.getByRole("region", { name: "Feedback slides" }).firstElementChild!.firstElementChild as HTMLElement).style.width;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sizes.forEach((size, index) => Object.defineProperty(HTMLElement.prototype, size, original[index] ?? { configurable: true, value: 0 }));
    Reflect.deleteProperty(document, "fullscreenElement");
  });

  it("on a computer, never shrinks below its 809 x 455: the room scrolls instead", () => {
    phone(false);
    room(400, 600);
    render(<Deck />);
    expect(frameWidth()).toBe("809px");
  });

  it("on a computer, grows to fill the room at its 16:9", () => {
    phone(false);
    room(1618, 910);
    render(<Deck />);
    expect(frameWidth()).toBe("1618px");
  });

  it("on a phone, shrinks to fit the width", () => {
    phone(true);
    room(404.5, 600);
    render(<Deck />);
    expect(frameWidth()).toBe("404.5px");
  });

  it("in full screen, fits the screen, smaller than its size if need be", async () => {
    phone(false);
    room(809, 227.5);
    render(<Deck />);
    expect(frameWidth()).toBe("809px");

    const deck = screen.getByRole("region", { name: "Feedback slides" });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => deck });
    document.dispatchEvent(new Event("fullscreenchange"));

    // Half the height it is laid out at, so half its width.
    await waitFor(() => expect(frameWidth()).toBe("404.5px"));
  });
});
