import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import { Card, Switch } from "../../src";

const meta = {
  title: "Components/Switch",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A setting that applies at once. Figma keeps the toggle hidden in the Create Simulation row, so the switch takes its 50 x 28 size and the forms' brand pink when on; off, a gray 500 track holds the white thumb, as controls need 3:1.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Today's Create Simulation row: the label first, the switch at the end of the slate panel. */
export const CreateSimulationRow: Story = {
  render: function Render() {
    const [hide, setHide] = useState(false);
    return (
      <Card className="max-w-xl">
        <div className="rounded-(--card-radius) bg-surface-panel p-5">
          <Switch
            label="Hide unselected segments and products"
            labelPosition="start"
            checked={hide}
            onCheckedChange={setHide}
            className="flex w-full justify-between"
          />
        </div>
      </Card>
    );
  },
};

/** Pressing the words flips the switch too: the whole row is its target. */
export const LabelFlips: Story = {
  tags: ["no-screenshot"],
  render: CreateSimulationRow.render,
  play: async ({ canvas }) => {
    const control = canvas.getByRole("switch", { name: "Hide unselected segments and products" });
    await userEvent.click(canvas.getByText("Hide unselected segments and products"));
    await expect(control).toHaveAttribute("aria-checked", "true");
  },
};

/** Off and on, disabled, and with a line under the label. */
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <Switch label="Off" />
      <Switch label="On" defaultChecked />
      <Switch label="Off, disabled" disabled />
      <Switch label="On, disabled" defaultChecked disabled />
      <Switch label="Reduce effects" description="Fewer animations, and no confetti when a round ends." defaultChecked />
    </div>
  ),
};
