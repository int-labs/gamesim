import type { Meta, StoryObj } from "@storybook/react-vite";
import { Filter } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { expect, screen, userEvent } from "storybook/test";
import { Button, DatePicker, Heading, Select, type DayString } from "../../src";
import { Code, DocPage, DocSection } from "../foundations/docs";

const meta = {
  title: "Components/Select",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// The events of the Figma Event panel.
const events = [
  { value: "trade-war", label: "Global Trade War Escalation" },
  { value: "fintech", label: "Fintech Disruption Launches New Product" },
  { value: "rates", label: "Central Bank Raises Interest Rates" },
  { value: "cyber", label: "Cyber Attack on Payment Systems", disabled: true },
];

function SelectFields() {
  const [event, setEvent] = useState<string | null>(null);
  const [rows, setRows] = useState<string | null>("10");
  return (
    <DocPage title="Select" intro="The Preline select of the Figma forms and filters: the field looks like an input, and the list opens below it.">
      <DocSection title="In a form">
        <div className="grid max-w-3xl grid-cols-1 gap-6 rounded-2xl bg-surface-panel p-5 md:grid-cols-2">
          <Select label="Select Event" required placeholder="Select Event..." options={events} value={event} onValueChange={setEvent} />
          <Select label="Round" placeholder="Choose a round" error="Choose the round the event applies to" options={[{ value: "1", label: "Round 1" }]} />
          <Select label="Scheduled event" options={events} defaultValue="rates" />
        </div>
      </DocSection>
      <DocSection
        title="Filled"
        description={
          <>
            The table footer&apos;s rows-per-page chip: slate, no edge, 38 px, as wide as its value. <Code>Pagination</Code> draws it with its
            label when given <Code>rowsPerPage</Code>.
          </>
        }
      >
        <div className="flex w-fit items-center rounded-2xl bg-surface-card p-4">
          <Select
            aria-label="Rows per page"
            variant="filled"
            size="sm"
            options={["10", "25", "50"].map((value) => ({ value, label: value }))}
            value={rows}
            onValueChange={setRows}
            className="w-auto"
          />
        </div>
      </DocSection>
    </DocPage>
  );
}

export const Fields: Story = {
  render: () => <SelectFields />,
};

/** The list open on the event select. */
export const Open: Story = {
  render: () => <SelectFields />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Select Event" }));
    await expect(await screen.findByRole("option", { name: "Fintech Disruption Launches New Product" })).toBeInTheDocument();
  },
};

const people = [
  { value: "anyone", label: "Anyone" },
  { value: "lead", label: "Team leads" },
  { value: "facilitator", label: "Facilitators" },
];

// Where the fields sit beside gray 400 controls, the toolbar gives them the controls' edge.
const controlsEdge = { "--color-line-field": "var(--color-line-control)" } as CSSProperties;

function ToolbarFilters({ raised }: { raised: boolean }) {
  const [who, setWho] = useState<string | null>(null);
  const [day, setDay] = useState<DayString | null>(null);
  const which = raised ? "raised" : "default";
  return (
    <div className="flex max-w-3xl flex-wrap items-end gap-3" style={raised ? controlsEdge : undefined}>
      <div className="max-w-(--table-search-width) flex-1">
        <Select size="md" aria-label={`Who, ${which} edge`} placeholder="Anyone" options={people} value={who} onValueChange={setWho} />
      </div>
      <div className="max-w-(--table-search-width) flex-1">
        <DatePicker size="md" aria-label={`Day, ${which} edge`} value={day} onValueChange={setDay} today="2026-09-29" messages={{ placeholder: "Any day" }} />
      </div>
      <Button variant="secondary" iconEnd={Filter}>
        Filter
      </Button>
    </div>
  );
}

/**
 * A field's idle edge is its own token, `--color-line-field`: Figma's gray 200, as `line`. Beside
 * gray 400 controls, as in a list toolbar next to its Filter button, the fields read as borderless
 * boxes, so the toolbar sets the token to the controls' edge; the page's dividers keep `line`.
 */
export const FieldEdge: Story = {
  render: () => (
    <DocPage title="The field edge" intro="A form field's idle edge, as its own token.">
      <DocSection title="Figma's edge" description="Gray 200, the edge of the Preline fields.">
        <ToolbarFilters raised={false} />
      </DocSection>
      <DocSection
        title="Beside gray 400 controls"
        description={
          <>
            The toolbar sets <Code>--color-line-field: var(--color-line-control)</Code>: the select and the date field take the Filter
            button&apos;s edge.
          </>
        }
      >
        <ToolbarFilters raised />
      </DocSection>
    </DocPage>
  ),
  play: async ({ canvas }) => {
    // An edge is a box shadow's ring: its colour is the shadow's one colour that is not see-through.
    const edge = (element: Element) =>
      (getComputedStyle(element).boxShadow.match(/rgba?\([^)]*\)/g) ?? []).find((colour) => !/^rgba\((?:[^,]+,){3}\s*0\)$/.test(colour));
    const [filter, filterRaised] = canvas.getAllByRole("button", { name: "Filter" });
    await expect(edge(canvas.getByRole("combobox", { name: "Who, raised edge" }))).toBe(edge(filterRaised!));
    await expect(edge(canvas.getByRole("combobox", { name: "Who, default edge" }))).not.toBe(edge(filter!));
  },
};

/** In a header row beside a button: `width="fit"` keeps the select as wide as its value, 160 px at least, instead of filling the row. */
export const InAHeaderRow: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-wrap items-center justify-between gap-3">
      <Heading level={2} variant="heading-sm" tone="body">
        Analysis
      </Heading>
      <div className="flex items-center gap-3">
        <Select
          width="fit"
          size="md"
          aria-label="Round"
          defaultValue="2"
          options={[
            { value: "1", label: "Round 1" },
            { value: "2", label: "Round 2" },
            { value: "3", label: "Round 3" },
          ]}
        />
        <Button variant="secondary">Export</Button>
      </div>
    </div>
  ),
};

/** The same row with the select's label shown: the field hugs its label and value, the button beside it. */
export const InAHeaderRowWithLabel: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-wrap items-end justify-between gap-3">
      <Heading level={2} variant="heading-sm" tone="body">
        Analysis
      </Heading>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          width="fit"
          size="md"
          label="Round"
          defaultValue="2"
          options={[
            { value: "1", label: "Round 1" },
            { value: "2", label: "Round 2" },
            { value: "3", label: "Round 3" },
          ]}
        />
        <Button variant="secondary">Export</Button>
      </div>
    </div>
  ),
  play: async ({ canvas }) => {
    const select = canvas.getByRole("combobox", { name: "Round" }).getBoundingClientRect();
    const button = canvas.getByRole("button", { name: "Export" }).getBoundingClientRect();
    // As wide as its value, and the button on its line, not pushed under it.
    await expect(select.width).toBeLessThan(260);
    await expect(select.right).toBeLessThan(button.left);
    await expect(Math.abs(select.bottom - button.bottom)).toBeLessThan(2);
  },
};
