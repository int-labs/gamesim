import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "../../src";
import { Code, DocPage, DocSection, tokensUnder, type TokenRow } from "./docs";

const meta = {
  title: "Foundations/Colours",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ token }: { token: TokenRow }) {
  const name = token.name.replace(/^(?:color|palette)\./, "").replace(/\.DEFAULT$/, "");
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-14 rounded-xl border border-line-subtle"
        style={{ background: `var(${token.cssVariable ?? ""})` }}
        aria-hidden
      />
      <div className="flex flex-col">
        <Text variant="label" tone="primary" weight="semibold">
          {name}
        </Text>
        <Text as="div" variant="caption" tone="muted">
          <Code>{token.cssVariable}</Code>
        </Text>
        <Text as="div" variant="caption" tone="muted">
          {token.reference ?? token.value}
        </Text>
      </div>
    </div>
  );
}

function SwatchGrid({ prefix }: { prefix: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
      {tokensUnder(prefix).map((token) => (
        <Swatch key={token.name} token={token} />
      ))}
    </div>
  );
}

const SEMANTIC_GROUPS = [
  { prefix: "color.surface.", title: "Surfaces", description: "Backgrounds: bg-surface-*." },
  { prefix: "color.fg.", title: "Text and icons", description: "Foreground colours: text-fg-*. Text uses Text's tone prop." },
  { prefix: "color.line.", title: "Lines", description: "Borders, dividers and outlines: border-line-*." },
  { prefix: "color.primary", title: "Primary (brand pink)", description: "Primary actions, links, the active accent." },
  { prefix: "color.accent", title: "Accent (brand indigo)", description: "Selection, secondary emphasis, the wordmark's partner." },
  { prefix: "color.energy", title: "Energy (brand yellow)", description: "Energy, the Start Round action." },
  { prefix: "color.success", title: "Success", description: "Positive deltas, done states, success alerts." },
  { prefix: "color.danger", title: "Danger", description: "Negative deltas, errors, destructive actions, End Round." },
  { prefix: "color.info", title: "Info", description: "Neutral notices." },
  { prefix: "color.warning", title: "Warning", description: "Cautions." },
  { prefix: "color.neutral", title: "Neutral", description: "Soft grey badges." },
  { prefix: "color.focus-ring", title: "Focus", description: "The keyboard focus outline." },
  { prefix: "color.chart", title: "Charts", description: "Series 1 to 8 in order, grid, axis and labels." },
];

export const Semantic: Story = {
  render: () => (
    <DocPage
      title="Colours"
      intro="Components use these semantic colours only. Each one points at a palette colour, so a theme can change the meaning without touching components."
    >
      {SEMANTIC_GROUPS.map((group) => (
        <DocSection key={group.prefix} title={group.title} description={group.description}>
          <SwatchGrid prefix={group.prefix} />
        </DocSection>
      ))}
    </DocPage>
  ),
};

const PALETTE_GROUPS = [
  "brand",
  "white",
  "black",
  "soft",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];

export const Palette: Story = {
  render: () => (
    <DocPage
      title="Palette"
      intro="The primitive colours of the Figma file (its Tailwind v3 values, the custom blue 500 to 700, gray 50 as slate 50, and the brand colours). They are CSS variables only: components never use them directly."
    >
      {PALETTE_GROUPS.filter((group) => tokensUnder(`palette.${group}.`).length > 0).map((group) => (
        <DocSection key={group} title={group}>
          <SwatchGrid prefix={`palette.${group}.`} />
        </DocSection>
      ))}
    </DocPage>
  ),
};
