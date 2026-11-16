import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "../../src";
import { Code, DocPage, DocSection, Specimen } from "../foundations/docs";

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  parameters: { layout: "padded" },
  args: { shape: "rect", className: "h-10 w-24 rounded-xl" },
  argTypes: { shape: { control: "inline-radio", options: ["rect", "text", "circle"] } },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The placeholders the apps draw today with MUI's Skeleton, in the design system's grey. */
export const Shapes: Story = {
  render: () => (
    <DocPage
      title="Skeleton"
      intro={
        <>
          A grey placeholder that breathes while content loads, and stays still with reduced motion. Size and round it with classes; mark the region
          that is loading with <Code>aria-busy</Code>.
        </>
      }
    >
      <DocSection title="Shapes">
        <div className="grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          <Specimen label="rect" meta="A button: h-10 w-24 rounded-xl">
            <Skeleton className="h-10 w-24 rounded-xl" />
          </Specimen>
          <Specimen label="text" meta="Lines of a 14/20 paragraph">
            <div className="flex flex-col">
              <Skeleton shape="text" />
              <Skeleton shape="text" />
              <Skeleton shape="text" className="w-3/5" />
            </div>
          </Specimen>
          <Specimen label="circle" meta="An avatar: size-11">
            <Skeleton shape="circle" className="size-11" />
          </Specimen>
        </div>
      </DocSection>
      <DocSection title="In place" description="The player's team card and a KPI row while the round loads.">
        <div aria-busy="true" className="flex max-w-3xl flex-col gap-4">
          <div className="flex w-64 items-center gap-2 rounded-lg bg-surface-card px-2 py-1 inset-ring inset-ring-line">
            <Skeleton shape="circle" className="size-11" />
            <div className="flex flex-1 flex-col">
              <Skeleton shape="text" className="w-3/5" />
              <Skeleton shape="text" className="w-2/5" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 rounded-2xl bg-surface-card p-4">
            <Skeleton className="h-10 rounded-3xl" />
            <Skeleton className="h-10 rounded-3xl" />
            <Skeleton className="h-10 rounded-3xl" />
            <Skeleton className="h-10 rounded-3xl" />
          </div>
        </div>
      </DocSection>
    </DocPage>
  ),
};
