import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { TextArea } from "../../src";
import { DocPage, DocSection } from "../foundations/docs";

const meta = {
  title: "Components/Text area",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const DEBRIEF = [
  "Teams that invested early in digital channels grew fastest.",
  "Two teams cut marketing and lost share in Retail Mass.",
  "Next round: watch the cost of funds.",
].join("\n");

export const States: Story = {
  render: () => (
    <DocPage
      title="Text area"
      intro="A text field of several lines, of the family of the Preline input of the Figma forms: its edge, corners, shadow, 15 px text and focus ring. It shows four lines, grows with what is typed up to ten, then scrolls; with a limit, the count shows at the end of the help."
    >
      <DocSection title="States">
        <div className="grid max-w-5xl grid-cols-1 gap-6 rounded-2xl bg-surface-card p-6 md:grid-cols-2">
          <TextArea
            label="Round notes"
            placeholder="What happened in this round, for the debrief."
            description="Only facilitators see these."
            maxLength={5000}
          />
          <TextArea label="Debrief" required defaultValue={DEBRIEF} maxLength={5000} />
          <TextArea label="Message to the teams" error="Write a few words before sending." />
          <TextArea label="Round notes" defaultValue="Locked once the round has ended." disabled />
          <TextArea label="Short note" description="Up to 40 characters." defaultValue="Exactly forty characters, no more at all" maxLength={40} />
        </div>
      </DocSection>
    </DocPage>
  ),
};

/** Four lines to begin with; a line more for each line typed, up to ten; then it scrolls. Emptied, it shrinks back. */
export const GrowsThenScrolls: Story = {
  render: () => (
    <div className="max-w-xl rounded-2xl bg-surface-card p-6">
      <TextArea label="Round notes" maxLength={5000} />
    </div>
  ),
  play: async ({ canvas }) => {
    const box = canvas.getByRole("textbox", { name: "Round notes" });
    const style = getComputedStyle(box);
    const line = Number.parseFloat(style.lineHeight);
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const rows = () => Math.round((box.getBoundingClientRect().height - padding) / line);

    await expect(rows()).toBe(4);
    await userEvent.type(box, "One{Enter}Two{Enter}Three{Enter}Four{Enter}Five{Enter}Six");
    await expect(rows()).toBe(6);
    await userEvent.type(box, "{Enter}Seven{Enter}Eight{Enter}Nine{Enter}Ten{Enter}Eleven{Enter}Twelve");
    await expect(rows()).toBe(10);
    await expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
    await expect(getComputedStyle(box).overflowY).toBe("auto");

    await userEvent.clear(box);
    await expect(rows()).toBe(4);
    await expect(getComputedStyle(box).overflowY).toBe("hidden");
    await userEvent.type(box, "Monday: the teams read the brief.{Enter}Tuesday: round 1.{Enter}Wednesday: results.{Enter}Thursday: round 2.{Enter}Friday: the debrief.");
    await expect(rows()).toBe(5);
    await expect(canvas.getByText("111/5,000")).toBeInTheDocument();
    box.blur();
  },
};

/** A long line wraps, and the wrapped lines count as lines: it grows with them too. */
export const WrapsLongLines: Story = {
  render: () => (
    <div className="w-80 rounded-2xl bg-surface-card p-6">
      <TextArea
        label="Debrief"
        defaultValue="The teams that invested early in digital channels grew fastest, while two teams that cut their marketing lost share in Retail Mass and never won it back in the rounds that followed, which the facilitator will want to show on the screen before the final results."
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const box = canvas.getByRole("textbox", { name: "Debrief" });
    const style = getComputedStyle(box);
    const line = Number.parseFloat(style.lineHeight);
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const rows = Math.round((box.getBoundingClientRect().height - padding) / line);
    await expect(rows).toBeGreaterThan(4);
    await expect(rows).toBeLessThanOrEqual(10);
    await expect(box.scrollHeight).toBeLessThanOrEqual(box.clientHeight);
  },
};
