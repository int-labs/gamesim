import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi, type Mock } from "vitest";
import { TeamDialog, type TeamDetails } from "./TeamDialog";

const team = { name: "Team Anakin", leader: "Leader of Team Anakin", avatarUrl: "https://api.dicebear.com/9.x/thumbs/svg?seed=Team%20Anakin" };

type Save = (details: TeamDetails) => Promise<void>;
const saveSpy = (impl: Save = () => Promise.resolve()) => vi.fn<Save>(impl);
const saved = (spy: Mock<Save>) => spy.mock.calls.at(-1)?.[0];

/** The page: a pencil opens the dialog, as the team card's does. */
function Page({ onSave, error }: { onSave: Save; error?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit team
      </button>
      <TeamDialog open={open} onOpenChange={setOpen} team={team} onSave={onSave} error={error} />
    </>
  );
}

describe("TeamDialog", () => {
  it("opens on the team's details, as Figma's Edit Team Details", () => {
    render(<Page onSave={saveSpy()} />);
    expect(screen.getByRole("dialog", { name: "Edit Team Details" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Team Name" })).toHaveValue("Team Anakin");
    expect(screen.getByRole("textbox", { name: "Team Leader" })).toHaveValue("Leader of Team Anakin");
    expect(screen.getByRole("button", { name: "Change Photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("saves the trimmed name and leader, keeps the avatar, and closes", async () => {
    const user = userEvent.setup();
    const onSave = saveSpy();
    render(<Page onSave={onSave} />);
    const name = screen.getByRole("textbox", { name: "Team Name" });
    await user.clear(name);
    await user.type(name, "  Team Skywalker ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saved(onSave)).toEqual({ teamName: "Team Skywalker", teamLeader: "Leader of Team Anakin", avatar: { kind: "keep" } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refuses an empty name or leader with Figma's messages", async () => {
    const user = userEvent.setup();
    const onSave = saveSpy();
    render(<Page onSave={onSave} />);
    await user.clear(screen.getByRole("textbox", { name: "Team Name" }));
    await user.clear(screen.getByRole("textbox", { name: "Team Leader" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Team Name cannot be empty")).toBeInTheDocument();
    expect(screen.getByText("Team Leader cannot be empty")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Delete draws a new DiceBear avatar, as Figma's note asks", async () => {
    const user = userEvent.setup();
    const onSave = saveSpy();
    render(<Page onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const avatar = saved(onSave)?.avatar;
    expect(avatar?.kind).toBe("avatar");
    expect(avatar?.kind === "avatar" && avatar.url).toMatch(/^https:\/\/api\.dicebear\.com\/10\.x\/thumbs\/svg\?seed=/);
  });

  it("builds an avatar in Change Photo, and saves it as its address", async () => {
    const user = userEvent.setup();
    const onSave = saveSpy();
    render(<Page onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Change Photo" }));
    expect(screen.getByRole("dialog", { name: "Change Photo" })).toBeInTheDocument();
    await user.click(await screen.findByRole("radio", { name: "Adventurer" }));
    await user.click(screen.getByRole("button", { name: "Use Avatar" }));
    expect(screen.getByRole("dialog", { name: "Edit Team Details" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saved(onSave)?.avatar).toEqual({ kind: "avatar", url: "https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin" });
  });

  it("Back leaves the avatar as it was", async () => {
    const user = userEvent.setup();
    const onSave = saveSpy();
    render(<Page onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Change Photo" }));
    await user.click(await screen.findByRole("radio", { name: "Adventurer" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(saved(onSave)?.avatar).toEqual({ kind: "keep" });
  });

  it("stays open when the save fails, and the page says why", async () => {
    const user = userEvent.setup();
    const onSave = saveSpy(() => Promise.reject(new Error("taken")));
    const { rerender } = render(<Page onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    rerender(<Page onSave={onSave} error="Another team already has this name." />);
    expect(screen.getByRole("dialog", { name: "Edit Team Details" })).toBeInTheDocument();
    expect(screen.getByText("Another team already has this name.")).toBeInTheDocument();
  });

  it("puts the focus on the team's name, and back on Change Photo after the photo's view", async () => {
    const user = userEvent.setup();
    render(<Page onSave={saveSpy()} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Team Name" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Change Photo" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Avatar" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Change Photo" })).toHaveFocus());
  });

  it("opens afresh each time: a closed dialog forgets what was typed", async () => {
    const user = userEvent.setup();
    render(<Page onSave={saveSpy()} />);
    await user.type(screen.getByRole("textbox", { name: "Team Name" }), " Two");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Edit team" }));
    expect(await screen.findByRole("textbox", { name: "Team Name" })).toHaveValue("Team Anakin");
  });
});
