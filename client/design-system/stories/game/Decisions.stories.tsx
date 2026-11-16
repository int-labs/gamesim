import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent } from "storybook/test";
import {
  Card,
  DecisionCell,
  DecisionPanel,
  DecisionRow,
  DecisionTile,
  DecisionTiles,
  Figure,
  Figures,
  NumberField,
  NumberFormatProvider,
  PreviousValue,
  ReadOnlyField,
  ReadOnlyValue,
  ResourceChip,
  ResourceChips,
  Select,
  Slider,
  Text,
  type NumberFieldProps,
} from "../../src";
import { figmaButtonContrastException, submittedDecisionsContrastException } from "../support/a11y";

const meta = {
  title: "Game/Decisions",
  parameters: {
    layout: "padded",
    // White on the pink cost chip is the open contrast decision (README), as on the pink button.
    ...figmaButtonContrastException,
    docs: {
      description: {
        component:
          "The player's decisions (Figma's bank rows in the 'Set Your Strategy Inputs' panel): a title chip and its description, and the control at the end. The title and description label and describe the control, so a NumberField inside needs no aria-label.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A field whose value lives in the page, as on the decision pages. */
function Field({ initial = 0, ...props }: Omit<NumberFieldProps, "value" | "onValueChange"> & { initial?: number }) {
  const [value, setValue] = useState(initial);
  return <NumberField value={value} onValueChange={setValue} {...props} />;
}

/** A level slider's row: the level beside the title, the thumb on this round's change (-2 to 5). */
function LevelRow({ label, description, disabled, chips = false }: { label: string; description: string; disabled: boolean; chips?: boolean }) {
  const [change, setChange] = useState(0);
  return (
    <DecisionRow label={label} description={description} level={{ value: 18 + change, change }} control="slider" disabled={disabled}>
      <Slider min={-2} max={5} fillFrom={0} value={change} onValueChange={setChange} />
      {chips ? (
        // The cost and the energy follow the level, as on today's page.
        <ResourceChips>
          <ResourceChip kind="cost" value={250_000_000 + change * 50_000_000} />
          <ResourceChip kind="energy" value={20 + change * 5} />
        </ResourceChips>
      ) : null}
    </DecisionRow>
  );
}

function LoanDecisions({ disabled = false }: { disabled?: boolean }) {
  return (
    // The panel sits in the product card, beside the charts (Figma's Products 711:97660).
    <Card variant="container" className="sm:w-fit">
      <DecisionPanel title="Set Your Strategy Inputs" className="sm:w-(--decision-panel-width)">
        <DecisionRow label="Projected Market Share (%)" description="Estimated share of market that you plan to capture this year." disabled={disabled}>
          <Field kind="percent" decimals={1} fixedDecimals emphasis />
          <PreviousValue value="12.5%" />
        </DecisionRow>
        <DecisionRow
          label="Average Interest Rate (%)"
          description="The weighted average percentage rate charged across all loan products in your portfolio."
          disabled={disabled}
        >
          <Field kind="percent" decimals={1} fixedDecimals initial={6.5} />
          <PreviousValue value="6.0%" />
        </DecisionRow>
        <LevelRow
          label="Features of Products"
          description="The breadth and sophistication level of features you offer on this product."
          disabled={disabled}
          chips
        />
        <DecisionRow label="Marketing Spend ($)" description="The total budget allocated to promote your offerings." disabled={disabled}>
          <Field kind="currency" decimals={0} />
          <PreviousValue value="$5k" />
        </DecisionRow>
        <LevelRow
          label="Minimum Credit Score Change"
          description="Adjust the change to the minimum credit score required for loan approvals."
          disabled={disabled}
        />
      </DecisionPanel>
    </Card>
  );
}

/**
 * Figma's Retail Mass - Loan panel (5204:98482): each decision's title chip and description, then
 * its field and last round's value, or its slider, with the level beside the title and the cost
 * and energy under the slider.
 */
export const StrategyInputs: Story = {
  render: () => <LoanDecisions />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("region", { name: "Set Your Strategy Inputs" })).toBeInTheDocument();
    const share = canvas.getByRole("textbox", { name: "Projected Market Share (%)" });
    await expect(share).toHaveAccessibleDescription(/Estimated share of market that you plan to capture this year\./);
    await expect(canvas.getByRole("textbox", { name: "Marketing Spend ($)" })).toBeEnabled();
    const features = canvas.getByRole("slider", { name: "Features of Products" });
    await expect(features).toHaveAccessibleDescription(/The breadth and sophistication level of features you offer on this product\./);
    await expect(features).toHaveAttribute("aria-valuenow", "0");
  },
};

/** Moving a level's slider changes the level beside the title and the cost and energy under it (Figma flow 2134:165928). */
export const LevelFollowsTheSlider: Story = {
  tags: ["no-screenshot"],
  render: () => <LoanDecisions />,
  play: async ({ canvas }) => {
    const features = canvas.getByRole("slider", { name: "Features of Products" });
    features.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(features).toHaveAttribute("aria-valuenow", "1");
    await expect(canvas.getByText("19")).toBeInTheDocument();
    await expect(canvas.getByText("(+1)")).toBeInTheDocument();
    await expect(canvas.getByText("Cost: $300M")).toBeInTheDocument();
    await expect(canvas.getByText("Energy: 25")).toBeInTheDocument();
  },
};

/** After Submit: each decision's field or slider, and what is under it, dims to 40% and stops answering; the titles stay. */
export const Submitted: Story = {
  parameters: submittedDecisionsContrastException,
  render: () => <LoanDecisions disabled />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Marketing Spend ($)" })).toBeDisabled();
    await expect(canvas.getByRole("slider", { name: "Features of Products" })).toBeDisabled();
  },
};

/** Figma's other slider rows: a score from 0 to 10 (864:26041) and words (1367:50644), each with last round's value 16 under it. */
export const SliderKinds: Story = {
  render: function Render() {
    const [risk, setRisk] = useState(3);
    const [fee, setFee] = useState(2);
    const fees = ["Very Low", "Low", "Medium", "High", "Very High"];
    return (
      <Card variant="container" className="sm:w-fit">
        <DecisionPanel title="Set Your Strategy Inputs" className="sm:w-(--decision-panel-width)">
          <DecisionRow label="Risk Level" description="Indicates the financial risk exposure of a product." control="slider">
            <Slider min={0} max={10} value={risk} onValueChange={setRisk} />
            <PreviousValue value={3} />
          </DecisionRow>
          <DecisionRow label="Transaction Fee" description="The fee charged on each transaction." control="slider">
            <Slider labels={fees} value={fee} onValueChange={setFee} />
            <PreviousValue value="Medium" />
          </DecisionRow>
        </DecisionPanel>
      </Card>
    );
  },
};

/** A level's options with what each costs, as Figma's level menu (778:144363). The cost and energy grow with the level. */
const levels = [-2, -1, 0, 1, 2, 3, 4].map((change) => ({
  value: String(change),
  label: change > 0 ? `+${change}` : String(change),
  cost: Math.max(0, change) * 1_000_000,
  energy: Math.max(0, change) * 8,
}));

function DropdownDecisions({ disabled = false }: { disabled?: boolean }) {
  const [salary, setSalary] = useState<string | null>("medium");
  const [level, setLevel] = useState<string | null>("0");
  const chosen = levels.find((option) => option.value === level) ?? levels[2]!;
  return (
    <Card variant="container" className="sm:w-fit">
      <DecisionPanel title="Set Your Strategy Inputs" className="sm:w-(--decision-panel-width)">
        <DecisionRow label="Salary Level" description="What you pay your staff against the market." disabled={disabled}>
          <Select
            variant="decision"
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            value={salary}
            onValueChange={setSalary}
          />
          <PreviousValue value="Medium" />
        </DecisionRow>
        <DecisionRow label="Branch Network Level" description="How many branches serve this product's customers." disabled={disabled}>
          <Select
            variant="decision"
            options={levels.map((option) => ({
              value: option.value,
              label: option.label,
              // The biggest step needs a prerequisite the team has not met, as today's options can.
              disabled: option.value === "4",
              detail: (
                <>
                  <ResourceChip kind="energy" value={option.energy} size="sm" />
                  <ResourceChip kind="cost" value={option.cost} size="sm" />
                </>
              ),
            }))}
            value={level}
            onValueChange={setLevel}
          />
          <ResourceChips>
            <ResourceChip kind="cost" value={chosen.cost} />
            <ResourceChip kind="energy" value={chosen.energy} />
          </ResourceChips>
          <PreviousValue value="0" />
        </DecisionRow>
      </DecisionPanel>
    </Card>
  );
}

/**
 * Figma's dropdown decisions (864:34310): the decision field with a chevron and the value at its
 * end, last round's value under it; a level's cost and energy under its field, as today's.
 */
export const Dropdowns: Story = {
  render: () => <DropdownDecisions />,
  play: async ({ canvas }) => {
    const salary = canvas.getByRole("combobox", { name: "Salary Level" });
    await expect(salary).toHaveAccessibleDescription(/What you pay your staff against the market\./);
    await expect(salary).toHaveTextContent("Medium");
  },
};

/** A level's menu: each option with its energy and cost beside it (Figma 778:144363); one not yet open to the team. */
export const DropdownMenu: Story = {
  render: () => <DropdownDecisions />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: "Branch Network Level" }));
    const option = await screen.findByRole("option", { name: /^\+2/ });
    await expect(option).toHaveTextContent("Energy: 16");
    await expect(screen.getByRole("option", { name: /^\+4/ })).toHaveAttribute("aria-disabled", "true");
  },
};

/** After Submit the dropdowns dim with their column, as the fields do. */
export const DropdownsSubmitted: Story = {
  parameters: submittedDecisionsContrastException,
  render: () => <DropdownDecisions disabled />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox", { name: "Salary Level" })).toHaveAttribute("data-disabled");
  },
};

/** A discount on a 0% to 5% scale, in a column (Figma's compact slider). */
function Discount({ initial = 2 }: { initial?: number }) {
  const [value, setValue] = useState(initial);
  return <Slider size="sm" min={0} max={5} formatLabel={(mark) => `${mark}%`} value={value} onValueChange={setValue} />;
}

function ChannelExecution({ columns, disabled = false }: { columns: string[]; disabled?: boolean }) {
  return (
    // ShopLink's product card: 24 inside, as Figma draws it.
    <Card variant="container" className="p-(--card-padding-lg) sm:w-fit">
      <DecisionPanel title="Channel Execution" description="Set specific pricing to capture market share in each channel." columns={columns}>
        <DecisionRow label="Projected Market Share (%)" description="Estimated portion of total market the product aims to capture." disabled={disabled}>
          {columns.map((column) => (
            <DecisionCell key={column}>
              <Field kind="percent" decimals={1} fixedDecimals emphasis initial={20} />
              <PreviousValue value="20%" />
            </DecisionCell>
          ))}
        </DecisionRow>
        <DecisionRow label="Pricing (Base price/unit)" description="The set selling price per unit before discounts or promotions." disabled={disabled}>
          {columns.map((column) => (
            <DecisionCell key={column}>
              <Field kind="currency" decimals={0} initial={18} />
              <PreviousValue value="$15" />
            </DecisionCell>
          ))}
        </DecisionRow>
        <DecisionRow label="Discounts (% of discount per unit)" description="Percentage reduction applied to each unit to boost sales." disabled={disabled}>
          {columns.map((column) => (
            <DecisionCell key={column}>
              <Discount />
            </DecisionCell>
          ))}
        </DecisionRow>
      </DecisionPanel>
    </Card>
  );
}

/**
 * Figma's ShopLink Channel Execution (2709:179027): a column per channel, 174 wide and 49 apart
 * with a line between them, under the channels' names; each field named by its decision and its
 * channel.
 */
export const Columns: Story = {
  render: () => <ChannelExecution columns={["Modern", "Traditional", "Online"]} />,
  play: async ({ canvas }) => {
    const pricing = canvas.getByRole("textbox", { name: "Pricing (Base price/unit), Traditional" });
    await expect(pricing).toHaveAccessibleDescription(/The set selling price per unit before discounts or promotions\./);
    await expect(canvas.getByRole("slider", { name: "Discounts (% of discount per unit), Online" })).toHaveAttribute("aria-valuetext", "2%");
  },
};

/** GrowthLab's two columns (Segment Level Decision): each 285.5 wide in the same 620. */
export const TwoColumns: Story = {
  render: () => <ChannelExecution columns={["Corporate", "Retail"]} />,
};

/** After Submit every cell dims with its row, as the single-column decisions do. */
export const ColumnsSubmitted: Story = {
  parameters: submittedDecisionsContrastException,
  render: () => <ChannelExecution columns={["Modern", "Traditional", "Online"]} disabled />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "Pricing (Base price/unit), Modern" })).toBeDisabled();
  },
};

/** On a phone the columns go under the decision's title, one under another, each with its name. */
export const ColumnsPhone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <ChannelExecution columns={["Modern", "Traditional", "Online"]} />,
};

/** A list with one entry replaced, for a value per column. */
function replaced<Value>(list: Value[], index: number, value: Value) {
  return list.map((entry, at) => (at === index ? value : entry));
}

/**
 * ShopLink's prices by channel, with the price after discounts worked out under them, as the
 * Product's read-only decisions work it out from the others.
 */
function RetailPrices({ disabled = false }: { disabled?: boolean }) {
  const columns = ["Modern", "Traditional", "Online"];
  const [prices, setPrices] = useState([18, 18, 16]);
  const [discounts, setDiscounts] = useState([2, 2, 0]);
  return (
    <Card variant="container" className="p-(--card-padding-lg) sm:w-fit">
      <DecisionPanel title="Channel Execution" description="Set specific pricing to capture market share in each channel." columns={columns}>
        <DecisionRow label="Pricing (Base price/unit)" description="The set selling price per unit before discounts or promotions." disabled={disabled}>
          {columns.map((column, index) => (
            <DecisionCell key={column}>
              <NumberField kind="currency" decimals={0} value={prices[index]!} onValueChange={(value) => setPrices(replaced(prices, index, value))} />
              <PreviousValue value="$15" />
            </DecisionCell>
          ))}
        </DecisionRow>
        <DecisionRow label="Discounts (% of discount per unit)" description="Percentage reduction applied to each unit to boost sales." disabled={disabled}>
          {columns.map((column, index) => (
            <DecisionCell key={column}>
              <Slider
                size="sm"
                min={0}
                max={5}
                formatLabel={(mark) => `${mark}%`}
                value={discounts[index]!}
                onValueChange={(value) => setDiscounts(replaced(discounts, index, value))}
              />
            </DecisionCell>
          ))}
        </DecisionRow>
        <DecisionRow label="RRP (Recommended retail price)" description="The price per unit after discounts." tone="brand">
          {columns.map((column, index) => (
            <DecisionCell key={column}>
              <ReadOnlyField>
                <ReadOnlyValue prefix="$" value={prices[index]! * (1 - discounts[index]! / 100)} decimals={2} tone="brand" />
              </ReadOnlyField>
            </DecisionCell>
          ))}
        </DecisionRow>
      </DecisionPanel>
    </Card>
  );
}

/**
 * Figma's RRP line (3628:102771): a price the round works out, in pink, "$" at the start of each
 * column and the price at its end, where a field's value would be; read with its title and column.
 */
export const RetailPrice: Story = {
  render: () => <RetailPrices />,
  play: async ({ canvas }) => {
    const rrp = canvas.getByRole("group", { name: "RRP (Recommended retail price)" });
    await expect(rrp).toHaveTextContent(/RRP \(Recommended retail price\), Modern.*\$17\.64/);
  },
};

/** The price after discounts follows the price and the discount as they change. */
export const RetailPriceFollowsThePrice: Story = {
  tags: ["no-screenshot"],
  render: () => <RetailPrices />,
  play: async ({ canvas }) => {
    const price = canvas.getByRole("textbox", { name: "Pricing (Base price/unit), Online" });
    await userEvent.clear(price);
    await userEvent.type(price, "20");
    const rrp = canvas.getByRole("group", { name: "RRP (Recommended retail price)" });
    await expect(rrp).toHaveTextContent(/RRP \(Recommended retail price\), Online.*\$20\.00/);
  },
};

/** After Submit the fields and sliders dim; the price the round works out stays as it is. */
export const RetailPriceSubmitted: Story = {
  parameters: submittedDecisionsContrastException,
  render: () => <RetailPrices disabled />,
};

/**
 * The Product's units produced: a headline figure and its capacity on a white value card, level
 * with the fields beside it; the room left, or by how much the plan exceeds it, in red.
 */
export const ValueCard: Story = {
  render: () => {
    const columns = ["Modern", "Traditional", "Online"];
    const produced = [12_000, 9_500, 16_800];
    const capacity = 15_000;
    return (
      <Card variant="container" className="p-(--card-padding-lg) sm:w-fit">
        <DecisionPanel title="Production" description="Plan what each channel's market share asks of the factory." columns={columns}>
          <DecisionRow label="Projected Market Share (%)" description="Estimated portion of total market the product aims to capture.">
            {columns.map((column) => (
              <DecisionCell key={column}>
                <Field kind="percent" decimals={1} fixedDecimals emphasis initial={20} />
                <PreviousValue value="20%" />
              </DecisionCell>
            ))}
          </DecisionRow>
          <DecisionRow label="Units Produced" description="Number of produced units based on projected market share.">
            {columns.map((column, index) => {
              const units = produced[index]!;
              return (
                <DecisionCell key={column}>
                  <ReadOnlyField variant="card">
                    <ReadOnlyValue value={units} size="lg" align="end" />
                    <ReadOnlyValue prefix="Total capacity:" value={capacity} align="end" />
                    {units <= capacity ? (
                      <ReadOnlyValue prefix="Available room:" value={capacity - units} align="end" />
                    ) : (
                      <ReadOnlyValue prefix="Exceeds by:" value={units - capacity} align="end" tone="danger" />
                    )}
                  </ReadOnlyField>
                </DecisionCell>
              );
            })}
          </DecisionRow>
        </DecisionPanel>
      </Card>
    );
  },
  play: async ({ canvas }) => {
    const units = canvas.getByRole("group", { name: "Units Produced" });
    await expect(units).toHaveTextContent(/Units Produced, Online.*16,800Total capacity:15,000Exceeds by:1,800/);
  },
};

const salaries = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/**
 * A segment's Relationship Managers, as the bank's segment page lays them out: the new RMs beside
 * the head count they change, the training level with its cost and energy, and the salary level
 * beside last round's salaries.
 */
function RelationshipManagers({ columns, disabled = false }: { columns?: 1 | 2 | 3; disabled?: boolean }) {
  const [hires, setHires] = useState(12);
  const [change, setChange] = useState(-2);
  const [salary, setSalary] = useState<string | null>("medium");
  const people = 99;
  const churn = Math.round(people * 0.05);
  return (
    <DecisionTiles columns={columns}>
      <DecisionTile
        title="Number of RMs"
        description="Number of Relationship Managers hired."
        figures={
          <Figures>
            <Figure label="Current Number of people:" value={people} />
            <Figure label="Estimated churn:" value={churn} />
            <Figure label="Total People at Year-End:" value={people - churn + hires} total />
          </Figures>
        }
        label="New RMs"
        disabled={disabled}
      >
        <NumberField decimals={0} min={0} max={people} value={hires} onValueChange={setHires} />
      </DecisionTile>
      <DecisionTile
        title="Training"
        description="Training hours or programs per RM."
        level={{ value: 20 + change, change }}
        chips={
          // The cost and the energy follow the level, as on today's page.
          <ResourceChips>
            <ResourceChip kind="cost" value={Math.max(0, 250_000_000 + change * 50_000_000)} />
            <ResourceChip kind="energy" value={Math.max(0, 20 + change * 5)} />
          </ResourceChips>
        }
        disabled={disabled}
      >
        <Slider min={-2} max={5} fillFrom={0} value={change} onValueChange={setChange} />
      </DecisionTile>
      <DecisionTile
        title="Salary"
        description="Annual cost per Relationship Manager."
        figures={
          <Figures>
            <Figure label="Past Salary" value="$99,999" />
            <Figure label="Average Salary" value="$104,000" total />
          </Figures>
        }
        label="Salary Level"
        disabled={disabled}
      >
        <Select variant="decision" options={salaries} value={salary} onValueChange={setSalary} />
      </DecisionTile>
    </DecisionTiles>
  );
}

/**
 * Figma's segment card (870:34335): a tile per decision, the title in its chip over the caption and
 * a line; at the bottom the round's figures beside the field and its label, or the slider with its
 * chips stacked beside it. The tiles share the tallest one's height.
 */
export const SegmentCard: Story = {
  render: () => <RelationshipManagers />,
  play: async ({ canvas }) => {
    const rms = canvas.getByRole("group", { name: "Number of RMs" });
    await expect(rms).toBeInTheDocument();
    const hires = canvas.getByRole("textbox", { name: "New RMs" });
    await expect(hires).toHaveAccessibleDescription(/Number of Relationship Managers hired\./);
    await expect(canvas.getByRole("slider", { name: "Training" })).toHaveAttribute("aria-valuenow", "-2");
    await expect(canvas.getByRole("combobox", { name: "Salary Level" })).toHaveTextContent("Medium");
  },
};

/** The figures follow the field: the year-end head count adds the new RMs as they are typed. */
export const FiguresFollowTheField: Story = {
  tags: ["no-screenshot"],
  render: () => <RelationshipManagers />,
  play: async ({ canvas }) => {
    const hires = canvas.getByRole("textbox", { name: "New RMs" });
    await userEvent.clear(hires);
    await userEvent.type(hires, "20");
    await expect(canvas.getByText("114")).toBeInTheDocument();
  },
};

/** One tile to a row, at full width (Figma's Variant2, 873:88469): the figures keep their width and the field fills the rest. */
export const SegmentCardStacked: Story = {
  render: () => <RelationshipManagers columns={1} />,
};

/** A narrower card puts fewer tiles in a row: each keeps at least Figma's 341. */
export const SegmentCardTablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
  render: () => <RelationshipManagers />,
};

/** After Submit each tile's control and chips dim to 40% and stop answering; the figures stay. */
export const SegmentCardSubmitted: Story = {
  parameters: submittedDecisionsContrastException,
  render: () => <RelationshipManagers disabled />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: "New RMs" })).toBeDisabled();
    await expect(canvas.getByRole("slider", { name: "Training" })).toBeDisabled();
  },
};

/** On a phone one tile to a row; a field without room beside the figures goes under them. */
export const SegmentCardPhone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <RelationshipManagers />,
};

/** On a phone each field or slider goes under its title, at full width. */
export const Phone: Story = {
  globals: { viewport: { value: "phone", isRotated: false } },
  render: () => <LoanDecisions />,
};

/**
 * Figma's chips (Component 9): cost, energy and level, at 85% under the glass shadow, three to a
 * slider's width; the pointer resting on one explains it. Flat for Tech & Ops and the initiative
 * table. A cost shows its own currency's symbol.
 */
export const Chips: Story = {
  render: () => (
    <div className="flex w-(--decision-slider-width) flex-col gap-4 rounded-2xl bg-surface-panel p-4">
      <Text variant="caption" tone="muted">
        Under a slider
      </Text>
      <ResourceChips>
        <ResourceChip kind="cost" value={250_000_000} />
        <ResourceChip kind="energy" value={20} />
      </ResourceChips>
      <ResourceChips>
        <ResourceChip kind="cost" value={1_500_000} decimals={1} />
        <ResourceChip kind="energy" value={8} />
        <ResourceChip kind="level" value={18} change={1} />
      </ResourceChips>
      <Text variant="caption" tone="muted">
        Flat
      </Text>
      <ResourceChips>
        <ResourceChip kind="cost" value={250_000_000} flat />
        <ResourceChip kind="energy" value={20} flat />
      </ResourceChips>
      <Text variant="caption" tone="muted">
        Thai Baht
      </Text>
      <NumberFormatProvider currency="THB">
        <ResourceChips>
          <ResourceChip kind="cost" value={12_000_000} />
          <ResourceChip kind="energy" value={4} />
        </ResourceChips>
      </NumberFormatProvider>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("Cost: $250M")[0]).toBeInTheDocument();
    await expect(canvas.getByText("Level: 18 (+1)")).toBeInTheDocument();
    await expect(canvas.getByText("Cost: ฿12M")).toBeInTheDocument();
  },
};
