import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen } from "storybook/test";
import { RoundStarting } from "../../src";

const meta = {
  title: "Game/Round starting",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The screen every team sees for a few seconds while the facilitator opens the next round (Figma 2546:398410): the page covered in slate, Figma's drawing and the words. It holds the page's focus, and nothing closes it but the game.",
      },
    },
  },
  // The Figma desktop frame.
  globals: { viewport: { value: "figma", isRotated: false } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Figma's interstitial between two rounds. */
export const NewRound: Story = {
  render: () => <RoundStarting open title="New round is starting!" />,
  play: async () => {
    const cover = await screen.findByRole("dialog", { name: "New round is starting!" });
    await expect(cover.querySelector("svg")).not.toBeNull();
  },
};

/** On a phone the words wrap under the drawing. */
export const Phone: Story = {
  render: () => <RoundStarting open title="New round is starting!" />,
  globals: { viewport: { value: "phone", isRotated: false } },
  play: async () => {
    await expect(await screen.findByRole("heading", { name: "New round is starting!" })).toBeInTheDocument();
  },
};
