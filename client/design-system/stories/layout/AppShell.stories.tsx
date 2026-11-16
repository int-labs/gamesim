import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { AppShell, Button, Heading, PageHeader, Text, Wordmark } from "../../src";
import { figmaButtonContrastException } from "../support/a11y";
import { withStoryRouter } from "../support/router";
import { expectTooltip } from "../support/tooltip";
import {
  AdminSidebar,
  GroupFirstSidebar,
  LongNamesSidebar,
  MarksSidebar,
  PlatformSidebar,
  PlayerSidebar,
  teamPictureLoaded,
} from "./fixtures";

const meta = {
  title: "Layout/App shell",
  decorators: [withStoryRouter],
  // The Figma desktop frame; the phone stories set their own size.
  globals: { viewport: { value: "figma", isRotated: false } },
  parameters: {
    layout: "fullscreen",
    ...figmaButtonContrastException,
    docs: {
      description: {
        component:
          "The frame of every Admin and player screen: the 268 px sidebar (a 74 px rail when collapsed), then the page on the slate background with the Figma 16 px margin. Below 1280 px a top bar takes its place and the sidebar opens as a drawer.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Where the page's own content goes, so the shell is judged on its own. */
function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-96 flex-1 items-center justify-center rounded-(--card-radius) border border-line bg-surface-card p-6">
      <Text tone="subtle" align="center">
        {children}
      </Text>
    </div>
  );
}

function SimulationsPage() {
  return (
    <>
      <PageHeader
        title="Simulations"
        description="Manage and monitor all simulation projects from a single dashboard."
        actions={<Button iconStart={Plus}>New Simulation</Button>}
      />
      <Placeholder>The simulations table comes with DataTable.</Placeholder>
    </>
  );
}

/** The Figma Simulations list (Frame 38984): the Admin sidebar and a page. */
export const Admin: Story = {
  render: () => (
    <AppShell sidebar={<AdminSidebar />} mobileBrand={<Wordmark>intlabs.</Wordmark>}>
      <SimulationsPage />
    </AppShell>
  ),
};

/** The collapsed rail (State=Minimize, Role=Admin): icons, the @ account chip, and the names kept for screen readers. */
export const AdminCollapsed: Story = {
  render: () => (
    <AppShell sidebar={<AdminSidebar defaultCollapsed />} mobileBrand={<Wordmark>intlabs.</Wordmark>}>
      <SimulationsPage />
    </AppShell>
  ),
  play: async ({ canvas }) => {
    const expand = canvas.getByRole("button", { name: "Expand sidebar" });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.getByRole("link", { name: "Simulations" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("button", { name: "Change password: herdy_intlabs@gmail.com" })).toBeInTheDocument();
  },
};

/**
 * On the rail, an item's name shows in a tooltip beside it while the pointer rests on it or it
 * has keyboard focus, as today's collapsed sidebar does. Figma draws no rail tooltips; they take
 * the Figma tooltip's look.
 */
export const AdminRailTooltip: Story = {
  render: () => (
    <AppShell sidebar={<AdminSidebar defaultCollapsed />} mobileBrand={<Wordmark>intlabs.</Wordmark>}>
      <SimulationsPage />
    </AppShell>
  ),
  play: async ({ canvas }) => {
    const events = canvas.getByRole("link", { name: "Events" });
    for (let step = 0; step < 10 && document.activeElement !== events; step += 1) await userEvent.tab();
    await expect(events).toHaveFocus();
    await expectTooltip("Events");
    // The link already says "Events" to screen readers: the tooltip is not read again.
    await expect(events).not.toHaveAttribute("aria-describedby");
  },
};

/** Collapsing and expanding, as the Figma prototype does with the panel icon. */
export const CollapseAndExpand: Story = {
  tags: ["no-screenshot"],
  render: () => (
    <AppShell sidebar={<AdminSidebar />} mobileBrand={<Wordmark>intlabs.</Wordmark>}>
      <SimulationsPage />
    </AppShell>
  ),
  play: async ({ canvas }) => {
    const sidebar = canvas.getByRole("complementary");
    await userEvent.click(canvas.getByRole("button", { name: "Collapse sidebar" }));
    await expect(sidebar).toHaveAttribute("data-collapsed");
    await userEvent.click(canvas.getByRole("button", { name: "Expand sidebar" }));
    await expect(sidebar).not.toHaveAttribute("data-collapsed");
    await expect(canvas.getByRole("button", { name: "Collapse sidebar" })).toHaveFocus();
  },
};

/** Below 1280 px: the top bar with the menu button; the sidebar opens as a drawer and closes when a page is chosen. */
export const AdminOnPhone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => (
    <AppShell sidebar={<AdminSidebar />} mobileBrand={<Wordmark>intlabs.</Wordmark>}>
      <SimulationsPage />
    </AppShell>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open menu" }));
    // The drawer is portalled to the end of the page.
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    await userEvent.click(within(menu).getByRole("link", { name: "Products" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull());
    await expect(canvas.getByRole("button", { name: "Open menu" })).toHaveFocus();
  },
};

/** The menu open on a phone, for the screenshot. */
export const AdminMenuOpen: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => (
    <AppShell sidebar={<AdminSidebar />} mobileBrand={<Wordmark>intlabs.</Wordmark>}>
      <SimulationsPage />
    </AppShell>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open menu" }));
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    await expect(within(menu).getByRole("button", { name: "Close menu" })).toBeInTheDocument();
  },
};

/** The player on Retail Mass - Deposit: round chip, team card, business units with the open unit's products. */
export const Player: Story = {
  render: () => (
    <AppShell sidebar={<PlayerSidebar />} mobileBrand={<Wordmark size="player">LIFE Bank.</Wordmark>}>
      <Heading level={1}>Retail Mass - Deposit</Heading>
      <Placeholder>The strategy inputs, charts and statements come with the player components.</Placeholder>
    </AppShell>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("link", { name: "Retail Mass" })).toHaveAttribute("aria-current", "true");
    await expect(canvas.getByRole("link", { name: "Deposit" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("button", { name: "Edit team details: Team Anakin" })).toBeInTheDocument();
    await teamPictureLoaded(canvasElement);
  },
};

/** The player rail (State=Minimize, Role=User): the round number, the avatar, the unit icons. */
export const PlayerCollapsed: Story = {
  render: () => (
    <AppShell sidebar={<PlayerSidebar defaultCollapsed />} mobileBrand={<Wordmark size="player">LIFE Bank.</Wordmark>}>
      <Heading level={1}>Retail Mass - Deposit</Heading>
      <Placeholder>The strategy inputs, charts and statements come with the player components.</Placeholder>
    </AppShell>
  ),
  play: async ({ canvasElement }) => {
    await teamPictureLoaded(canvasElement);
  },
};

/**
 * Names longer than a line (a translation, a facilitator's own names): a name takes a second line
 * and its row grows with it, so nothing overlaps; past two lines it ends in an ellipsis.
 */
export const PlayerLongNames: Story = {
  render: () => (
    <AppShell sidebar={<LongNamesSidebar />} mobileBrand={<Wordmark size="player">Lumina.</Wordmark>}>
      <Heading level={1}>ProCare Industrial and Institutional Detergent - ProCare EcoGuard</Heading>
      <Placeholder>The strategy inputs, charts and statements come with the player components.</Placeholder>
    </AppShell>
  ),
  play: async ({ canvas, canvasElement }) => {
    const unit = canvas.getByRole("link", { name: "ProCare Industrial and Institutional Detergent" });
    const product = canvas.getByRole("link", { name: "ProCare PowerWash Heavy Duty Formula" });
    // Two lines: taller than a one-line row, and each row as tall as its name.
    await expect(unit.getBoundingClientRect().height).toBeGreaterThan(46);
    await expect(product.getBoundingClientRect().height).toBeGreaterThan(36);
    await expect(canvas.getByRole("link", { name: "Bloom Detergent" }).getBoundingClientRect().height).toBe(46);
    await teamPictureLoaded(canvasElement);
  },
};

/** ET Prime's banks, each with its own mark in the icon's place, and a report page with its page icon. */
export const PlayerUnitMarks: Story = {
  render: () => (
    <AppShell sidebar={<MarksSidebar />} mobileBrand={<Wordmark size="player">SimuBank.</Wordmark>}>
      <Heading level={1}>AABC Bank - Retail</Heading>
      <Placeholder>The strategy inputs, charts and statements come with the player components.</Placeholder>
    </AppShell>
  ),
  play: async ({ canvas, canvasElement }) => {
    // The bank, and its report under Enterprise, share its name.
    const units = within(canvas.getByRole("group", { name: "Business unit" }));
    await expect(units.getByRole("link", { name: "AABC Bank" }).querySelector("img")).not.toBeNull();
    await expect(canvas.getByRole("link", { name: "Financial Statements" }).querySelector("img")).toBeNull();
    // Every picture drawn, the team's and the marks, before the screenshot.
    await waitFor(() =>
      expect([...canvasElement.querySelectorAll("img")].every((picture) => picture.complete && picture.naturalWidth > 0)).toBe(true),
    );
  },
};

/** A game whose group decisions come first: the business units wait, dimmed, until the team submits them. */
export const PlayerGroupDecisionsFirst: Story = {
  render: () => (
    <AppShell sidebar={<GroupFirstSidebar />} mobileBrand={<Wordmark size="player">SimuBank.</Wordmark>}>
      <Heading level={1}>Group Strategy</Heading>
      <Placeholder>The group decisions come first; the business units open once they are submitted.</Placeholder>
    </AppShell>
  ),
  play: async ({ canvas, canvasElement }) => {
    for (const name of ["Retail", "SME", "Corporate"]) {
      await expect(canvas.getByRole("link", { name })).toHaveAttribute("aria-disabled", "true");
    }
    await expect(canvas.getByRole("link", { name: "Group Strategy" })).toHaveAttribute("aria-current", "page");
    await teamPictureLoaded(canvasElement);
  },
};

/**
 * The platform Admin opening an app's own admin in a frame: `fullBleed` drops the page padding,
 * and the frame fills the rest of the window.
 */
export const FullBleedFrame: Story = {
  render: () => (
    <AppShell sidebar={<PlatformSidebar />} mobileBrand={<Wordmark>intlabs.</Wordmark>} fullBleed>
      <iframe
        title="ET Prime admin"
        className="min-h-0 w-full flex-1 border-0 bg-surface-card"
        srcDoc="<body style='font: 16px system-ui; margin: 24px'>An app's admin, framed.</body>"
      />
    </AppShell>
  ),
};
