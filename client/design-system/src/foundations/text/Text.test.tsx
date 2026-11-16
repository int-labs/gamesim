import { render, screen } from "@testing-library/react";
import { tokens } from "../../tokens";
import { Heading } from "./Heading";
import { Text, textTones } from "./Text";

describe("Text", () => {
  it("renders a paragraph in the body role by default", () => {
    render(<Text>Hello</Text>);
    const element = screen.getByText("Hello");
    expect(element.tagName).toBe("P");
    expect(element.className).toBe("type-body");
  });

  it("renders the requested element, role, tone and weight", () => {
    render(
      <Text as="label" htmlFor="x" variant="label" tone="muted" weight="semibold" numeric>
        Amount
      </Text>,
    );
    const element = screen.getByText("Amount");
    expect(element.tagName).toBe("LABEL");
    expect(element).toHaveAttribute("for", "x");
    expect(element.className).toBe("type-label text-fg-muted font-semibold tabular-nums");
  });

  it("uses only colours that exist as fg tokens", () => {
    for (const [tone, className] of Object.entries(textTones)) {
      if (tone === "inherit") continue;
      expect(Object.keys(tokens.color.fg), tone).toContain(className.replace("text-fg-", ""));
    }
  });
});

describe("Heading", () => {
  it("chooses the look by level unless a variant is given", () => {
    render(
      <>
        <Heading level={1}>Simulations</Heading>
        <Heading level={2} variant="heading">
          Revenue
        </Heading>
      </>,
    );
    const title = screen.getByRole("heading", { level: 1, name: "Simulations" });
    expect(title.className).toContain("type-page-title");
    expect(title.className).toContain("text-fg-primary");
    const section = screen.getByRole("heading", { level: 2, name: "Revenue" });
    expect(section.className).toContain("type-heading");
  });

  it("paints the wordmark with its gradient instead of a colour", () => {
    render(
      <Heading level={1} variant="wordmark">
        intlabs.
      </Heading>,
    );
    const className = screen.getByRole("heading").className;
    expect(className).toContain("bg-gradient-wordmark");
    expect(className).toContain("bg-clip-text");
    expect(className).toContain("text-transparent");
    expect(className).not.toContain("text-fg-primary");
  });
});
