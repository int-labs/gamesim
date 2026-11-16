import type { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "../../src";
import { Code, DocPage, DocSection, tokensUnder } from "./docs";

const meta = {
  title: "Foundations/Spacing",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function classKey(tokenName: string, group: string): string {
  return tokenName.slice(group.length + 1).replace("_", ".");
}

export const Scale: Story = {
  render: () => (
    <DocPage
      title="Spacing"
      intro={
        <>
          The Figma file's 4 px steps, named as in Tailwind (<Code>p-4</Code> is 16 px, <Code>gap-2.5</Code> is 10 px). Off-scale values such as{" "}
          <Code>p-13</Code> do not exist, and arbitrary values fail lint.
        </>
      }
    >
      <DocSection title="Scale" description="Padding, margin, gap, width, height and inset all use this scale.">
        <div className="flex flex-col gap-2">
          {tokensUnder("spacing.").map((token) => (
            <div key={token.name} className="grid grid-cols-12 items-center gap-4">
              <Text as="div" variant="label" tone="primary" className="col-span-2">
                <Code>{classKey(token.name, "spacing")}</Code>
              </Text>
              <Text as="div" variant="caption" tone="muted" className="col-span-2">
                {token.value}
              </Text>
              <div className="col-span-8">
                <div className="h-4 rounded-xs bg-accent-secondary" style={{ width: `var(${token.cssVariable ?? ""})` }} aria-hidden />
              </div>
            </div>
          ))}
        </div>
      </DocSection>
    </DocPage>
  ),
};

export const Radius: Story = {
  render: () => (
    <DocPage
      title="Radius"
      intro="Corner radii from the final screens: 6 for badges, 8 for inputs, 12 for buttons, 16 for cards, 24 for summary cards and modals, 32 for large containers."
    >
      <DocSection title="Scale">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {tokensUnder("radius.").map((token) => (
            <div key={token.name} className="flex flex-col gap-2">
              <div
                className="size-24 border-2 border-accent bg-accent-soft"
                style={{ borderRadius: `var(${token.cssVariable ?? ""})` }}
                aria-hidden
              />
              <Text variant="label" tone="primary">
                <Code>{`rounded-${classKey(token.name, "radius")}`}</Code>
              </Text>
              <Text variant="caption" tone="muted">
                {token.value}
              </Text>
            </div>
          ))}
        </div>
      </DocSection>
    </DocPage>
  ),
};

export const Layout: Story = {
  render: () => (
    <DocPage
      title="Layout"
      intro="Breakpoints, containers and the measurements of the app shells (component tokens, read as CSS variables)."
    >
      <DocSection title="Breakpoints" description="Mobile first: md: applies from 768 px. The Figma frames are 1440 wide.">
        <div className="flex flex-wrap gap-4">
          {tokensUnder("breakpoint.").map((token) => (
            <Text key={token.name} as="div" variant="label" tone="primary" className="rounded-lg border border-line bg-surface-card px-3 py-2">
              <Code>{`${classKey(token.name, "breakpoint")}:`}</Code> {token.value}
            </Text>
          ))}
        </div>
      </DocSection>
      <DocSection title="App shell">
        <div className="flex flex-col gap-1">
          {[...tokensUnder("component.sidebar."), ...tokensUnder("component.kpi-bar."), ...tokensUnder("component.page."), ...tokensUnder("component.card.")].map(
            (token) => (
              <Text key={token.name} as="div" variant="body" tone="body">
                <Code>{token.cssVariable}</Code> {token.value}
                {token.description ? <Text as="span" variant="caption" tone="muted">{`: ${token.description}`}</Text> : null}
              </Text>
            ),
          )}
        </div>
      </DocSection>
    </DocPage>
  ),
};
