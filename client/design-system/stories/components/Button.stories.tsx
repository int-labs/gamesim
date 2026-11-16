import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, ArrowUpRight, Download, Plus, RotateCw, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { Button, LinkButton, Text, type ButtonStatus } from "../../src";
import { Code, DocPage, DocSection } from "../foundations/docs";
import { figmaButtonContrastException } from "../support/a11y";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: { layout: "padded", ...figmaButtonContrastException },
  args: { children: "Submit", variant: "solid", tone: "primary", status: "idle", disabled: false, fullWidth: false, celebrate: false },
  argTypes: {
    variant: { control: "inline-radio", options: ["solid", "outline", "text"] },
    tone: { control: "inline-radio", options: ["primary", "energy", "danger"] },
    size: { control: "inline-radio", options: [undefined, "xs", "sm", "md", "lg"] },
    status: { control: "inline-radio", options: ["idle", "loading", "success"] },
    iconStart: { control: false },
    iconEnd: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Text as="div" variant="caption" tone="muted" className="w-40">
        {label}
      </Text>
      {children}
    </div>
  );
}

export const Variants: Story = {
  render: () => (
    <DocPage
      title="Button"
      intro={
        <>
          The solid button is the Figma <Code>btnPublish</Code>: sheen, rim, glow, and on hover the violet wash. Outline and text buttons are the
          Preline buttons in the brand pink. Sizes follow the kind: solid 40 px, outline 46 px, text 38 px.
        </>
      }
    >
      <DocSection title="Kinds and tones">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface-card p-6">
          <Row label="solid, primary">
            <Button>Submit</Button>
            <Button iconStart={Plus}>New Simulation</Button>
          </Row>
          <Row label="solid, energy">
            <Button tone="energy">Start Round</Button>
          </Row>
          <Row label="solid, danger">
            <Button tone="danger">End Round</Button>
          </Row>
          <Row label="outline">
            <Button variant="outline" iconStart={RotateCw} iconAnimation="spin">
              Recalculate
            </Button>
            <Button variant="outline" iconStart={Plus}>
              Add Event
            </Button>
            <Button variant="outline" iconStart={Settings} disabled>
              Configuration
            </Button>
          </Row>
          <Row label="text">
            <Button variant="text">Cancel</Button>
            <Button variant="text" iconStart={Download} iconAnimation="bounce">
              Feedback
            </Button>
            <Button variant="text" iconStart={Download} iconAnimation="bounce">
              Competitor Report
            </Button>
          </Row>
          <Row label="link buttons">
            <LinkButton href="#slides" iconEnd={ArrowUpRight}>
              Feedback Slides
            </LinkButton>
            <LinkButton href="#detail" size="xs" iconEnd={ArrowRight} iconAnimation="rise">
              See Detail
            </LinkButton>
          </Row>
        </div>
      </DocSection>
      <DocSection title="Sizes" description="xs 28, sm 38, md 40, lg 46.">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface-card p-6">
          {(["solid", "outline", "text"] as const).map((variant) => (
            <Row key={variant} label={variant}>
              {(["xs", "sm", "md", "lg"] as const).map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {size}
                </Button>
              ))}
            </Row>
          ))}
        </div>
      </DocSection>
      <DocSection title="States" description="Loading keeps the width and the focus; success draws the check.">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface-card p-6">
          <Row label="loading">
            <Button status="loading">Submit</Button>
            <Button tone="energy" status="loading">
              Start Round
            </Button>
            <Button variant="outline" status="loading">
              Recalculate
            </Button>
          </Row>
          <Row label="success">
            <Button status="success">Submit</Button>
            <Button tone="danger" status="success">
              End Round
            </Button>
          </Row>
          <Row label="disabled">
            <Button disabled>Submit</Button>
            <Button tone="energy" disabled>
              Start Round
            </Button>
            <Button variant="outline" disabled>
              Configuration
            </Button>
            <Button variant="text" disabled>
              Cancel
            </Button>
          </Row>
        </div>
      </DocSection>
      <DocSection title="In a dialog footer" description="Change your password: Cancel and the primary action.">
        <div className="flex items-center justify-end gap-6 rounded-3xl bg-surface-card p-8">
          <Button variant="text">Cancel</Button>
          <Button>Change Password</Button>
        </div>
      </DocSection>
      <DocSection title="Full width" description="The Login card.">
        <div className="flex max-w-lg flex-col gap-4 rounded-4xl bg-surface-card p-10">
          <Button fullWidth>Login</Button>
          <Button variant="outline" fullWidth>
            Team Login
          </Button>
        </div>
      </DocSection>
    </DocPage>
  ),
};

function SubmitDemo() {
  const [status, setStatus] = useState<ButtonStatus>("idle");
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-surface-card p-10">
      <Button
        status={status}
        celebrate
        onClick={() => {
          setStatus("loading");
          window.setTimeout(() => setStatus("success"), 900);
          window.setTimeout(() => setStatus("idle"), 2600);
        }}
      >
        Submit
      </Button>
      <Text variant="caption" tone="muted">
        {status}
      </Text>
    </div>
  );
}

export const SubmitFlow: Story = {
  name: "Submit flow",
  render: () => <SubmitDemo />,
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Submit" });
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveFocus();
    await waitFor(() => expect(button).toHaveAttribute("data-status", "success"), { timeout: 2000 });
    await waitFor(() => expect(button).toHaveAttribute("data-status", "idle"), { timeout: 3000 });
  },
};
