import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Button, ConfirmDialog, Dialog, DialogClose, DialogPopup, NoticeDialog, PasswordField } from "../../src";
import { figmaButtonContrastException } from "../support/a11y";

const meta = {
  title: "Components/Dialog",
  parameters: { layout: "fullscreen", ...figmaButtonContrastException },
  // The Figma desktop frame, so the dialog sits on the page as in Figma.
  globals: { viewport: { value: "figma", isRotated: false } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** The Figma "Start Round?" confirmation. */
export const StartRound: Story = {
  render: () => (
    <ConfirmDialog
      defaultOpen
      title="Start Round?"
      description="You're about to start the round. Once started, teams can make decisions in real time."
      confirmLabel="Start Round"
      onConfirm={() => wait(600)}
    />
  ),
  play: async () => {
    await expect(await screen.findByRole("alertdialog", { name: "Start Round?" })).toBeInTheDocument();
  },
};

/** The Figma "Delete Event?": a red title and button, and focus starts on Cancel. */
export const DeleteEvent: Story = {
  render: () => (
    <ConfirmDialog
      defaultOpen
      tone="danger"
      title="Delete Event?"
      description="Are you sure you want to delete event? Deleted data cannot be restored."
      confirmLabel="Delete"
      onConfirm={() => wait(600)}
    />
  ),
  play: async () => {
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  },
};

/** Deleting a simulation asks for its name first. */
export const TypedConfirmation: Story = {
  render: () => (
    <ConfirmDialog
      defaultOpen
      tone="danger"
      title="Delete simulation?"
      description="This removes Novabank Growth Simulation with its teams and rounds. It cannot be undone."
      confirmLabel="Delete"
      confirmationText="Novabank Growth Simulation"
      onConfirm={() => wait(600)}
    />
  ),
  play: async () => {
    const field = await screen.findByRole("textbox", { name: "Type Novabank Growth Simulation to confirm" });
    await expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    await userEvent.type(field, "Novabank Growth Simulation");
    await expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  },
};

/** The player's Submit (Figma 2546:398374): the decisions lock once submitted. */
export const SubmitDecisions: Story = {
  render: () => (
    <ConfirmDialog
      defaultOpen
      title="Submit Your Decisions?"
      description="You're about to submit your decisions. Once submitted, decisions will be locked."
      confirmLabel="Submit"
      onConfirm={() => wait(600)}
    />
  ),
  play: async () => {
    await expect(await screen.findByRole("alertdialog", { name: "Submit Your Decisions?" })).toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  },
};

/** A notice the player takes in, as the round ends: its one action closes it. */
function RoundNotice({ actionLabel }: { actionLabel: string }) {
  const [open, setOpen] = useState(true);
  return (
    <NoticeDialog
      open={open}
      title="Round Ended"
      description="Round has ended and your decisions have been locked. No further changes can be made."
      actionLabel={actionLabel}
      onAction={() => setOpen(false)}
    />
  );
}

/** Figma's Round Ended (2546:398382), shown to every team when the facilitator ends a round. */
export const RoundEnded: Story = {
  render: () => <RoundNotice actionLabel="Close" />,
  play: async () => {
    await screen.findByRole("alertdialog", { name: "Round Ended" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
  },
};

/** After the last round the team stays and reads its results (Figma's 2546:398370 logs it out instead). */
export const FinalRoundEnded: Story = {
  render: () => <RoundNotice actionLabel="See final results" />,
  play: async () => {
    await screen.findByRole("alertdialog", { name: "Round Ended" });
    await expect(screen.getByRole("button", { name: "See final results" })).toBeInTheDocument();
  },
};

/** The Figma "Change your password", a dialog with a form. */
export const ChangePassword: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogPopup
        title="Change your password"
        description="Choose a new password to keep your account safe."
        footer={
          <>
            <DialogClose render={<Button variant="text">Cancel</Button>} />
            <Button>Change Password</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <PasswordField label="Current Password" required placeholder="Enter your current password..." />
          <PasswordField label="New Password" required placeholder="Enter your new password..." />
          <PasswordField label="Confirm New Password" required placeholder="Confirm your new password..." />
        </div>
      </DialogPopup>
    </Dialog>
  ),
  play: async () => {
    await expect(await screen.findByRole("dialog", { name: "Change your password" })).toBeInTheDocument();
  },
};
