import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Card, Figure, Figures } from "../../src";

const meta = {
  title: "Data/Figures",
  component: Figures,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The round's figures beside a decision (Figma's read-only list in the segment card, 864:34269): each label in 12/16 gray 600 and its value at the end in 14/20 gray 900; the total in bold. A description list, so each value is read with its label.",
      },
    },
  },
} satisfies Meta<typeof Figures>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Figma's list, 172 wide on the slate tile; a long label wraps and its value stays on one line. */
export const OnATile: Story = {
  args: { children: null },
  render: () => (
    <Card variant="container" className="w-fit">
      <div className="flex flex-col gap-6 rounded-2xl bg-surface-panel p-4">
        <Figures className="w-(--decision-figures-width)">
          <Figure label="Current Number of people:" value={99} />
          <Figure label="Estimated churn:" value={5} />
          <Figure label="Total People at Year-End:" value={1206} total />
        </Figures>
        <Figures className="w-(--decision-figures-width)">
          <Figure label="Projected customers after this round's campaigns:" value={48_200} />
          <Figure label="Average Salary" value="$104,000" total />
        </Figures>
      </div>
    </Card>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("term")).toHaveLength(5);
    await expect(canvas.getByText("1,206")).toBeInTheDocument();
  },
};
