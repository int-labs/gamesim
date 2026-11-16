import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import { Alert, Button } from "../../src";
import { DocPage, DocSection } from "../foundations/docs";

const meta = {
  title: "Components/Alert",
  component: Alert,
  parameters: { layout: "padded" },
  args: { tone: "danger", children: "Something went wrong. Please try again." },
  argTypes: {
    tone: { control: "inline-radio", options: ["info", "success", "warning", "danger", "neutral"] },
    icon: { control: false },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <DocPage title="Alert" intro="The Preline soft alert: a tinted panel with a matching border. The same look carries the toasts.">
      <DocSection title="Tones">
        <div className="flex max-w-xl flex-col gap-4">
          <Alert tone="info">Round 2 starts when the facilitator is ready.</Alert>
          <Alert tone="success">Decisions submitted for round 2.</Alert>
          <Alert tone="warning">The round ends in one minute.</Alert>
          <Alert tone="danger">Something went wrong. Please try again.</Alert>
          <Alert tone="neutral">No event listed in the current round.</Alert>
        </div>
      </DocSection>
      <DocSection title="With a title and actions">
        <div className="flex max-w-xl flex-col gap-4">
          <Alert
            tone="danger"
            title="Could not save your decisions"
            actions={
              <Button variant="outline" size="sm">
                Try again
              </Button>
            }
          >
            Your changes are kept on this page. Check your connection and try again.
          </Alert>
        </div>
      </DocSection>
    </DocPage>
  ),
};

function DismissDemo() {
  const [shown, setShown] = useState(true);
  return shown ? (
    <Alert tone="success" onDismiss={() => setShown(false)}>
      Event added to round 4.
    </Alert>
  ) : (
    <Button variant="text" onClick={() => setShown(true)}>
      Show again
    </Button>
  );
}

export const Dismissible: Story = {
  render: () => (
    <div className="max-w-xl">
      <DismissDemo />
    </div>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(canvas.queryByRole("status")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Show again" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Event added to round 4.");
  },
};
