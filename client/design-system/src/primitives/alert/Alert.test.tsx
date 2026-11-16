import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { IconButton } from "../icon-button/IconButton";
import { Alert } from "./Alert";
import { Pencil } from "lucide-react";

describe("Alert", () => {
  it("announces errors and warnings at once, other news politely", () => {
    render(
      <>
        <Alert tone="danger">Something went wrong. Please try again.</Alert>
        <Alert tone="warning">Round ends in 1 minute.</Alert>
        <Alert tone="success">Decisions saved.</Alert>
        <Alert tone="info">Round 2 starts soon.</Alert>
      </>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("shows a title, a message, actions and the tone's icon", () => {
    render(
      <Alert tone="danger" title="Could not save" actions={<button type="button">Retry</button>}>
        Check your connection.
      </Alert>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not save");
    expect(alert).toHaveTextContent("Check your connection.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(alert.querySelector(".lucide-triangle-alert")).not.toBeNull();
    expect(alert.className).toContain("bg-danger-soft");
  });

  it("can drop the icon", () => {
    render(<Alert icon={null}>Plain</Alert>);
    expect(screen.getByRole("status").querySelector("svg")).toBeNull();
  });

  it("closes through its dismiss button", async () => {
    const onDismiss = vi.fn();
    render(<Alert onDismiss={onDismiss}>Saved</Alert>);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("IconButton", () => {
  it("always has a name, and its icon is decorative", () => {
    render(<IconButton icon={Pencil} label="Edit team" />);
    const button = screen.getByRole("button", { name: "Edit team" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
