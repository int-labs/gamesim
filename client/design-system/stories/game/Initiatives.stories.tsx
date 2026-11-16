import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useState } from "react";
import { expect, userEvent } from "storybook/test";
import { Card, Heading, InitiativeHistory, InitiativeTable, type InitiativeRow, type InitiativeSection } from "../../src";
import { chosenBeforeContrastException, figmaButtonContrastException, submittedDecisionsContrastException } from "../support/a11y";

const meta = {
  title: "Game/Initiatives",
  parameters: {
    layout: "padded",
    // White on the pink cost chip is the open contrast decision (README), as on the pink button.
    ...figmaButtonContrastException,
    docs: {
      description: {
        component:
          "The Enterprise page's initiatives (Figma 2101:491037, 2107:219929, 2101:486664): a table to choose up to a limit of initiatives from, each with its cost and energy, and the history of earlier rounds' choices. The page decides each row's state (the limit, the energy, earlier rounds) and says why a press was refused.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const LIMIT = 3;

/** Figma's initiatives, as drawn on the Enterprise page. */
const OPTIONS: InitiativeRow[] = [
  {
    key: "ideation",
    name: "Culture of Innovation and Internal Ideation Challenge",
    description:
      "In our transition towards an agile business mindset, fostering creativity to tackle new challenges is crucial. We propose launching a series of “hackathons” involving senior and mid-level executives. Additionally, an internal ideation challenge will be initiated, inviting all employees to submit digital ideas for revenue generation, enhancing digital acquisitions, or improving processes. The winning idea will earn the opportunity to collaborate with the latest digital team initiative.",
    cost: 18_000_000,
    energy: 65,
  },
  {
    key: "rotation",
    name: "Bank-Wide Job Rotation Program",
    description: "Launch a rotation program to build cross-functional knowledge, break silos, and improve employee engagement across departments.",
    cost: 9_000_000,
    energy: 45,
  },
  {
    key: "challenge",
    name: "Culture of Innovation Challenge",
    description: "Run a company-wide ideation competition to crowdsource new ideas and promote a mindset of experimentation and creativity.",
    cost: 6_000_000,
    energy: 30,
  },
  {
    key: "risk",
    name: "Enterprise Risk Management Overhaul",
    description: "Redesign internal risk governance with modern tools, better reporting, and cross-unit risk alignment to handle future uncertainty.",
    cost: 22_000_000,
    energy: 80,
  },
  {
    key: "pink",
    name: "Road to PINK (DEI Initiative)",
    description: "Implement inclusive leadership training, policy updates, and support systems to advance diversity, equity, and inclusion across the bank.",
    cost: 12_000_000,
    energy: 40,
  },
  {
    key: "cyber",
    name: "Cybersecurity Uplift Program",
    description: "Upgrade core infrastructure and enhance employee awareness to protect the bank from increasing cyber threats and data breaches.",
    cost: 15_000_000,
    energy: 55,
  },
];

/** The page's part: the states from the choices, the limit and earlier rounds. */
function stateOf(option: InitiativeRow, chosen: string[], before: string[]): InitiativeRow {
  if (before.includes(option.key)) return { ...option, state: "before" };
  if (chosen.includes(option.key)) return { ...option, state: "chosen" };
  if (chosen.length >= LIMIT) return { ...option, state: "unavailable", reason: `You can select up to ${LIMIT} initiatives.` };
  return option;
}

function InitiativePicker({ initial = [], before = [], grouped = false, disabled = false }: { initial?: string[]; before?: string[]; grouped?: boolean; disabled?: boolean }) {
  const titleId = useId();
  const [chosen, setChosen] = useState(initial);
  const [refusal, setRefusal] = useState<string | null>(null);
  const rows = OPTIONS.map((option) => stateOf(option, chosen, before));
  const sections: InitiativeSection[] = [
    { label: "Culture and People", rows: rows.filter((row) => ["ideation", "rotation", "challenge", "pink"].includes(row.key)) },
    { label: "Risk and Security", rows: rows.filter((row) => ["risk", "cyber"].includes(row.key)) },
  ];
  return (
    // Figma's Enterprise card: 24 inside, the title 16 above the table.
    <Card variant="container" className="gap-4 p-(--card-padding-lg)">
      <Heading id={titleId} level={2} variant="panel-title">
        Select your Initiatives
      </Heading>
      <InitiativeTable
        aria-labelledby={titleId}
        rows={grouped ? undefined : rows}
        sections={grouped ? sections : undefined}
        disabled={disabled}
        onToggle={(key, on) => {
          setRefusal(null);
          setChosen(on ? [...chosen, key] : chosen.filter((entry) => entry !== key));
        }}
        onRefused={(row) => setRefusal(row.reason ?? "This initiative was already chosen in a previous round.")}
      />
      {/* The page's own alert, as Figma's (2107:220403); a toast in the app. */}
      <p role="status" className="type-body text-fg-danger">
        {refusal}
      </p>
    </Card>
  );
}

/** Figma's picker: the box, the name, the description and the cost and energy of each initiative, in a table that scrolls under its header. */
export const Picker: Story = {
  render: () => <InitiativePicker />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("table", { name: "Select your Initiatives" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("checkbox")).toHaveLength(6);
  },
};

/** Three chosen (Figma 2107:219929): their rows turn slate 200; the others can no longer be chosen, and a press on one says why. */
export const AtTheLimit: Story = {
  render: () => <InitiativePicker initial={["ideation", "challenge", "risk"]} />,
  play: async ({ canvas }) => {
    const rotation = canvas.getByRole("checkbox", { name: "Bank-Wide Job Rotation Program" });
    await expect(rotation).toHaveAccessibleDescription("You can select up to 3 initiatives.");
    await userEvent.click(canvas.getByText(/Launch a rotation program/));
    await expect(canvas.getByRole("status")).toHaveTextContent("You can select up to 3 initiatives.");
  },
};

/** The next round (Figma 2230:184619): initiatives chosen before stay checked, dimmed, and cannot be chosen again. */
export const ChosenBefore: Story = {
  parameters: chosenBeforeContrastException,
  render: () => <InitiativePicker before={["ideation", "risk"]} initial={["rotation"]} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("checkbox", { name: "Enterprise Risk Management Overhaul" })).toHaveAccessibleDescription("Chosen in an earlier round.");
  },
};

/** Initiatives in groups (today's sections), each under its band. */
export const Sections: Story = {
  render: () => <InitiativePicker grouped initial={["challenge"]} />,
};

/** After Submit no box answers; the choices stay marked. */
export const Submitted: Story = {
  parameters: submittedDecisionsContrastException,
  render: () => <InitiativePicker initial={["ideation", "challenge"]} disabled />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("checkbox", { name: "Cybersecurity Uplift Program" })).toHaveAttribute("data-disabled");
  },
};

/** On a phone the table keeps its columns and scrolls sideways within its frame. */
export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <InitiativePicker initial={["challenge"]} />,
};

function HistoryCard({ empty = false }: { empty?: boolean }) {
  const titleId = useId();
  return (
    <Card variant="container" className="gap-4 p-(--card-padding-lg)">
      <Heading id={titleId} level={2} variant="panel-title">
        Initiatives History
      </Heading>
      <InitiativeHistory
        aria-labelledby={titleId}
        rounds={
          empty
            ? []
            : [
                {
                  round: "Round 1",
                  date: "Wed 16 Apr, 2:13 PM",
                  initiatives: ["Branch Re-design and Concept Branches", "Global Industry Framework", "Consistent Omni-Channel Experience"],
                },
                {
                  round: "Round 2",
                  date: "Fri 18 Apr, 12:00 PM",
                  initiatives: ["Branch Manager as CEO", "Branch Re-design and Concept Branches", "Consistent Omni-Channel Experience"],
                },
              ]
        }
      />
    </Card>
  );
}

/** Figma's history (2101:486664): each earlier round, when it was submitted, and its initiatives as a list. */
export const History: Story = {
  render: () => <HistoryCard />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("table", { name: "Initiatives History" })).toBeInTheDocument();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(6);
  },
};

/** Before any round has initiatives. */
export const HistoryEmpty: Story = {
  render: () => <HistoryCard empty />,
};
