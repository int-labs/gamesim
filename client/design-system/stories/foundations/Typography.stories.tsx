import type { Meta, StoryObj } from "@storybook/react-vite";
import { cn, Text, tokens } from "../../src";
import { Code, DocPage, DocSection, Specimen, tokensUnder } from "./docs";

const meta = {
  title: "Foundations/Typography",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLES: Record<string, string> = {
  wordmark: "intlabs.",
  "wordmark-player": "LIFE Bank.",
  "page-title": "Novabank Growth Simulation",
  "modal-title": "Start Round?",
  "section-title": "Real Time Metrics",
  "panel-title": "Set Your Strategy Inputs",
  heading: "Simulation Summary",
  "heading-sm": "Revenue",
  tab: "Round-2",
  "kpi-label": "Market Share",
  "kpi-value": "$3,000M",
  stat: "128",
  timer: "04:59",
  interstitial: "New round is starting!",
  "body-lg": "Retail Mass customers value low fees and a wide branch network.",
  body: "Set your strategy inputs for this round, then submit before the timer ends.",
  label: "Current Password*",
  button: "New Simulation",
  caption: "team-07@intlabs.com",
  badge: "ACTIVE",
  overline: "Simulation management",
  hint: "Previous: $5k",
  "modal-body": "Choose a new password for your account.",
};

// Literal class names, so Tailwind sees every role in this file.
const roleClasses: Record<string, string> = {
  wordmark: "w-fit type-wordmark bg-gradient-wordmark bg-clip-text text-transparent",
  "wordmark-player": "w-fit type-wordmark-player bg-gradient-wordmark bg-clip-text text-transparent",
  "page-title": "type-page-title",
  "modal-title": "type-modal-title",
  "section-title": "type-section-title",
  "panel-title": "type-panel-title",
  heading: "type-heading",
  "heading-sm": "type-heading-sm",
  tab: "type-tab",
  "kpi-label": "type-kpi-label",
  "kpi-value": "type-kpi-value",
  stat: "type-stat",
  timer: "type-timer",
  interstitial: "type-interstitial",
  "body-lg": "type-body-lg",
  body: "type-body",
  label: "type-label",
  button: "type-button",
  caption: "type-caption",
  badge: "type-badge",
  overline: "type-overline",
  hint: "type-hint",
  "modal-body": "type-modal-body",
};

export const Roles: Story = {
  render: () => (
    <DocPage
      title="Typography"
      intro={
        <>
          Text roles set family, size, weight, line height and letter spacing together: the <Code>type-*</Code> utilities, or the
          variant prop of Text and Heading. Poppins for titles and numbers, Source Sans 3 for everything else.
        </>
      }
    >
      <DocSection title="Roles" description="From the final Figma screens (research 08f, section 5).">
        <div className="flex flex-col gap-4">
          {tokensUnder("typography.").map((token) => {
            const role = token.name.slice("typography.".length);
            const detail = tokens.typography[role as keyof typeof tokens.typography];
            return (
              <Specimen
                key={role}
                label={<Code>{`type-${role}`}</Code>}
                meta={`${detail.fontFamily.startsWith("Poppins") ? "Poppins" : "Source Sans 3"} ${detail.fontWeight}, ${detail.fontSize} / ${detail.lineHeight}, tracking ${detail.letterSpacing}. ${token.description ?? ""}`}
              >
                <p className={cn("text-fg-primary", roleClasses[role])}>
                  {SAMPLES[role] ?? role}
                </p>
              </Specimen>
            );
          })}
        </div>
      </DocSection>
    </DocPage>
  ),
};

const WEIGHTS = ["light", "normal", "medium", "semibold", "extrabold", "black"] as const;
const weightClasses = {
  extralight: "font-extralight",
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  extrabold: "font-extrabold",
  black: "font-black",
} as const;

export const Families: Story = {
  render: () => (
    <DocPage
      title="Font families"
      intro="Self-hosted with Fontsource. Each web font is followed by a metric-matched fallback, so text does not move when the font arrives. Thai text falls back to Noto Sans Thai."
    >
      <DocSection title="Source Sans 3" description="All UI text and tables. One variable file, weights 200 to 900; digits are tabular.">
        <div className="flex flex-col gap-2">
          {(["extralight", "light", "normal", "semibold", "bold", "black"] as const).map((weight) => (
            <p key={weight} className={cn("font-body text-2xl text-fg-primary", weightClasses[weight])}>
              {weight} 1,234,567.89 Market share
            </p>
          ))}
        </div>
      </DocSection>
      <DocSection title="Poppins" description="Titles, tabs, KPI numbers and wordmarks. Static files for the weights the design uses; digits are proportional.">
        <div className="flex flex-col gap-2">
          {WEIGHTS.map((weight) => (
            <p key={weight} className={cn("font-display text-2xl text-fg-primary", weightClasses[weight])}>
              {weight} 1,234,567.89 Market share
            </p>
          ))}
        </div>
      </DocSection>
      <DocSection title="Thai" description="The clients ship a Thai translation; neither family has Thai letters.">
        <Text variant="body-lg" tone="primary" lang="th">
          ส่วนแบ่งการตลาด รายได้ และความพึงพอใจของลูกค้า
        </Text>
        <p className="type-section-title text-fg-primary" lang="th">
          ผลลัพธ์รอบที่ 2
        </p>
      </DocSection>
    </DocPage>
  ),
};
