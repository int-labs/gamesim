import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pencil } from "lucide-react";
import { expect, waitFor } from "storybook/test";
import { Avatar, Card, IconButton, Text } from "../../src";
import { anakinPicture as anakin, deltaPicture as delta } from "../support/pictures";

const meta = {
  title: "Components/Avatar",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A team's or a person's picture in a circle (Figma avatar07: the image alone, 46 px on the team cards). Without a picture, or while one fails to load, the name's initials show on brand indigo, as today's Admin team cards show the team's initial.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pictures arrive once loaded; the stories wait for them, so screenshots show them. */
async function picturesLoaded(canvasElement: HTMLElement, count: number) {
  await waitFor(() => expect(canvasElement.querySelectorAll("img")).toHaveLength(count));
}

/** 32, 40 and 46 px, with a picture and with initials. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div key={size} className="flex items-center gap-4">
          <Text as="span" variant="caption" tone="muted" className="w-6">
            {size}
          </Text>
          <Avatar name="Team Anakin" src={anakin} size={size} />
          <Avatar name="Team Anakin" size={size} />
          <Avatar name="Rido Hendrawan" size={size} />
          <Avatar name="สมชาย ใจดี" size={size} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await picturesLoaded(canvasElement, 3);
  },
};

function TeamCard({ name, id, src }: { name: string; id: string; src?: string }) {
  return (
    <Card className="w-72 flex-row items-start gap-3 rounded-lg p-2">
      <Avatar name={name} src={src} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Text variant="body-lg" tone="primary" truncate>
          {name}
        </Text>
        <Text variant="caption" tone="subtle" truncate>
          ID: {id}
        </Text>
      </div>
      <IconButton icon={Pencil} label={`Edit ${name}`} size="sm" />
    </Card>
  );
}

/** Today's team cards on the simulation page: the picture when the team has one, its initials when not. */
export const TeamCards: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <TeamCard name="Team Anakin" id="7f3a91" src={anakin} />
      <TeamCard name="Team Delta" id="2c81d0" src={delta} />
      <TeamCard name="Team Novabank" id="9b04e6" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await picturesLoaded(canvasElement, 2);
  },
};
