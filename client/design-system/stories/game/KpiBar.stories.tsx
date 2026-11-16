import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { expect, screen, userEvent, within } from "storybook/test";
import { AppShell, Button, EnergyPill, Heading, KpiBar, KpiBarActions, Text, Wordmark, type KpiRow } from "../../src";
import { PlayerSidebar, teamPictureLoaded } from "../layout/fixtures";
import { withStoryRouter } from "../support/router";

const meta = {
  title: "Game/KPI bar",
  decorators: [withStoryRouter],
  globals: { viewport: { value: "figma", isRotated: false } },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The player's KPI bar (Figma Navbar Variant2): the round's figures in one or two rows, the energy left and Submit. Structure from today's KPI bar (the company's figures, then the chosen segment's), style from Figma; on tablets the figures are chips and the actions move to the top bar, on phones they fold under Winning Metrics.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const overall: KpiRow = {
  label: "Overall",
  metrics: [
    { key: "revenue", label: "Overall Revenue", value: "$12.46 Bn", change: 0.12, info: "Total Revenue across the company" },
    { key: "profit", label: "Profit", value: "$1.82 Bn", change: -0.04, info: "Total Risk Adjusted Profit across the company" },
    { key: "esat", label: "ESAT", value: "72.5%", change: 0, info: "Employee Satisfaction score (ESAT) across the company" },
    { key: "csat", label: "CSAT", value: "81.3%", change: null, info: "Customer Satisfaction score (CSAT) across the company" },
  ],
};

const segment: KpiRow = {
  label: "Segment",
  metrics: [
    { key: "revenue", label: "Segment Revenue", value: "$3.07 Bn", change: 0.31, info: "Total Revenue across the chosen segment" },
    { key: "profit", label: "Profit", value: "$0.41 Bn", change: 0.08, info: "Total Risk Adjusted Profit across the chosen segment" },
    { key: "esat", label: "ESAT", value: "70.1%", change: -0.02, info: "Employee Satisfaction score (ESAT) across the chosen segment" },
    { key: "csat", label: "CSAT", value: "84.9%", change: 0.05, info: "Customer Satisfaction score (CSAT) across the chosen segment" },
  ],
};

function Actions({ energy = 100, over = false, loading = false }: { energy?: number; over?: boolean; loading?: boolean }) {
  return (
    <KpiBarActions loading={loading}>
      <EnergyPill value={energy} over={over} />
      <Button>Submit</Button>
    </KpiBarActions>
  );
}

/** The player's page with the bar at its top, as the Figma business-unit screens. */
function PlayerPage({ rows, actions, collapsed = false, loading = false }: { rows: KpiRow[]; actions: ReactNode; collapsed?: boolean; loading?: boolean }) {
  return (
    <AppShell
      sidebar={<PlayerSidebar defaultCollapsed={collapsed} />}
      mobileBrand={<Wordmark size="player">LIFE Bank.</Wordmark>}
      mobileActions={actions}
      topBar={<KpiBar rows={rows} actions={actions} loading={loading} />}
    >
      <Heading level={1}>Retail Mass - Deposit</Heading>
      <div className="flex min-h-96 flex-1 items-center justify-center rounded-(--card-radius) border border-line bg-surface-card p-6">
        <Text tone="subtle" align="center">
          The decisions, charts and statements come with the player components.
        </Text>
      </div>
    </AppShell>
  );
}

/** Figma's desktop bar: the company's figures over the segment's, the energy pill over Submit. */
export const Desktop: Story = {
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} />,
  play: async ({ canvas, canvasElement }) => {
    const bar = canvas.getByRole("region", { name: "Key metrics" });
    await expect(bar).toBeInTheDocument();
    await expect(canvas.getByRole("group", { name: "Overall" })).toHaveTextContent("Overall Revenue$12.46 Bn+12%");
    await expect(canvas.getByRole("button", { name: "About Overall Revenue" })).toHaveAccessibleDescription("Total Revenue across the company");
    await teamPictureLoaded(canvasElement);
  },
};

/** With the sidebar as a rail, the bar is wider and the figures spread further apart. */
export const DesktopRail: Story = {
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} collapsed />,
  play: async ({ canvasElement }) => {
    await teamPictureLoaded(canvasElement);
  },
};

/** The enterprise pages' single row: the energy pill and Submit side by side. */
export const Enterprise: Story = {
  render: () => <PlayerPage rows={[overall]} actions={<Actions />} />,
  play: async ({ canvasElement }) => {
    await teamPictureLoaded(canvasElement);
  },
};

/** A laptop (1280 px) with the sidebar open: a label short of room wraps, as today's bar. */
export const Laptop: Story = {
  globals: { viewport: { value: "laptop", isRotated: false } },
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} />,
  play: async ({ canvasElement }) => {
    await teamPictureLoaded(canvasElement);
  },
};

/** Figma's tablet (1024 px): the figures as chips on a white bar, the first filling its row; the energy pill and Submit in the top bar. */
export const Tablet: Story = {
  globals: { viewport: { value: "figmaTablet", isRotated: false } },
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} />,
};

/** Opens Winning Metrics and waits for the chips. */
async function openWinningMetrics(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole("button", { name: "Winning Metrics" });
  await userEvent.click(toggle);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(canvas.getAllByRole("group", { name: "Segment" })[0]).toBeVisible();
}

/** Below 1024 px four chips no longer fit a row: they fold under Winning Metrics, two to a line from 640 px. */
export const TabletPortrait: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} />,
  play: async ({ canvasElement }) => {
    await openWinningMetrics(canvasElement);
  },
};

/** Figma's phone (440 px): the figures fold under Winning Metrics. */
export const Phone: Story = {
  globals: { viewport: { value: "figmaPhone", isRotated: false } },
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} />,
};

/** Winning Metrics open: the chips one under the other, a line under the company's. */
export const PhoneOpen: Story = {
  globals: { viewport: { value: "figmaPhone", isRotated: false } },
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} />,
  play: async ({ canvasElement }) => {
    await openWinningMetrics(canvasElement);
  },
};

/** A smaller phone (375 px): the brand steps aside for the energy pill and Submit; the menu still shows it. */
export const SmallPhone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions />} />,
};

/** The decisions cost more energy than is left: the pill turns red and says so. */
export const NotEnoughEnergy: Story = {
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions energy={-3} over />} />,
  play: async ({ canvasElement }) => {
    await teamPictureLoaded(canvasElement);
    await expect(screen.getAllByRole("status")[0]).toHaveTextContent("Energy: -3. Not enough energy. Adjust your decisions.");
  },
};

/** While the round loads: pale pills for the figures, the energy and Submit, as today's bar. */
export const Loading: Story = {
  render: () => <PlayerPage rows={[overall, segment]} actions={<Actions loading />} loading />,
  play: async ({ canvasElement }) => {
    await teamPictureLoaded(canvasElement);
  },
};

/** A move refused for energy: the pill nudges and glows red for a moment, as today's. */
export const Refusal: Story = {
  tags: ["no-screenshot"],
  render: function Render() {
    const [refusing, setRefusing] = useState(false);
    const refuse = () => {
      setRefusing(true);
      setTimeout(() => setRefusing(false), 1100);
    };
    return (
      <div className="flex items-center gap-4 p-8">
        <EnergyPill value={refusing ? -2 : 4} refusing={refusing} />
        <Button variant="secondary" onClick={refuse}>
          Spend 6 energy
        </Button>
      </div>
    );
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Spend 6 energy" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Energy: -2. Not enough energy. Adjust your decisions.");
  },
};
