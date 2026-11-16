import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Button } from "../../primitives/button/Button";
import { ConfirmDialog, Dialog, DialogClose, DialogPopup, DialogTrigger, NoticeDialog } from "./Dialog";

describe("ConfirmDialog", () => {
  it("asks before the action, runs it, and closes when it succeeds", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button>Start Round</Button>}
        title="Start Round?"
        description="You're about to start the round. Once started, teams can make decisions in real time."
        confirmLabel="Start Round"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Start Round" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Start Round?" });
    expect(dialog).toHaveAccessibleDescription("You're about to start the round. Once started, teams can make decisions in real time.");
    await userEvent.click(screen.getAllByRole("button", { name: "Start Round" }).at(-1) as HTMLElement);
    expect(onConfirm).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("starts on Cancel when the action destroys something, and Escape closes it", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        defaultOpen
        tone="danger"
        title="Delete Event?"
        description="Are you sure you want to delete event? Deleted data cannot be restored."
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />,
    );
    await screen.findByRole("alertdialog", { name: "Delete Event?" });
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("allows a destructive action only once the name is typed", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        defaultOpen
        tone="danger"
        title="Delete simulation?"
        description="This removes the simulation, its teams and its rounds."
        confirmLabel="Delete"
        confirmationText="Novabank Growth Simulation"
        onConfirm={onConfirm}
      />,
    );
    const field = await screen.findByRole("textbox", { name: "Type Novabank Growth Simulation to confirm" });
    await vi.waitFor(() => expect(field).toHaveFocus());
    const remove = screen.getByRole("button", { name: "Delete" });
    expect(remove).toBeDisabled();
    await userEvent.type(field, "Novabank");
    expect(remove).toBeDisabled();
    await userEvent.type(field, " Growth Simulation");
    expect(remove).toBeEnabled();
    await userEvent.click(remove);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("stays open when the action fails, so it can be tried again", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="End Current Round"
        description="All team decisions will be locked."
        confirmLabel="End Round"
        onConfirm={onConfirm}
      />,
    );
    const end = await screen.findByRole("button", { name: "End Round" });
    await userEvent.click(end);
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await userEvent.click(end);
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
  });
});

describe("Dialog", () => {
  it("opens from its trigger, traps focus, and closes from inside", async () => {
    render(
      <Dialog>
        <DialogTrigger render={<Button>Change password</Button>} />
        <DialogPopup
          title="Change your password"
          description="Choose a new password to keep your account safe."
          footer={<DialogClose render={<Button variant="text">Cancel</Button>} />}
        >
          <input aria-label="New password" />
        </DialogPopup>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    const dialog = await screen.findByRole("dialog", { name: "Change your password" });
    await vi.waitFor(() => expect(screen.getByRole("textbox", { name: "New password" })).toHaveFocus());
    expect(dialog).toHaveAccessibleDescription("Choose a new password to keep your account safe.");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("NoticeDialog", () => {
  const renderNotice = (onAction = vi.fn()) => {
    render(
      <NoticeDialog
        open
        title="Round Ended"
        description="Round has ended and your decisions have been locked. No further changes can be made."
        actionLabel="Close"
        onAction={onAction}
      />,
    );
    return onAction;
  };

  it("tells the player what happened, with one action that takes it in", async () => {
    const onAction = renderNotice();
    const dialog = await screen.findByRole("alertdialog", { name: "Round Ended" });
    expect(dialog).toHaveAccessibleDescription("Round has ended and your decisions have been locked. No further changes can be made.");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("takes the same action on Escape", async () => {
    const onAction = renderNotice();
    await screen.findByRole("alertdialog", { name: "Round Ended" });
    await userEvent.keyboard("{Escape}");
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("stays open when the page behind it is clicked", async () => {
    const onAction = renderNotice();
    await screen.findByRole("alertdialog", { name: "Round Ended" });
    await userEvent.click(document.body);
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Round Ended" })).toBeInTheDocument();
  });
});
