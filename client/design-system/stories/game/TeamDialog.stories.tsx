import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Button, TeamDialog, type TeamDetails } from "../../src";
import { figmaButtonContrastException } from "../support/a11y";
import { pickFile, pictureFile, teamPhoto } from "../support/pictures";

const meta = {
  title: "Game/Team dialog",
  parameters: {
    layout: "fullscreen",
    ...figmaButtonContrastException,
    docs: {
      description: {
        component:
          "The player's Edit Team Details (Figma 2110:245745): the profile photo with Change Photo and Delete, the team's name and leader, Cancel and Save. Change Photo opens the photo's own view: an avatar built from DiceBear, or the team's own photo cut to the circle. Delete draws a new DiceBear avatar, as Figma's note asks. Save hands the page the details: it uploads a photo through today's upload, saves the team through `PUT /api/teams/me` and shows the toast.",
      },
    },
  },
  // The Figma desktop frame, so the dialog sits on the page as in Figma.
  globals: { viewport: { value: "figma", isRotated: false } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const team = {
  name: "Team Anakin",
  leader: "Leader of Team Anakin",
  avatarUrl: "https://api.dicebear.com/10.x/thumbs/svg?seed=Team%20Anakin&backgroundColor=c0aede",
};

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function Page({ error, onSave }: { error?: string; onSave?: (details: TeamDetails) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit team
      </Button>
      <TeamDialog open={open} onOpenChange={setOpen} team={team} error={error} onSave={onSave ?? (() => wait(600))} />
    </div>
  );
}

/** Waits for DiceBear's avatars to be drawn, so screenshots show them. */
async function drawn(count: number) {
  await waitFor(() => expect(document.querySelectorAll('[role="dialog"] img[src^="data:image/svg+xml"]').length).toBeGreaterThanOrEqual(count), {
    timeout: 10_000,
  });
}

/** Figma's Edit Team Details, opened from the pencil on the team card. */
export const EditTeamDetails: Story = {
  render: () => <Page />,
  play: async () => {
    await expect(await screen.findByRole("dialog", { name: "Edit Team Details" })).toBeInTheDocument();
    await drawn(1);
  },
};

/** Save with the fields cleared: Figma's two messages, and nothing is saved. */
export const EmptyFields: Story = {
  render: () => <Page />,
  play: async () => {
    await userEvent.clear(await screen.findByRole("textbox", { name: "Team Name" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Team Leader" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await expect(screen.getByText("Team Name cannot be empty")).toBeInTheDocument();
    await expect(screen.getByText("Team Leader cannot be empty")).toBeInTheDocument();
    await drawn(1);
  },
};

/** Change Photo, on the avatar: DiceBear's styles, part by part. */
export const ChangePhotoAvatar: Story = {
  render: () => <Page />,
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Change Photo" }));
    await expect(await screen.findByRole("dialog", { name: "Change Photo" })).toBeInTheDocument();
    await drawn(12);
  },
};

/** Change Photo, the team's own photo: moved and zoomed into the circle. */
export const ChangePhotoUpload: Story = {
  render: () => <Page />,
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Change Photo" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Upload Photo" }));
    const input = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="file"]');
    if (!input) throw new Error("no file input");
    pickFile(input, await pictureFile(teamPhoto()));
    await waitFor(() => expect(document.querySelector('[role="dialog"] img[style*="--photo-zoom"]')).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await expect(screen.getByRole("button", { name: "Use Photo" })).toBeEnabled();
  },
};

/** The photo cut and waiting: it shows in the profile photo until Save uploads it. */
export const PhotoReady: Story = {
  render: () => <Page />,
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Change Photo" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Upload Photo" }));
    const input = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="file"]');
    if (!input) throw new Error("no file input");
    pickFile(input, await pictureFile(teamPhoto()));
    await waitFor(() => expect(document.querySelector('[role="dialog"] img[style*="--photo-zoom"]')).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Use Photo" }));
    await expect(await screen.findByRole("dialog", { name: "Edit Team Details" })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[role="dialog"] img[src^="blob:"]')).not.toBeNull());
  },
};

/** A name another team has: the page's message, and the dialog stays open. */
export const SaveError: Story = {
  render: () => <Page error="Another team in this simulation already has this name." />,
  play: async () => {
    await expect(await screen.findByText("Another team in this simulation already has this name.")).toBeInTheDocument();
    await drawn(1);
  },
};

/** On a phone. */
export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <Page />,
  play: async () => {
    await expect(await screen.findByRole("dialog", { name: "Edit Team Details" })).toBeInTheDocument();
    await drawn(1);
  },
};
