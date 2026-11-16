import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check } from "lucide-react";
import { expect, userEvent, waitFor } from "storybook/test";
import { Card, Icon, Tabs, TabsPanel, Text } from "../../src";
import { DocPage, DocSection } from "../foundations/docs";

const meta = {
  title: "Components/Tabs",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A round's state beside its label, as the Figma round tabs draw it. */
function RoundLabel({ round, state }: { round: number; state: "done" | "current" | "later" }) {
  return (
    <>
      Round-{round}
      {state === "done" ? (
        <span className="flex size-(--tabs-dot-size) items-center justify-center rounded-full bg-success-soft text-success-soft-fg">
          <Icon icon={Check} size="xs" stroke="bold" label="completed" />
        </span>
      ) : null}
      {state === "current" ? (
        <span className="flex size-(--tabs-dot-size) items-center justify-center rounded-full bg-info-soft">
          <span className="size-1.5 rounded-full bg-info-soft-fg" />
          <span className="sr-only">current</span>
        </span>
      ) : null}
    </>
  );
}

const rounds = [
  { value: "1", label: <RoundLabel round={1} state="done" /> },
  { value: "2", label: <RoundLabel round={2} state="done" /> },
  { value: "3", label: <RoundLabel round={3} state="done" /> },
  { value: "4", label: <RoundLabel round={4} state="current" /> },
  { value: "5", label: <RoundLabel round={5} state="later" /> },
];

export const RoundsAndStatements: Story = {
  render: () => (
    <DocPage title="Tabs" intro="The Figma underline tabs: equal widths on a gray rule, the active tab in indigo over a 2 px bar that slides to it.">
      <DocSection title="Rounds" description="The simulation detail page: the tabs run edge to edge across the round card.">
        <Card variant="container" className="max-w-5xl">
          <Tabs label="Rounds" tabs={rounds} defaultValue="3" className="-mx-(--card-padding)">
            {rounds.map((round) => (
              <TabsPanel key={round.value} value={round.value} className="px-(--card-padding) pt-6">
                <Text tone="muted">Round {round.value}: status, events and metrics.</Text>
              </TabsPanel>
            ))}
          </Tabs>
        </Card>
      </DocSection>
      <DocSection title="Statements" description="The player's statement card.">
        <Card variant="container" className="max-w-5xl">
          <Tabs
            label="Statements"
            tabs={[
              { value: "performance", label: "Business Performance" },
              { value: "pnl", label: "PNL" },
            ]}
          />
        </Card>
      </DocSection>
    </DocPage>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("tablist", { name: "Rounds" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: /Round-4/ }));
    await expect(canvas.getByRole("tab", { name: /Round-4/ })).toHaveAttribute("aria-selected", "true");
  },
};

// A simulation runs up to ten rounds; the eighth is under way.
const tenRounds = Array.from({ length: 10 }, (_, index) => {
  const round = index + 1;
  return { value: String(round), label: <RoundLabel round={round} state={round < 8 ? "done" : round === 8 ? "current" : "later"} /> };
});

/** Ten rounds on a phone: the tabs keep their size and scroll sideways in their strip, and the current round is brought into view. */
export const ManyRoundsOnAPhone: Story = {
  globals: { viewport: { value: "phone" } },
  render: () => (
    <Card variant="container">
      <Tabs label="Rounds" tabs={tenRounds} defaultValue="8" className="-mx-(--card-padding)">
        {tenRounds.map((round) => (
          <TabsPanel key={round.value} value={round.value} className="px-(--card-padding) pt-6">
            <Text tone="muted">Round {round.value}: status, events and metrics.</Text>
          </TabsPanel>
        ))}
      </Tabs>
    </Card>
  ),
  play: async ({ canvas }) => {
    const strip = canvas.getByRole("tablist", { name: "Rounds" }).parentElement;
    if (!strip) throw new Error("The tab list has no strip");
    const tabs = canvas.getAllByRole("tab");
    // Every label keeps its width: none is cut, none runs into the next tab.
    for (const [index, tab] of tabs.entries()) {
      await expect(tab.scrollWidth).toBeLessThanOrEqual(tab.clientWidth);
      const next = tabs[index + 1];
      if (next) await expect(tab.getBoundingClientRect().right).toBeLessThanOrEqual(next.getBoundingClientRect().left + 0.5);
    }
    // The strip scrolls, and the current round is in view.
    await expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
    const current = canvas.getByRole("tab", { name: /Round-8/ });
    await waitFor(async () => {
      const tabBox = current.getBoundingClientRect();
      const stripBox = strip.getBoundingClientRect();
      await expect(tabBox.left).toBeGreaterThanOrEqual(stripBox.left);
      await expect(tabBox.right).toBeLessThanOrEqual(stripBox.right);
    });
  },
};
