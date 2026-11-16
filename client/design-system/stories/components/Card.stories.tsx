import type { Meta, StoryObj } from "@storybook/react-vite";
import { AreaChart, Megaphone } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Heading, Icon, Text } from "../../src";
import { DocPage, DocSection } from "../foundations/docs";
import { figmaButtonContrastException } from "../support/a11y";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: { layout: "padded", ...figmaButtonContrastException },
  args: { variant: "card", children: "Content" },
  argTypes: { variant: { control: "inline-radio", options: ["card", "nested", "summary", "container", "panel"] } },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The surfaces of the Figma screens, measured. */
export const Variants: Story = {
  render: () => (
    <DocPage title="Card" intro="The surfaces of the Figma Admin and player screens. Their edges sit inside the card, as Figma's strokes do.">
      <DocSection title="card" description="A card on the page: the Admin list card, lifted by a light edge and Figma's card shadow.">
        <Card className="max-w-3xl">
          <Text tone="muted">The Simulations list: search, the table and its pagination.</Text>
        </Card>
      </DocSection>
      <DocSection title="summary" description="The header card of a simulation: 24 px corners.">
        <Card variant="summary" className="max-w-5xl">
          <div className="flex flex-wrap items-center gap-4">
            <Heading level={2} variant="page-title">
              Novabank Growth Simulation
            </Heading>
            <Badge tone="neutral">DRAFT</Badge>
          </div>
        </Card>
      </DocSection>
      <DocSection title="container, panel and nested" description="A 32 px container holding slate panels, with chart cards resting on a panel.">
        <Card variant="container" className="max-w-5xl">
          <Card variant="panel" className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Text tone="muted">Round Status:</Text>
              <Badge tone="info">PENDING</Badge>
            </div>
            <Button tone="energy">Start Round</Button>
          </Card>
          <div className="flex items-center gap-3">
            <Icon icon={AreaChart} size="2xl" className="text-fg-primary" />
            <Heading level={2} variant="section-title">
              Real Time Metrics
            </Heading>
          </div>
          <Card variant="panel" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card variant="nested" className="min-h-60">
              <CardHeader title="Revenue" level={3} />
              <EmptyState title="Round has not started" />
            </Card>
            <Card variant="nested" className="min-h-60">
              <CardHeader title="Profit" level={3} />
              <EmptyState title="Round has not started" />
            </Card>
          </Card>
          <div className="flex items-center gap-3">
            <Icon icon={Megaphone} size="2xl" className="text-fg-primary" />
            <Heading level={2} variant="section-title">
              Event
            </Heading>
          </div>
          <Card variant="panel">
            <Heading level={3} variant="heading">
              Event History
            </Heading>
            <Card variant="nested" className="min-h-28">
              <EmptyState title="No Event Listed in Current Round" />
            </Card>
          </Card>
        </Card>
      </DocSection>
    </DocPage>
  ),
};

/** Badges and empty states. */
export const BadgesAndEmptyStates: Story = {
  render: () => (
    <DocPage title="Badge and empty state" intro="The Preline soft badge in its tones, and the quiet message where content does not exist yet.">
      <DocSection title="Status badges" description="The Admin tables and headers: one width, so a column of them lines up.">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="info">ACTIVE</Badge>
          <Badge tone="success">COMPLETED</Badge>
          <Badge tone="neutral">DRAFT</Badge>
          <Badge tone="danger">CANCELED</Badge>
          <Badge tone="info">PENDING</Badge>
        </div>
      </DocSection>
      <DocSection title="Delta badges" description="The KPI bar.">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success" size="md">
            +99%
          </Badge>
          <Badge tone="danger" size="md">
            -99%
          </Badge>
          <Badge tone="neutral" size="md">
            0%
          </Badge>
        </div>
      </DocSection>
      <DocSection title="Empty states">
        <div className="grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
          <Card variant="nested" className="min-h-60">
            <CardHeader title="Profit" />
            <EmptyState title="Round has not started" />
          </Card>
          <Card>
            <EmptyState
              size="md"
              icon={AreaChart}
              title="No metrics yet"
              description="The metrics appear when the first round ends."
              actions={<Button variant="outline">Start Round</Button>}
            />
          </Card>
        </div>
      </DocSection>
    </DocPage>
  ),
};

/** Actions that need more room than the title leaves beside them: they move under the title rather than squeeze it. */
export const LongActions: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader
        title="Revenue Comparison"
        description="Round 2, every team"
        actions={
          <>
            <Button variant="secondary">Download CSV</Button>
            <Button variant="outline">Compare with round 1</Button>
          </>
        }
      />
    </Card>
  ),
};
