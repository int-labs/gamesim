import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useState, type ReactNode } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { FormField, NumberField, PreviousValue, Text, type NumberFieldProps } from "../../src";

const meta = {
  title: "Components/Number field",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A player's number decision (Figma 2097:184137): 40 px, a brand indigo 40% edge outside the box, the value at the end, a currency's symbol at the start, and the last round's value under it. It keeps today's rules: a value that fits is kept at once; one that does not gets a message naming the limit after 300 ms, and leaving the field puts back the limit it broke.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A decision row as today's pages lay it out, in the Figma row's look: the label and its help, the field and its last value. */
function DecisionRow({
  label,
  help,
  previous,
  initial,
  ...field
}: Omit<NumberFieldProps, "value" | "onValueChange"> & { label: string; help: ReactNode; previous: string | null; initial: number }) {
  const [value, setValue] = useState(initial);
  const labelId = useId();
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line bg-surface-panel p-4 last:border-b-0">
      <div className="flex max-w-xs flex-col gap-1">
        <Text id={labelId} as="span" variant="body-lg" tone="primary" className="self-start rounded-lg bg-surface-hover px-2 py-1">
          {label}
        </Text>
        <Text as="span" variant="caption" tone="muted" className="ps-2">
          {help}
        </Text>
      </div>
      <div className="flex w-(--number-field-width) shrink-0 flex-col gap-1.5">
        <NumberField aria-labelledby={labelId} value={value} onValueChange={setValue} {...field} />
        <PreviousValue value={previous} />
      </div>
    </div>
  );
}

/** Today's decision types in the Figma look: money, a percentage (the round's key figure in pink), a plain number, and one closed after Submit. */
export const Decisions: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col overflow-hidden rounded-(--card-radius)">
      <DecisionRow
        label="Marketing Spend"
        help="What you spend on campaigns for this product this year."
        kind="currency"
        decimals={0}
        max={1_000_000}
        initial={250_000}
        previous="$200,000"
      />
      <DecisionRow
        label="Projected Market Share (%)"
        help="Estimated share of market that you plan to capture this year."
        kind="percent"
        decimals={1}
        fixedDecimals
        max={100}
        emphasis
        initial={0}
        previous="$5k"
      />
      <DecisionRow label="Branches" help="Branches open at the end of the year." decimals={0} min={1} max={500} initial={42} previous={null} />
      <DecisionRow
        label="Interest Rate (%)"
        help="Closed after Submit."
        kind="percent"
        decimals={2}
        initial={3.25}
        previous="3.10 %"
        disabled
      />
    </div>
  ),
};

/** Typed over the maximum: after 300 ms the field shakes and says the limit (Enter or leaving puts it back). */
export const OverTheLimit: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col overflow-hidden rounded-(--card-radius) pb-16">
      <DecisionRow
        label="Marketing Spend"
        help="Up to $1,000,000 this year."
        kind="currency"
        decimals={0}
        min={0}
        max={1_000_000}
        initial={250_000}
        previous="$200,000"
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const field = canvas.getByRole("textbox", { name: "Marketing Spend" });
    await userEvent.clear(field);
    await userEvent.type(field, "1500000");
    const message = await screen.findByRole("alert");
    await expect(message).toHaveTextContent("That's above the $1,000,000 limit. Enter a value between $0 and $1,000,000.");
    await waitFor(() => expect(message).toBeVisible());
  },
};

/** Leaving an entry over the limit puts the limit back and says so. */
export const ResetOnLeave: Story = {
  tags: ["no-screenshot"],
  render: OverTheLimit.render,
  play: async ({ canvas }) => {
    const field = canvas.getByRole("textbox", { name: "Marketing Spend" });
    await userEvent.clear(field);
    await userEvent.type(field, "2000000");
    await userEvent.keyboard("{Enter}");
    await expect(field).toHaveValue("1,000,000");
    await expect(await screen.findByRole("alert")).toHaveTextContent("The maximum is $1,000,000. Reset to $1,000,000.");
    await userEvent.keyboard("{Escape}");
  },
};

/** In an Admin form: the 47 px form field, labelled by FormField. */
export const InAForm: Story = {
  render: function Render() {
    const [value, setValue] = useState(5);
    return (
      <div className="max-w-sm">
        <FormField label="Total rounds" description="Between 1 and 10.">
          <NumberField variant="form" decimals={0} min={1} max={10} value={value} onValueChange={setValue} />
        </FormField>
      </div>
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Total rounds" })).toHaveAccessibleDescription("Between 1 and 10.");
  },
};
