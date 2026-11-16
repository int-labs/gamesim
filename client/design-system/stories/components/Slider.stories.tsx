import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { expect, userEvent } from "storybook/test";
import { Slider, Text, type SliderProps } from "../../src";

const meta = {
  title: "Components/Slider",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A player's decision on a scale of marks (Figma 832:87599, 864:25418, 1368:48785): a 6 px gray 300 rail, a 24 px white thumb that stays on it, a tick and a label for each value, 69 px in all. The brand indigo fill runs from 0 for a level's change, from the start on a score, and not at all under words. Values not allowed now fade and the thumb stops at them. The value follows the thumb and is kept on release, as today; a press on a label moves the thumb there.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Props = SliderProps extends infer P ? (P extends unknown ? Omit<P, "value" | "onValueChange"> : never) : never;

/** A slider whose value lives in the page, as on the decision pages. */
function Controlled({ initial = 0, ...props }: Props & { initial?: number }) {
  const [value, setValue] = useState(initial);
  return <Slider {...(props as SliderProps)} value={value} onValueChange={setValue} />;
}

/** The slate panel a decision's slider sits on, at Figma's 260. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-(--decision-slider-width) flex-col gap-3 rounded-2xl bg-surface-panel p-4 box-content">
      <Text variant="caption" tone="muted">
        {title}
      </Text>
      {children}
    </div>
  );
}

/** A level's change on last round, -2 to 5 (Figma 832:87599): the fill runs from 0 to the thumb, either way. */
export const Levels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {[-2, 0, 3, 5].map((change) => (
        <Panel key={change} title={`Change ${change}`}>
          <Controlled aria-label={`Features of Products, change ${change}`} min={-2} max={5} fillFrom={0} initial={change} />
        </Panel>
      ))}
    </div>
  ),
};

/** A score from 0 to 10 (Figma 864:25418): the fill runs from the rail's start. */
export const Score: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {[0, 4, 10].map((score) => (
        <Panel key={score} title={`Score ${score}`}>
          <Controlled aria-label={`Risk Level ${score}`} min={0} max={10} initial={score} />
        </Panel>
      ))}
    </div>
  ),
};

/** Words (Figma 1368:48785): each over its tick in an equal share of the width, no fill. A long word wraps. */
export const Words: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <Panel title="English">
        <Controlled aria-label="Transaction Fee" labels={["Very Low", "Low", "Medium", "High", "Very High"]} initial={1} />
      </Panel>
      <Panel title="Indonesian">
        <Controlled aria-label="Biaya Transaksi" labels={["Sangat Rendah", "Rendah", "Sedang", "Tinggi", "Sangat Tinggi"]} initial={4} />
      </Panel>
      <Panel title="Three words">
        <Controlled aria-label="Service Level" labels={["Basic", "Standard", "Premium"]} initial={2} />
      </Panel>
    </div>
  ),
};

/**
 * Values the player may not choose now (the level's limits, the energy left) fade, and the thumb
 * stops at the last one allowed; a value past them shows at the nearest one allowed. With one
 * value left the thumb stands still.
 */
export const AllowedValues: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      <Panel title="-1 to 3 allowed">
        <Controlled aria-label="Features of Products" min={-2} max={5} fillFrom={0} allowedMin={-1} allowedMax={3} initial={2} />
      </Panel>
      <Panel title="Up to Medium allowed">
        <Controlled aria-label="Transaction Fee" labels={["Very Low", "Low", "Medium", "High", "Very High"]} allowedMax={2} initial={2} />
      </Panel>
      <Panel title="Only 0 allowed">
        <Controlled aria-label="Minimum Credit Score Change" min={-2} max={5} fillFrom={0} allowedMin={0} allowedMax={0} />
      </Panel>
    </div>
  ),
};

/** Disabled on its own it dims to half, as the other controls; in a locked decision its column dims instead. */
export const Disabled: Story = {
  render: () => (
    <Panel title="Disabled">
      <Controlled aria-label="Features of Products" min={-2} max={5} fillFrom={0} initial={2} disabled />
    </Panel>
  ),
};

/** Its marks in the page's own words: a percentage. */
export const Percentages: Story = {
  render: () => (
    <Panel title="0% to 5%">
      <Controlled aria-label="Price Change" min={0} max={5} formatLabel={(mark) => `${mark}%`} initial={2} />
    </Panel>
  ),
};

/** The arrow keys move a step, Home and End to the ends allowed; every value is kept at once. */
export const Keyboard: Story = {
  tags: ["no-screenshot"],
  render: () => (
    <Panel title="Keyboard">
      <Controlled aria-label="Features of Products" min={-2} max={5} fillFrom={0} allowedMax={3} />
    </Panel>
  ),
  play: async ({ canvas }) => {
    const slider = canvas.getByRole("slider", { name: "Features of Products" });
    await userEvent.tab();
    await expect(slider).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(slider).toHaveAttribute("aria-valuenow", "1");
    await userEvent.keyboard("{End}");
    await expect(slider).toHaveAttribute("aria-valuenow", "3");
    await userEvent.keyboard("{ArrowRight}");
    await expect(slider).toHaveAttribute("aria-valuenow", "3");
    await userEvent.keyboard("{Home}");
    await expect(slider).toHaveAttribute("aria-valuenow", "-2");
  },
};

/** A press on a label moves the thumb there, as today's slider does; one on a faded label stops at the last value allowed. */
export const PressALabel: Story = {
  tags: ["no-screenshot"],
  render: () => (
    <Panel title="Press a label">
      <Controlled aria-label="Transaction Fee" labels={["Very Low", "Low", "Medium", "High", "Very High"]} allowedMax={3} />
    </Panel>
  ),
  play: async ({ canvas }) => {
    const slider = canvas.getByRole("slider", { name: "Transaction Fee" });
    // The slider reads where the pointer is, so the press lands on the middle of the word.
    const press = async (word: string) => {
      const target = canvas.getByText(word);
      const box = target.getBoundingClientRect();
      await userEvent.pointer({ keys: "[MouseLeft]", target, coords: { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 } });
    };
    await press("Medium");
    await expect(slider).toHaveAttribute("aria-valuetext", "Medium");
    await press("Very High");
    await expect(slider).toHaveAttribute("aria-valuetext", "High");
  },
};
