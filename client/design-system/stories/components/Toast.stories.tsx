import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowDownToLine } from "lucide-react";
import { useEffect } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Button, ToastProvider, useToast, type ToastVariant } from "../../src";
import { Code, DocPage, DocSection } from "../foundations/docs";
import { toastA11yExceptions } from "../support/a11y";

const meta = {
  title: "Components/Toast",
  parameters: { layout: "padded", ...toastA11yExceptions },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Triggers() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast.success("Password updated successfully")}>
        Change password
      </Button>
      <Button variant="outline" onClick={() => toast.info("Downloading...", { icon: ArrowDownToLine })}>
        Download report
      </Button>
      <Button variant="outline" onClick={() => toast.error("Something went wrong. Please try again.")}>
        Fail to recalculate
      </Button>
      <Button variant="outline" onClick={() => toast.success("Downloading...", { icon: ArrowDownToLine, duration: 0 })}>
        Show one that stays
      </Button>
    </div>
  );
}

/** Real timings: news leaves after the Figma two seconds, errors after five; hovering or focusing the toasts holds them. */
export const Playground: Story = {
  tags: ["no-screenshot"],
  render: () => (
    <ToastProvider>
      <DocPage
        title="Toast"
        intro={
          <>
            A short message centred near the bottom of the window. Show one from a component with <Code>useToast()</Code>, or from anywhere with{" "}
            <Code>createToaster()</Code>. Errors are announced at once. F6 moves to the toasts, Escape closes the one in focus, and a swipe down
            or to the right dismisses one. Like the Figma toasts, one that leaves by itself has no close button; one that stays has.
          </>
        }
      >
        <DocSection title="Try them">
          <Triggers />
        </DocSection>
      </DocPage>
    </ToastProvider>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Fail to recalculate" }));
    // Announced through the live region at once.
    await expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    // A keyboard user jumps to the toasts with F6 and closes the one in focus with Escape.
    await userEvent.keyboard("{F6}");
    await expect(screen.getByRole("region", { name: "Notifications" })).toHaveFocus();
    await userEvent.tab();
    await expect(screen.getByRole("alertdialog")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  },
};

/** Shows the Figma toasts of one look and keeps them up for the screenshot (ten minutes, so no close button). */
function Showcase({ variant }: { variant: ToastVariant }) {
  const toast = useToast();
  useEffect(() => {
    const stay = { duration: 600_000 };
    const ids =
      variant === "admin"
        ? [
            toast.success("Recalculation complete. Data is up to date.", stay),
            toast.info("Downloading...", { ...stay, icon: ArrowDownToLine }),
            toast.error("Something went wrong. Please try again.", stay),
          ]
        : [toast.success("The event decision has been successfully made", stay), toast.error("You can only select one decision at a time.", stay)];
    return () => ids.forEach((id) => toast.close(id));
  }, [toast, variant]);
  return null;
}

/** The Admin toasts: the Preline soft alert, 16 px around a bare icon and a regular message. */
export const Admin: Story = {
  render: () => (
    <ToastProvider>
      <DocPage title="Admin toasts" intro="Success, info with its own icon, and an error, as the Figma Admin screens show them.">
        <Showcase variant="admin" />
      </DocPage>
    </ToastProvider>
  ),
  play: async () => {
    await expect(await screen.findByRole("dialog", { name: "Downloading..." })).toBeInTheDocument();
  },
};

/** The player toasts: a semibold message, the icon in a ringed circle, a stronger edge on success. */
export const Player: Story = {
  render: () => (
    <ToastProvider variant="player">
      <DocPage title="Player toasts" intro="The event decision confirmation and the single-choice warning of the Figma player screens.">
        <Showcase variant="player" />
      </DocPage>
    </ToastProvider>
  ),
  play: async () => {
    await expect(await screen.findByRole("dialog", { name: "The event decision has been successfully made" })).toBeInTheDocument();
  },
};
