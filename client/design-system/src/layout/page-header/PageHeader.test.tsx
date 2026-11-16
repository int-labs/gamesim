import { render, screen, within } from "@testing-library/react";
import { Breadcrumb } from "../../primitives/breadcrumb/Breadcrumb";
import { PageHeader } from "./PageHeader";

describe("Breadcrumb", () => {
  it("links the levels above and marks the current page", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Simulations", href: "/simulations" },
          { label: "Novabank Growth Simulation" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Simulations" })).toHaveAttribute("href", "/simulations");
    expect(within(nav).getByText("Novabank Growth Simulation")).toHaveAttribute("aria-current", "page");
    // The separators are drawn, not read.
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders a router link through render", () => {
    render(<Breadcrumb items={[{ label: "Events", render: <a href="/events" data-router="yes" /> }, { label: "Global Trade War" }]} />);
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("data-router", "yes");
  });
});

describe("PageHeader", () => {
  it("gives the page its one h1, with description, addon and actions", () => {
    render(
      <PageHeader
        title="Simulations"
        description="Manage and monitor all simulation projects from a single dashboard."
        addon={<span>ACTIVE</span>}
        actions={<button type="button">New Simulation</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Simulations" })).toBeInTheDocument();
    expect(screen.getByText("Manage and monitor all simulation projects from a single dashboard.")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Simulation" })).toBeInTheDocument();
  });
});
