import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AvatarPicker, Card, Text, type AvatarChoice } from "../../src";
import { pickFile, pictureFile, teamPhoto } from "../support/pictures";

const meta = {
  title: "Components/Avatar picker",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A team's avatar, two ways: an avatar built from DiceBear part by part (the avatar builder), or the team's own photo, picked or dropped, then moved, zoomed and turned into the circle (the photo cropper). The page learns the choice as it changes; `photoOf` draws a photo's crop for today's upload, and an avatar is saved as its DiceBear address.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Picker({ current }: { current?: string }) {
  const [choice, setChoice] = useState<AvatarChoice | null>(null);
  return (
    <Card className="max-w-4xl">
      <AvatarPicker seed="Team Anakin" current={current} onChoiceChange={setChoice} />
      <Text variant="caption" tone="subtle" className="break-all">
        {choice ? (choice.kind === "avatar" ? choice.url : `A photo, cut at zoom ${choice.crop.zoom}`) : "Nothing picked yet."}
      </Text>
    </Card>
  );
}

/** A team without an avatar opens on the builder, drawn from its name. */
export const Avatar: Story = {
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('img[src^="data:image/svg+xml"]').length).toBeGreaterThan(12), { timeout: 10_000 });
  },
};

/** A team with its own photo opens on Upload Photo: drop a photo, or choose one. */
export const UploadPhoto: Story = {
  render: () => <Picker current="https://res.cloudinary.com/demo/image/upload/team.webp" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("radio", { name: "Upload Photo" })).toBeChecked();
  },
};

/** A photo picked: the team moves and zooms it into the circle. */
export const PhotoPicked: Story = {
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Upload Photo" }));
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    pickFile(input, await pictureFile(teamPhoto()));
    await waitFor(() => expect(canvasElement.querySelector('img[style*="--photo-zoom"]')).not.toBeNull());
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await expect(canvas.getByText("A photo, cut at zoom 1.25")).toBeInTheDocument();
  },
};
