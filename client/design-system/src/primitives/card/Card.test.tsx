import { render, screen } from "@testing-library/react";
import { Badge } from "../badge/Badge";
import { EmptyState } from "../empty-state/EmptyState";
import { Card, CardHeader } from "./Card";

describe("Card", () => {
  it("titles its content with a heading at the level the page needs", () => {
    render(
      <Card>
        <CardHeader title="Revenue Comparison" level={3} actions={<button type="button">Export</button>} />
        <EmptyState title="Round has not started" />
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Revenue Comparison" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByText("Round has not started")).toBeInTheDocument();
  });

  it("draws its edge as an inset ring, so the padding matches Figma", () => {
    const { container } = render(<Card variant="container">content</Card>);
    expect(container.firstElementChild?.className).toContain("inset-ring");
    expect(container.firstElementChild?.className).not.toContain("border");
  });
});

describe("Badge", () => {
  it("shows a status in a soft tone", () => {
    render(<Badge tone="info">ACTIVE</Badge>);
    const badge = screen.getByText("ACTIVE");
    expect(badge.className).toContain("bg-info-soft");
    expect(badge.className).toContain("type-badge");
  });
});

describe("EmptyState", () => {
  it("offers help and an action for a whole panel", () => {
    render(
      <EmptyState
        size="md"
        title="No event yet"
        description="Events added to this round appear here."
        actions={<button type="button">Add Event</button>}
      />,
    );
    expect(screen.getByText("Events added to this round appear here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Event" })).toBeInTheDocument();
  });
});
