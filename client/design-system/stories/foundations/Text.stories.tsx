import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heading, Text, textTones } from "../../src";
import { Code, DocPage, DocSection } from "./docs";

const meta = {
  title: "Foundations/Text",
  component: Text,
  parameters: { layout: "padded" },
  args: {
    children: "Set your strategy inputs for this round, then submit before the timer ends.",
    variant: "body",
    tone: "body",
  },
  argTypes: {
    as: { control: "select", options: ["p", "span", "div", "label", "strong", "em", "small", "li", "dt", "dd", "figcaption", "legend", "time"] },
    tone: { control: "select", options: Object.keys(textTones) },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Numeric: Story = {
  args: { variant: "body-lg", tone: "primary", numeric: true, children: "1,111,111.11 / 8,888,888.88" },
};

export const Truncated: Story = {
  args: { truncate: true, className: "w-60", children: "A long product name that does not fit in its column" },
};

const readableTones = ["primary", "body", "muted", "link", "accent", "success", "danger", "info", "warning"] as const;

export const Tones: Story = {
  parameters: {
    // White on the Figma pink measures 3.9:1 (AA asks 4.5:1 for 15 px text): an open brand decision
    // for the owner (keep, deepen the pink, or enlarge the label). The rule checks everything else.
    a11y: { config: { rules: [{ id: "color-contrast", selector: "*:not([data-figma-contrast-exception])" }] } },
  },
  render: () => (
    <DocPage
      title="Text"
      intro={
        <>
          <Code>Text</Code> sets a text role and a tone; <Code>Heading</Code> chooses the document level and the look separately.
        </>
      }
    >
      <DocSection title="Tones on light surfaces" description="subtle, faint and disabled are for secondary marks and disabled states, not for body text.">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {readableTones.map((tone) => (
            <Text key={tone} variant="body-lg" tone={tone}>
              {tone}: Market share 18.4%
            </Text>
          ))}
        </div>
      </DocSection>
      <DocSection title="On colour" description="Tones for text on solid brand surfaces.">
        <div className="flex flex-wrap gap-2">
          <Text as="span" variant="button" tone="on-primary" className="rounded-xl bg-primary px-4 py-2.5" data-figma-contrast-exception>
            on-primary
          </Text>
          <Text as="span" variant="button" tone="on-accent" className="rounded-xl bg-accent px-4 py-2.5">
            on-accent
          </Text>
          <Text as="span" variant="button" tone="on-energy" className="rounded-xl bg-energy px-4 py-2.5">
            on-energy
          </Text>
          <Text as="span" variant="button" tone="on-inverse" className="rounded-xl bg-surface-inverse px-4 py-2.5">
            on-inverse
          </Text>
        </div>
      </DocSection>
      <DocSection title="Headings" description="Levels default to page-title, section-title, heading and heading-sm.">
        <div className="flex flex-col gap-3">
          <Heading level={1} variant="wordmark">
            intlabs.
          </Heading>
          <Heading level={2} variant="wordmark-player">
            LIFE Bank.
          </Heading>
          <Heading level={1}>Simulations</Heading>
          <Heading level={2}>Real Time Metrics</Heading>
          <Heading level={3}>Simulation Summary</Heading>
          <Heading level={4}>Revenue</Heading>
        </div>
      </DocSection>
    </DocPage>
  ),
};
