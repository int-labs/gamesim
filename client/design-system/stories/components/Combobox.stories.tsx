import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, within } from "storybook/test";
import { Combobox, type ComboboxOption } from "../../src";
import { DocPage, DocSection } from "../foundations/docs";
import { listboxScrollException } from "../support/a11y";

const meta = {
  title: "Components/Combobox",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const people: ComboboxOption[] = [
  { value: "p1", label: "Herdy Santoso", description: "herdy_intlabs@gmail.com" },
  { value: "p2", label: "Ayu Lestari", description: "ayu.lestari@example.com" },
  { value: "p3", label: "Budi Hartono", description: "budi@example.com" },
  { value: "p4", label: "Citra Wijaya", description: "citra.w@example.com" },
  { value: "p5", label: "Dewi Kartika", description: "dewi@example.com" },
  { value: "p6", label: "Eko Prasetyo", description: "eko.prasetyo@example.com" },
  { value: "p7", label: "Fajar Nugroho", description: "fajar@example.com" },
  { value: "p8", label: "Gita Ayuningtyas", description: "gita@example.com" },
];

const apps: ComboboxOption[] = [
  { value: "etprime", label: "ET Prime" },
  { value: "product", label: "Product", keywords: ["FMCG"] },
  { value: "banking", label: "Banking" },
  { value: "mall", label: "Mall" },
];

// About a thousand simulations, as an app accumulates them.
const bases = ["Novabank Growth Simulation", "Veritas Capital Market Drill", "Stratos Finance Innovation Sprint", "LynqBank Resilience Lab", "Aurora Financial Challenge"];
const simulations: ComboboxOption[] = Array.from({ length: 1000 }, (_, index) => ({
  value: `s${index + 1}`,
  label: `${bases[index % bases.length]} ${Math.floor(index / bases.length) + 1}`,
}));

function GrantPickers() {
  const [person, setPerson] = useState<string | null>(null);
  const [app, setApp] = useState<string | null>("banking");
  const [simulation, setSimulation] = useState<string | null>(null);
  return (
    <DocPage
      title="Combobox"
      intro="A select to type into, for long lists (Figma draws none): the form input with a clear button and the select's chevron, over the select's list."
    >
      <DocSection title="A grant's person, app and simulation" description="Typing narrows the list by name, email or keyword, ignoring case and accents.">
        <div className="grid max-w-3xl grid-cols-1 gap-6 rounded-2xl bg-surface-card p-6 md:grid-cols-2">
          <Combobox label="Person" required placeholder="Search by name or email" options={people} value={person} onValueChange={setPerson} />
          <Combobox label="Application" options={apps} value={app} onValueChange={setApp} />
          <Combobox
            label="Simulation"
            placeholder="Any simulation"
            description="Optional: limit the grant to one simulation."
            options={simulations}
            value={simulation}
            onValueChange={setSimulation}
          />
        </div>
      </DocSection>
    </DocPage>
  );
}

export const Fields: Story = {
  render: () => <GrantPickers />,
};

function Person() {
  const [person, setPerson] = useState<string | null>(null);
  return (
    <div className="max-w-sm rounded-2xl bg-surface-card p-6">
      <Combobox label="Person" required placeholder="Search by name or email" options={people} value={person} onValueChange={setPerson} />
    </div>
  );
}

/** Typing "ay" finds three people, by first name, family name or email; the first match is highlighted for Enter. */
export const Open: Story = {
  render: () => <Person />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: "Person" }), "ay");
    const list = await screen.findByRole("listbox");
    await expect(within(list).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Ayu Lestariayu.lestari@example.com",
      "Citra Wijayacitra.w@example.com",
      "Gita Ayuningtyasgita@example.com",
    ]);
  },
};

function Simulation() {
  const [simulation, setSimulation] = useState<string | null>(null);
  return (
    <div className="max-w-sm rounded-2xl bg-surface-card p-6">
      <Combobox label="Simulation" placeholder="Any simulation" options={simulations} value={simulation} onValueChange={setSimulation} />
    </div>
  );
}

/** A thousand simulations: the list shows the first fifty and says how many more match. */
export const ManyOptions: Story = {
  parameters: listboxScrollException,
  render: () => <Simulation />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Simulation" }));
    await expect(await screen.findByText("950 more: keep typing to narrow the list")).toBeInTheDocument();
  },
};

function RemotePerson() {
  const [person, setPerson] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  return (
    <div className="max-w-sm rounded-2xl bg-surface-card p-6">
      <Combobox
        label="Person"
        placeholder="Search by name or email"
        options={[]}
        filter={false}
        onInputChange={setQuery}
        loading={query.length > 0}
        value={person}
        onValueChange={setPerson}
      />
    </div>
  );
}

/** When the app searches on the server, the list says so until its results arrive. */
export const Searching: Story = {
  render: () => <RemotePerson />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("combobox", { name: "Person" }), "ayu");
    await expect(await screen.findByText("Searching")).toBeInTheDocument();
  },
};
