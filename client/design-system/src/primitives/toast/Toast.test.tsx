import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowDownToLine } from "lucide-react";
import { vi } from "vitest";
import { createToaster, ToastProvider, toastVariants, useToast } from "./Toast";

function Trigger() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.success("Decisions saved")}>
        Save
      </button>
      <button type="button" onClick={() => toast.error("Something went wrong. Please try again.", { description: "Check your connection." })}>
        Fail
      </button>
      <button type="button" onClick={() => toast.info("Downloading...", { icon: ArrowDownToLine, duration: 0 })}>
        Download
      </button>
    </>
  );
}

describe("Toast", () => {
  it("shows a success toast and closes it after the Figma two seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("dialog", { name: "Decisions saved" })).toBeInTheDocument();
    // Like the Figma toasts, one that leaves by itself has no close button.
    expect(screen.queryByLabelText("Dismiss")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(screen.queryByRole("dialog", { name: "Decisions saved" })).toBeNull();
    vi.useRealTimers();
  });

  it("announces an error at once with its description; F6 reaches it and Escape closes it", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Fail" }));
    // Base UI mirrors the toast into a hidden live region; errors go to an alert region.
    const announcement = await screen.findByRole("alert");
    expect(announcement).toHaveTextContent("Something went wrong. Please try again.");
    expect(announcement).toHaveTextContent("Check your connection.");
    await userEvent.keyboard("{F6}");
    expect(screen.getByRole("region", { name: "Notifications" })).toHaveFocus();
    await userEvent.tab();
    // The toast stays out of the accessibility tree until focus enters the toasts, so it is not read twice.
    const toast = screen.getByRole("alertdialog");
    expect(toast).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("gives a toast that stays a close button, and its own icon", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    const toast = await screen.findByRole("dialog", { name: "Downloading..." });
    expect(toast.querySelector("svg.lucide-arrow-down-to-line")).not.toBeNull();
    await userEvent.click(screen.getByLabelText("Dismiss"));
    await vi.waitFor(() => expect(screen.queryByRole("dialog", { name: "Downloading..." })).toBeNull());
  });

  it("works from outside React through createToaster", async () => {
    const toaster = createToaster();
    render(
      <ToastProvider manager={toaster.manager}>
        <p>page</p>
      </ToastProvider>,
    );
    act(() => {
      toaster.info("Round 2 starts soon.");
    });
    expect((await screen.findAllByText("Round 2 starts soon.")).length).toBeGreaterThan(0);
  });

  it("has the Admin look by default and the player look on request", () => {
    expect(toastVariants({ tone: "danger" }).root()).toContain("p-(--toast-padding)");
    const player = toastVariants({ variant: "player", tone: "success" });
    expect(player.root()).toContain("inset-ring-(--toast-success-border-player)");
    expect(player.icon()).toContain("size-(--toast-ring-size)");
    expect(player.title()).toContain("font-semibold");
  });
});
