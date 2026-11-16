import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Copy, UserX } from "lucide-react";
import { createRef, useState } from "react";
import { vi } from "vitest";
import { IconButton } from "../../primitives/icon-button/IconButton";
import { Tooltip } from "./Tooltip";

/** The tooltip on screen: its popup, which carries data-open while it shows. */
const shown = (text: string) => screen.queryByText(text, { selector: "[data-open]" });

describe("Tooltip", () => {
  it("shows while its anchor has keyboard focus, and Escape closes it", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Copy passkey" describe={false}>
        <IconButton icon={Copy} label="Copy passkey" />
      </Tooltip>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Copy passkey" })).toHaveFocus();
    expect(await screen.findByText("Copy passkey", { selector: "[data-open]" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(shown("Copy passkey")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Copy passkey" })).toHaveFocus();
  });

  it("opens once the pointer rests on its anchor and closes when it leaves", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Copy passkey" describe={false}>
        <IconButton icon={Copy} label="Copy passkey" />
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Copy passkey" });
    await user.hover(button);
    expect(await screen.findByText("Copy passkey", { selector: "[data-open]" })).toBeInTheDocument();
    await user.unhover(button);
    await waitFor(() => expect(shown("Copy passkey")).not.toBeInTheDocument());
  });

  it("describes its anchor for assistive technology, after the anchor's own description", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p id="own-help">Suspended people cannot sign in.</p>
        <Tooltip content="You cannot update your own status">
          <IconButton icon={UserX} label="Suspend user" aria-describedby="own-help" disabled focusableWhenDisabled />
        </Tooltip>
      </>,
    );
    const button = screen.getByRole("button", { name: "Suspend user" });
    // Before it opens, so it is read when the anchor gets focus.
    expect(button).toHaveAccessibleDescription("Suspended people cannot sign in. You cannot update your own status");
    await user.tab();
    expect(button).toHaveFocus();
    // Read through the anchor only: the popup itself is hidden from assistive technology.
    const popup = await screen.findByText("You cannot update your own status", { selector: "[data-open]" });
    expect(popup).toHaveAttribute("aria-hidden", "true");
  });

  it("adds no description when the anchor already says the words", () => {
    render(
      <Tooltip content="Copy passkey" describe={false}>
        <IconButton icon={Copy} label="Copy passkey" />
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Copy passkey" })).not.toHaveAttribute("aria-describedby");
  });

  it("stays closed and describes nothing when its text is empty, as MUI's title=\"\"", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="">
        <IconButton icon={Copy} label="Copy passkey" />
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Copy passkey" });
    expect(button).not.toHaveAttribute("aria-describedby");
    await user.tab();
    await user.hover(button);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(document.querySelector("[data-open]")).toBeNull();
  });

  it("keeps its anchor, and the anchor's focus, when the text comes and goes", async () => {
    const user = userEvent.setup();
    function Toggle() {
      const [on, setOn] = useState(false);
      return (
        <Tooltip content={on ? "Log Out" : null} describe={false}>
          <button type="button" onClick={() => setOn((value) => !value)}>
            Log Out
          </button>
        </Tooltip>
      );
    }
    render(<Toggle />);
    const button = screen.getByRole("button", { name: "Log Out" });
    await user.click(button);
    expect(screen.getByRole("button", { name: "Log Out" })).toBe(button);
    expect(button).toHaveFocus();
    await user.click(button);
    expect(screen.getByRole("button", { name: "Log Out" })).toBe(button);
  });

  it("passes its anchor's handlers and refs through", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const anchorRef = createRef<HTMLButtonElement>();
    const tooltipRef = createRef<HTMLElement>();
    render(
      <Tooltip ref={tooltipRef} content="Copy passkey" describe={false}>
        <IconButton ref={anchorRef} icon={Copy} label="Copy passkey" onClick={onClick} />
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Copy passkey" });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(anchorRef.current).toBe(button);
    expect(tooltipRef.current).toBe(button);
  });

  it("does not mark its anchor as an open menu", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Copy passkey" describe={false}>
        <IconButton icon={Copy} label="Copy passkey" />
      </Tooltip>,
    );
    await user.tab();
    await screen.findByText("Copy passkey", { selector: "[data-open]" });
    // Base UI marks a tooltip's anchor data-popup-open; the open-menu look also needs aria-expanded.
    const button = screen.getByRole("button", { name: "Copy passkey" });
    expect(button).toHaveAttribute("data-popup-open");
    expect(button).not.toHaveAttribute("aria-expanded");
    expect(button.className).toContain("aria-expanded:data-popup-open:bg-surface-hover");
  });
});
