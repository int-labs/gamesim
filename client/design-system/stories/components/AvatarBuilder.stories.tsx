import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Avatar, AvatarBuilder, Card, Text } from "../../src";

const meta = {
  title: "Components/Avatar builder",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Choosing a team's avatar from DiceBear's styles (dicebear.com), part by part: the avatar as it will look and Shuffle, the styles, a tab per part (hair, eyes, glasses...) with each variant drawn on the avatar itself, a tab per colour with the style's palette, and the background. Everything is drawn in the browser. The value is the DiceBear address the team keeps in `avatarUrl`, as today's apps already save one; `Avatar` draws such an address itself.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waits for the styles to arrive and draw, so screenshots show them. */
async function drawn(canvasElement: HTMLElement) {
  await waitFor(() => expect(canvasElement.querySelectorAll('img[src^="data:image/svg+xml"]').length).toBeGreaterThan(12), { timeout: 10_000 });
}

function Builder({ initial, seed = "Team Anakin" }: { initial?: string; seed?: string }) {
  const [url, setUrl] = useState<string | null>(initial ?? null);
  return (
    <Card className="max-w-4xl">
      <AvatarBuilder seed={seed} value={url} onValueChange={setUrl} />
      <Text variant="caption" tone="subtle" className="break-all">
        {url ?? "No avatar yet: the team starts from its name."}
      </Text>
    </Card>
  );
}

/** A team without an avatar starts from its name, in Thumbs, as today's fallback. */
export const NewTeam: Story = {
  render: () => <Builder />,
  play: async ({ canvasElement }) => {
    await drawn(canvasElement);
  },
};

/** A team's saved avatar opens on its style and choices: here Adventurer, with its hair open. */
export const SavedAvatar: Story = {
  render: () => <Builder initial="https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin&backgroundColor=c0aede&hairVariant=long03" />,
  play: async ({ canvasElement }) => {
    await drawn(canvasElement);
    await userEvent.click(within(canvasElement).getByRole("tab", { name: "Hair" }));
    await expect(within(canvasElement).getByRole("radio", { name: "Option 3" })).toBeChecked();
  },
};

/** Colours: the style's own palette as swatches. */
export const Colours: Story = {
  render: () => <Builder initial="https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin&skinColor=ecad80" />,
  play: async ({ canvasElement }) => {
    await drawn(canvasElement);
    await userEvent.click(within(canvasElement).getByRole("tab", { name: "Skin colour" }));
    await expect(within(canvasElement).getByRole("radio", { name: "Colour 2" })).toBeChecked();
  },
};

/** On a phone the avatar sits above the choices. */
export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <Builder initial="https://api.dicebear.com/10.x/lorelei/svg?seed=Team%20Delta&backgroundColor=ffd5dc" seed="Team Delta" />,
  play: async ({ canvasElement }) => {
    await drawn(canvasElement);
  },
};

/** Avatar draws a saved DiceBear address itself: no request to DiceBear. */
export const OnTeamCards: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {[
        { name: "Team Anakin", src: "https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin&backgroundColor=c0aede&hairVariant=long03" },
        { name: "Team Delta", src: "https://api.dicebear.com/10.x/lorelei/svg?seed=Team%20Delta&backgroundColor=ffd5dc" },
        { name: "Team Novabank", src: "https://api.dicebear.com/10.x/fun-emoji/svg?seed=Team%20Novabank&backgroundColor=b6e3f4" },
      ].map((team) => (
        <Card key={team.name} className="w-64 flex-row items-center gap-3 rounded-lg p-2">
          <Avatar name={team.name} src={team.src} />
          <Text variant="body-lg" tone="primary" truncate>
            {team.name}
          </Text>
        </Card>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('img[src^="data:image/svg+xml"]')).toHaveLength(3), { timeout: 10_000 });
  },
};
