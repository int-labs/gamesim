import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, KeyRound, Pencil, UserX } from "lucide-react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Card, IconButton, InfoTip, Text, Tooltip, TooltipProvider } from "../../src";
import { WhenFontsReady } from "../support/fonts";
import { expectTooltip } from "../support/tooltip";

const meta = {
  title: "Components/Tooltip",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The Figma tooltip (the KPI tooltip 2184:242826, the chart tooltip 3310:177953): gray 900, 8 px corners, 8/10 padding, SemiBold 14/20 white and a sharp beak, no shadow. It opens while the pointer rests on its anchor (100 ms, as today's MUI tooltips) or at once on keyboard focus, and Escape closes it.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each side, open; the beak points at the middle of its button. */
export const Sides: Story = {
  render: () => (
    <div className="grid grid-cols-2 place-items-center gap-y-24 px-40 py-20">
      <Tooltip content="Copy passkey" open describe={false}>
        <IconButton icon={Copy} label="Copy passkey" variant="outline" />
      </Tooltip>
      <Tooltip content="Edit team" side="bottom" open describe={false}>
        <IconButton icon={Pencil} label="Edit team" variant="outline" />
      </Tooltip>
      <Tooltip content="Change user password" side="right" open describe={false}>
        <IconButton icon={KeyRound} label="Change user password" variant="outline" />
      </Tooltip>
      <Tooltip content="Suspend user" side="left" open describe={false}>
        <IconButton icon={UserX} label="Suspend user" variant="outline" />
      </Tooltip>
    </div>
  ),
};

/**
 * Today's KPI pill, on the white KPI bar: an info button after the label explains the number
 * (InfoTip). It opens on hover, and a press or a tap keeps it open, so it works on a tablet too.
 * Longer text wraps at 280 px.
 */
export const KpiInfo: Story = {
  render: () => (
    <WhenFontsReady>
      <div className="flex justify-center pt-24">
        <Card className="flex-row">
          <div className="flex h-(--kpi-chip-height) items-center gap-2 rounded-(--kpi-chip-radius) bg-surface-panel px-(--kpi-chip-padding-x)">
            <Text as="span" variant="kpi-label" tone="body">
              CSAT
            </Text>
            <InfoTip label="About CSAT" defaultOpen>
              Customer Satisfaction score (CSAT) across the company
            </InfoTip>
            <Text as="span" variant="kpi-value" tone="primary">
              78.4
            </Text>
          </div>
        </Card>
      </div>
    </WhenFontsReady>
  ),
  play: async ({ canvas }) => {
    await expectTooltip("Customer Satisfaction score (CSAT) across the company");
    await expect(canvas.getByRole("button", { name: "About CSAT" })).toHaveAccessibleDescription(
      "Customer Satisfaction score (CSAT) across the company",
    );
  },
};

/** A tap on the info button keeps its explanation open (a tooltip does not open on a touch screen). */
export const InfoTipPressed: Story = {
  tags: ["no-screenshot"],
  render: () => (
    <div className="flex justify-center pt-24">
      <InfoTip label="About Risk Adjusted Profit">Total Risk Adjusted Profit across the company</InfoTip>
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "About Risk Adjusted Profit" });
    await userEvent.click(button);
    await expectTooltip("Total Risk Adjusted Profit across the company");
    await userEvent.unhover(button);
    await expectTooltip("Total Risk Adjusted Profit across the company");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Total Risk Adjusted Profit across the company", { selector: "[data-open]" })).not.toBeInTheDocument());
  },
};

/**
 * A control that is off for this person says why. A disabled button gets no pointer or focus
 * events, so this one stays focusable (focusableWhenDisabled) and is marked aria-disabled.
 */
export const DisabledReason: Story = {
  render: () => (
    <div className="flex justify-center pt-16">
      <Tooltip content="You cannot update your own status">
        <IconButton icon={UserX} label="Suspend user" variant="outline" disabled focusableWhenDisabled />
      </Tooltip>
    </div>
  ),
  play: async ({ canvas }) => {
    const suspend = canvas.getByRole("button", { name: "Suspend user" });
    await expect(suspend).toHaveAttribute("aria-disabled", "true");
    await expect(suspend).toHaveAccessibleDescription("You cannot update your own status");
    await userEvent.tab();
    await expect(suspend).toHaveFocus();
    await expectTooltip("You cannot update your own status");
  },
};

/** Tooltips side by side: after the first opens, the next opens as soon as the pointer reaches it. */
export const Grouped: Story = {
  tags: ["no-screenshot"],
  render: () => (
    <TooltipProvider>
      <div className="flex justify-center gap-2 pt-16">
        <Tooltip content="Copy passkey" describe={false}>
          <IconButton icon={Copy} label="Copy passkey" variant="outline" />
        </Tooltip>
        <Tooltip content="Edit team" describe={false}>
          <IconButton icon={Pencil} label="Edit team" variant="outline" />
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvas }) => {
    await userEvent.hover(canvas.getByRole("button", { name: "Copy passkey" }));
    await expectTooltip("Copy passkey");
    await userEvent.unhover(canvas.getByRole("button", { name: "Copy passkey" }));
    await userEvent.hover(canvas.getByRole("button", { name: "Edit team" }));
    await expectTooltip("Edit team");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Edit team", { selector: "[data-open]" })).not.toBeInTheDocument());
  },
};
