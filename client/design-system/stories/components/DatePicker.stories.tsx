import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { DatePicker, DateRangePicker, laterDay, type DayRange } from "../../src";
import { Code, DocPage, DocSection } from "../foundations/docs";

const meta = {
  title: "Components/Date picker",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// A fixed today, so the pictures do not change with the calendar.
const TODAY = "2026-09-24";

function GrantDates() {
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>("2026-12-31");
  const [days, setDays] = useState<DayRange>({ from: "2026-09-14", to: "2026-09-20" });
  return (
    <DocPage
      title="Date picker"
      intro={
        <>
          A day or a span of days from a calendar (Figma draws none: the field is the form select, the calendar sits on the select list&apos;s
          panel). Values are <Code>yyyy-mm-dd</Code> strings in local time, never shifted through UTC.
        </>
      }
    >
      <DocSection title="A grant's dates" description="Empty means now for the start and no end for the last day; min keeps both from the past.">
        <div className="grid max-w-3xl grid-cols-1 gap-6 rounded-2xl bg-surface-card p-6 md:grid-cols-2">
          <DatePicker
            label="Starts on"
            value={startsOn}
            onValueChange={setStartsOn}
            min={TODAY}
            today={TODAY}
            description="Leave empty to start now."
            messages={{ placeholder: "Starts now" }}
          />
          <DatePicker
            label="Last day of access"
            value={until}
            onValueChange={setUntil}
            min={laterDay(TODAY, startsOn ?? undefined)}
            today={TODAY}
            messages={{ placeholder: "No end date" }}
          />
        </div>
      </DocSection>
      <DocSection title="The audit's days" description="One calendar for a span: the first press sets the start, the second the end.">
        <div className="max-w-sm rounded-2xl bg-surface-card p-6">
          <DateRangePicker label="Days" value={days} onValueChange={setDays} today={TODAY} messages={{ placeholder: "Any day" }} />
        </div>
      </DocSection>
      <DocSection title="Invalid" description="The error under the field, read with it by screen readers.">
        <div className="max-w-sm rounded-2xl bg-surface-card p-6">
          <DatePicker label="Starts on" required value={null} onValueChange={() => {}} today={TODAY} error="Choose the day access starts" />
        </div>
      </DocSection>
    </DocPage>
  );
}

export const Fields: Story = {
  render: () => <GrantDates />,
};

/** The grant's two fields alone, for the open calendar below them. */
function GrantFields() {
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>("2026-12-31");
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6 rounded-2xl bg-surface-card p-6 md:grid-cols-2">
      <DatePicker label="Starts on" value={startsOn} onValueChange={setStartsOn} min={TODAY} today={TODAY} messages={{ placeholder: "Starts now" }} />
      <DatePicker
        label="Last day of access"
        value={until}
        onValueChange={setUntil}
        min={laterDay(TODAY, startsOn ?? undefined)}
        today={TODAY}
        messages={{ placeholder: "No end date" }}
      />
    </div>
  );
}

/** The calendar open on the last day of access: the chosen day filled, focus on it, the month's neighbours faded. */
export const Open: Story = {
  render: () => <GrantFields />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Last day of access 31 Dec 2026" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose a date" });
    await expect(within(dialog).getByRole("grid", { name: "December 2026" })).toBeInTheDocument();
    // Focus lands on the chosen day, ready for the arrow keys: once the calendar has opened, which a
    // busy machine can take a moment over.
    await waitFor(() => expect(within(dialog).getByRole("button", { name: /^Thursday, 31 December 2026, selected$/ })).toHaveFocus());
  },
};

function AuditDays() {
  const [days, setDays] = useState<DayRange>({ from: "2026-09-14", to: "2026-09-20" });
  return (
    <div className="max-w-sm rounded-2xl bg-surface-card p-6">
      <DateRangePicker label="Days" value={days} onValueChange={setDays} today={TODAY} messages={{ placeholder: "Any day" }} />
    </div>
  );
}

/** The audit's span: its ends filled, the days between on a pale indigo band, today in indigo. */
export const RangeOpen: Story = {
  render: () => <AuditDays />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Days 14 Sept 2026 to 20 Sept 2026" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose a date" });
    await expect(within(dialog).getByRole("grid", { name: "September 2026" })).toBeInTheDocument();
  },
};
