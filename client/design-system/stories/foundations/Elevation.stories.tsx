import type { Meta, StoryObj } from "@storybook/react-vite";
import { cn, Text } from "../../src";
import { Code, DocPage, DocSection, tokensUnder } from "./docs";

const meta = {
  title: "Foundations/Elevation",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Literal class names, so Tailwind sees them.
const shadowClasses: Record<string, string> = {
  xs: "shadow-xs",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  card: "shadow-card",
  thumb: "shadow-thumb",
  modal: "shadow-modal",
};

const dropShadowClasses: Record<string, string> = {
  glow: "drop-shadow-glow",
  "glow-strong": "drop-shadow-glow-strong",
};

const insetClasses: Record<string, string> = {
  glass: "inset-shadow-glass",
  highlight: "inset-shadow-highlight",
};

const gradientClasses: Record<string, string> = {
  wordmark: "bg-gradient-wordmark",
  sheen: "bg-gradient-sheen",
  "sheen-hover": "bg-gradient-sheen-hover",
  rim: "bg-gradient-rim",
  glow: "bg-gradient-glow",
  indigo: "bg-gradient-indigo",
  "chart-area-blue": "bg-gradient-chart-area-blue",
  "chart-area-teal": "bg-gradient-chart-area-teal",
};

function last(name: string): string {
  return name.split(".").pop() ?? name;
}

export const Shadows: Story = {
  render: () => (
    <DocPage title="Elevation" intro="Shadows lift surfaces off the page; inner shadows make the glass of the modal shell and the rim of solid buttons.">
      <DocSection title="Shadows" description="xs to lg are Preline's; card, thumb and modal come from the Figma file.">
        <div className="grid grid-cols-2 gap-8 bg-surface-page p-8 md:grid-cols-3">
          {tokensUnder("shadow.").map((token) => (
            <div key={token.name} className="flex flex-col gap-2">
              <div className={cn("h-20 rounded-2xl bg-surface-card", shadowClasses[last(token.name)])} aria-hidden />
              <Text variant="label" tone="primary">
                <Code>{`shadow-${last(token.name)}`}</Code>
              </Text>
              <Text variant="caption" tone="muted">
                {token.description}
              </Text>
            </div>
          ))}
        </div>
      </DocSection>
      <DocSection title="Inner shadows">
        <div className="grid grid-cols-2 gap-8 bg-accent p-8">
          {tokensUnder("inset-shadow.").map((token) => (
            <div key={token.name} className="flex flex-col gap-2">
              <div className={cn("h-20 rounded-2xl bg-accent-secondary", insetClasses[last(token.name)])} aria-hidden />
              <Text variant="label" tone="on-accent">
                <Code>{`inset-shadow-${last(token.name)}`}</Code>
              </Text>
            </div>
          ))}
        </div>
      </DocSection>
      <DocSection title="Drop shadows" description="Shadows that follow the shape of the content: the cyan glow around a solid button's label, stronger while it loads.">
        <div className="grid grid-cols-2 gap-8 bg-primary p-8">
          {tokensUnder("drop-shadow.").map((token) => (
            <div key={token.name} className="flex flex-col gap-2">
              <p className={cn("type-section-title text-fg-on-primary", dropShadowClasses[last(token.name)])}>Submit</p>
              <Text variant="label" tone="on-primary">
                <Code>{`drop-shadow-${last(token.name)}`}</Code>
              </Text>
            </div>
          ))}
        </div>
      </DocSection>
      <DocSection title="Blur" description="Background blur for the modal underlay (overlay, 40 px) and the button glow (38 px).">
        <div className="flex flex-wrap gap-4">
          {tokensUnder("blur.").map((token) => (
            <Text key={token.name} as="div" variant="label" tone="primary" className="rounded-lg border border-line bg-surface-card px-3 py-2">
              <Code>{`blur-${last(token.name)}`}</Code> {token.value}
            </Text>
          ))}
        </div>
      </DocSection>
    </DocPage>
  ),
};

export const Gradients: Story = {
  render: () => (
    <DocPage title="Gradients" intro="Named gradients from the Figma file, as bg-gradient-* utilities.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tokensUnder("gradient.").map((token) => (
          <div key={token.name} className="flex flex-col gap-2">
            <div className={cn("h-20 rounded-2xl border border-line-subtle bg-accent", gradientClasses[last(token.name)])} aria-hidden />
            <Text variant="label" tone="primary">
              <Code>{`bg-gradient-${last(token.name)}`}</Code>
            </Text>
            <Text variant="caption" tone="muted">
              {token.description}
            </Text>
          </div>
        ))}
      </div>
    </DocPage>
  ),
};
