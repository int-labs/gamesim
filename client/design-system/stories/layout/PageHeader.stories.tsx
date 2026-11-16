import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pencil, Plus } from "lucide-react";
import { expect } from "storybook/test";
import { Breadcrumb, Button, PageHeader } from "../../src";
import { figmaButtonContrastException } from "../support/a11y";
import { withStoryRouter } from "../support/router";

const meta = {
  title: "Layout/Page header",
  decorators: [withStoryRouter],
  component: PageHeader,
  parameters: { layout: "padded", ...figmaButtonContrastException },
  args: { title: "Simulations" },
  argTypes: {
    breadcrumb: { control: false },
    actions: { control: false },
    addon: { control: false },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A list page (Figma Simulations list): title, description, and the page's main action. */
export const ListPage: Story = {
  args: {
    title: "Simulations",
    description: "Manage and monitor all simulation projects from a single dashboard.",
    actions: <Button iconStart={Plus}>New Simulation</Button>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1, name: "Simulations" })).toBeInTheDocument();
  },
};

/** A page inside another: the breadcrumb leads back, the last level is the current page. */
export const WithBreadcrumb: Story = {
  args: {
    title: "Configuration Settings",
    breadcrumb: (
      <Breadcrumb
        items={[
          { label: "Simulations", href: "#simulations" },
          { label: "Novabank Growth Simulation", href: "#novabank" },
          { label: "Configuration Settings" },
        ]}
      />
    ),
  },
  play: async ({ canvas }) => {
    const trail = canvas.getByRole("navigation", { name: "Breadcrumb" });
    await expect(trail).toBeInTheDocument();
    await expect(canvas.getByText("Configuration Settings", { selector: "[aria-current=page]" })).toBeInTheDocument();
  },
};

/** A detail page with its own actions (Figma event detail). */
export const DetailWithActions: Story = {
  args: {
    title: "Reassess International Investment",
    breadcrumb: <Breadcrumb items={[{ label: "Events", href: "#events" }, { label: "Reassess International Investment" }]} />,
    actions: (
      <Button variant="outline" iconStart={Pencil}>
        Edit Event
      </Button>
    ),
  },
};
