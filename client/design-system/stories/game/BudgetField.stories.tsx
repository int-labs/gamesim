import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import { BudgetField, DecisionPanel, DecisionRow, NumberFormatProvider } from "../../src";
import { submittedDecisionsContrastException } from "../support/a11y";

const meta = {
  title: "Game/Budget field",
  component: BudgetField,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "An amount under a shared budget (today's BudgetGuardedNumericInput, in the Mall's campaigns). The player types freely; past the cap the field turns red and shakes once, and the cap shows under it with Use max. Leaving the field keeps the amount when the page accepts it; otherwise the kept amount comes back and the cap stays for a few seconds. Figma draws no budget guard: the hint takes the \"Previous:\" line's italic.",
      },
    },
  },
} satisfies Meta<typeof BudgetField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The semester's budget, and what the team's other campaigns already spend of it. */
const BUDGET = 10_000_000;
const OTHER_CAMPAIGNS = 6_000_000;
const CHANNELS = [
  { name: "TV Advertising", about: "Airtime on national and regional channels." },
  { name: "Social Media", about: "Paid placements on social platforms." },
];

/** Two channels of a campaign sharing what is left of the budget: each one's cap is what the other leaves. */
function Campaign({ disabled = false, energyLeft = 20 }: { disabled?: boolean; energyLeft?: number }) {
  const [spend, setSpend] = useState([1_500_000, 0]);
  return (
    <NumberFormatProvider currency="THB">
      <DecisionPanel title="Brand Awareness Campaign" className="sm:w-(--decision-panel-width)">
        {CHANNELS.map((channel, index) => {
          const kept = spend[index]!;
          const cap = BUDGET - OTHER_CAMPAIGNS - spend.reduce((sum, amount, at) => (at === index ? sum : sum + amount), 0);
          return (
            <DecisionRow key={channel.name} label={channel.name} description={channel.about} disabled={disabled}>
              <BudgetField
                value={kept}
                cap={cap}
                showRoom={cap - kept < BUDGET}
                disabled={disabled}
                placeholder="Enter amount"
                onCommit={(next) => {
                  // A channel's first spend also takes 5 energy, as today's campaign items can.
                  if (kept === 0 && next > 0 && energyLeft < 5) return false;
                  if (next > cap) return false;
                  setSpend(spend.map((amount, at) => (at === index ? next : amount)));
                }}
              />
            </DecisionRow>
          );
        })}
      </DecisionPanel>
    </NumberFormatProvider>
  );
}

/** Part of the budget goes elsewhere: each field says how much more it can take. */
export const SharedBudget: Story = {
  args: { value: 0, onCommit: () => {} },
  render: () => <Campaign />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "TV Advertising" })).toHaveAccessibleDescription(/Up to ฿2,500,000 more/);
    await expect(canvas.getByRole("textbox", { name: "Social Media" })).toHaveAccessibleDescription(/Up to ฿2,500,000 more/);
  },
};

/** Typed past the cap: the field turns red and shakes once; the cap and Use max show under it. */
export const OverTheCap: Story = {
  args: { value: 0, onCommit: () => {} },
  render: () => <Campaign />,
  play: async ({ canvas }) => {
    const tv = canvas.getByRole("textbox", { name: "TV Advertising" });
    await userEvent.clear(tv);
    await userEvent.type(tv, "5000000");
    await expect(tv).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("button", { name: "Use max ฿4,000,000" })).toBeInTheDocument();
  },
};

/** Use max fills the field to its cap and hands the focus back to it; the other channel's room shrinks. */
export const UseMax: Story = {
  tags: ["no-screenshot"],
  args: { value: 0, onCommit: () => {} },
  render: () => <Campaign />,
  play: async ({ canvas }) => {
    const tv = canvas.getByRole("textbox", { name: "TV Advertising" });
    await userEvent.clear(tv);
    await userEvent.type(tv, "5000000{Enter}");
    await userEvent.click(canvas.getByRole("button", { name: "Use max ฿4,000,000" }));
    await expect(tv).toHaveValue("4,000,000");
    await expect(tv).toHaveFocus();
    await expect(canvas.getByRole("textbox", { name: "Social Media" })).toHaveAccessibleDescription(/Max ฿0/);
  },
};

/** A first spend the team has no energy for: the page refuses it, the amount goes back, and the cap stays a few seconds. */
export const Refused: Story = {
  tags: ["no-screenshot"],
  args: { value: 0, onCommit: () => {} },
  render: () => <Campaign energyLeft={0} />,
  play: async ({ canvas }) => {
    const social = canvas.getByRole("textbox", { name: "Social Media" });
    await userEvent.clear(social);
    await userEvent.type(social, "1000000{Enter}");
    await expect(social).toHaveValue("0");
    await expect(canvas.getByText("Max ฿2,500,000", { selector: "p" })).toBeInTheDocument();
  },
};

/** After Submit the fields dim with their rows and offer nothing to press. */
export const Submitted: Story = {
  args: { value: 0, onCommit: () => {} },
  parameters: submittedDecisionsContrastException,
  render: () => <Campaign disabled />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "TV Advertising" })).toBeDisabled();
  },
};
