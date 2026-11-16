import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Download } from "lucide-react";
import { createRef } from "react";
import { vi } from "vitest";
import { Button } from "./Button";
import { LinkButton } from "./LinkButton";

vi.mock("../../delight/burst", () => ({ burstFrom: vi.fn(() => Promise.resolve()) }));
const { burstFrom } = await import("../../delight/burst");

describe("Button", () => {
  beforeEach(() => vi.mocked(burstFrom).mockClear());

  it("is a native button that does not submit forms by default", () => {
    render(<Button>Submit</Button>);
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("uses the Figma size of each kind: solid 40, outline 46, text 38", () => {
    render(
      <>
        <Button>Solid</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="text">Text</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Solid" }).className).toContain("h-(--button-height-md)");
    expect(screen.getByRole("button", { name: "Outline" }).className).toContain("h-(--button-height-lg)");
    expect(screen.getByRole("button", { name: "Text" }).className).toContain("h-(--button-height-sm)");
  });

  it("paints the tones of the solid button", () => {
    render(
      <>
        <Button>Submit</Button>
        <Button tone="energy">Start Round</Button>
        <Button tone="danger">End Round</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Submit" }).className).toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Start Round" }).className).toContain("bg-energy");
    expect(screen.getByRole("button", { name: "End Round" }).className).toContain("bg-danger-strong");
  });

  it("calls onClick while idle", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("ignores clicks and dims when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("opacity-50");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays focusable and keeps its name while loading, but does not act", async () => {
    const onClick = vi.fn();
    render(
      <Button status="loading" onClick={onClick}>
        Submit
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.className).not.toContain("opacity-50");
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("draws a check on success and celebrates once when asked", () => {
    const { rerender } = render(<Button celebrate>Submit</Button>);
    expect(burstFrom).not.toHaveBeenCalled();
    rerender(
      <Button celebrate status="success">
        Submit
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toHaveAttribute("data-status", "success");
    expect(button.querySelector(".lucide-check")).not.toBeNull();
    expect(burstFrom).toHaveBeenCalledOnce();
    rerender(
      <Button celebrate status="success">
        Submit
      </Button>,
    );
    expect(burstFrom).toHaveBeenCalledOnce();
  });

  it("does not celebrate unless asked", () => {
    render(<Button status="success">Submit</Button>);
    expect(burstFrom).not.toHaveBeenCalled();
  });

  it("shows icons without adding to the name", () => {
    render(
      <Button variant="text" iconStart={Download}>
        Feedback
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Feedback" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards its ref to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Submit</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe("LinkButton", () => {
  it("is a link that looks like a button", () => {
    render(<LinkButton href="/slides">Feedback Slides</LinkButton>);
    const link = screen.getByRole("link", { name: "Feedback Slides" });
    expect(link).toHaveAttribute("href", "/slides");
    expect(link.className).toContain("border-primary");
  });

  it("renders a router link through render", () => {
    render(
      <LinkButton render={<a data-router="yes" href="/x" />} variant="text">
        Open
      </LinkButton>,
    );
    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("data-router", "yes");
    expect(link.className).toContain("text-fg-link");
  });
});
