import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowDownAZ, Ellipsis, Filter, KeyRound, LogOut, Search, UserX } from "lucide-react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  Button,
  Card,
  FilterChip,
  IconButton,
  Input,
  Menu,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSubmenu,
  Text,
} from "../../src";

const meta = {
  title: "Components/Menu",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Structure from today's Admin, styles from Figma (the owner's rule): each filter starts with "All",
// the Filter button counts the filters that are on, and the active sort shows beside the filters.
// The labels are the Figma Filter menu's (Frame 38717) and its Sort reference board's.
const ALL = "all";

const filters = {
  status: { label: "Simulation Status", options: ["Draft", "Active", "Completed"] },
  round: { label: "Current Round", options: ["0", "1", "2", "3", "4", "5"] },
  rounds: { label: "Total Rounds", options: ["1 rounds", "2 rounds", "3 rounds", "4 rounds", "5 rounds"] },
  created: {
    label: "Date Created",
    options: ["Today", "Last 7 days", "Last 30 days", "Last 3 months", "Last 6 months", "Last 9 months", "Last 1 year"],
  },
} as const;

type FilterKey = keyof typeof filters;

const sorts = {
  name: { label: "Simulation Name", orders: ["A → Z", "Z → A"] },
  status: { label: "Simulation Status", orders: ["Active → Completed → Draft", "Draft → Active → Completed", "Completed → Active → Draft"] },
  round: { label: "Current Round", orders: ["Lowest → Highest", "Highest → Lowest"] },
  rounds: { label: "Total Rounds", orders: ["Lowest → Highest", "Highest → Lowest"] },
  created: { label: "Date Created", orders: ["Newest first", "Oldest first"] },
} as const;

type SortKey = keyof typeof sorts;

const DEFAULT_SORT = { key: "created" as SortKey, order: "Newest first" };

/** An order as it is shown, and as it is read and typed to ("A to Z" for "A → Z"). */
function Order({ order }: { order: string }) {
  return (
    <>
      <span aria-hidden>{order}</span>
      <span className="sr-only">{spoken(order)}</span>
    </>
  );
}

const spoken = (order: string) => order.split(" → ").join(" to ");

function ListToolbar() {
  const [active, setActive] = useState<Partial<Record<FilterKey, string>>>({});
  const [sort, setSort] = useState<{ key: SortKey; order: string }>(DEFAULT_SORT);
  const chips = (Object.keys(filters) as FilterKey[]).filter((key) => active[key] !== undefined);
  const sorted = sort.key !== DEFAULT_SORT.key || sort.order !== DEFAULT_SORT.order;
  const setFilter = (key: FilterKey, option: string | null) =>
    setActive((current) => {
      const next = { ...current };
      if (option === null) delete next[key];
      else next[key] = option;
      return next;
    });
  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <Input variant="toolbar" placeholder="Search Simulations..." aria-label="Search simulations" startIcon={Search} className="max-w-(--table-search-width)" />
        <Menu
          trigger={
            <Button variant="secondary" iconEnd={ArrowDownAZ}>
              Sort
            </Button>
          }
        >
          {(Object.keys(sorts) as SortKey[]).map((key) => (
            <MenuSubmenu key={key} label={sorts[key].label}>
              <MenuRadioGroup value={sort.key === key ? sort.order : null} onValueChange={(order) => setSort({ key, order })}>
                {sorts[key].orders.map((order) => (
                  <MenuRadioItem key={order} value={order} label={spoken(order)}>
                    <Order order={order} />
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuSubmenu>
          ))}
        </Menu>
        <Menu
          trigger={
            <Button variant="secondary" iconEnd={Filter}>
              {chips.length > 0 ? `Filter (${chips.length})` : "Filter"}
            </Button>
          }
        >
          {(Object.keys(filters) as FilterKey[]).map((key) => (
            <MenuSubmenu key={key} label={filters[key].label}>
              <MenuRadioGroup value={active[key] ?? ALL} onValueChange={(option) => setFilter(key, option === ALL ? null : option)}>
                <MenuRadioItem value={ALL}>All</MenuRadioItem>
                {filters[key].options.map((option) => (
                  <MenuRadioItem key={option} value={option}>
                    {option}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuSubmenu>
          ))}
        </Menu>
        <Text tone="subtle" className="ms-auto">
          Total: 104 Simulations
        </Text>
      </div>
      {chips.length > 0 || sorted ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              <Text variant="body-lg" tone="subtle">
                Active Filters:
              </Text>
              {chips.map((key) => (
                <FilterChip key={key} onRemove={() => setFilter(key, null)}>
                  {filters[key].label} - {active[key]}
                </FilterChip>
              ))}
            </div>
          ) : null}
          {sorted ? (
            <div className="flex flex-wrap items-center gap-4">
              <Text variant="body-lg" tone="subtle">
                Active Sort:
              </Text>
              <FilterChip onRemove={() => setSort(DEFAULT_SORT)}>
                {sorts[sort.key].label} - {spoken(sort.order)}
              </FilterChip>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** The Admin flow in Figma: Filter open on "Simulation Status", with today's "All" first. */
export const FilterMenu: Story = {
  render: () => <ListToolbar />,
  play: async ({ canvas }) => {
    const filter = canvas.getByRole("button", { name: "Filter" });
    await userEvent.click(filter);
    const status = await screen.findByRole("menuitem", { name: "Simulation Status" });
    await userEvent.click(status);
    await expect(await screen.findByRole("menuitemradio", { name: "Active" })).toBeInTheDocument();
    await expect(filter).toHaveAttribute("aria-expanded", "true");
  },
};

/**
 * Choosing closes the menu and shows the choice as a chip: filters after "Active Filters:", with
 * their count on the button, and a sort other than the default after "Active Sort:". Pressing a
 * chip takes it off.
 */
export const ActiveFilters: Story = {
  render: () => <ListToolbar />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Filter" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Simulation Status" }));
    await expect(await screen.findByRole("menuitemradio", { name: "All" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Active" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Filter (1)" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Date Created" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Last 30 days" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Sort" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Simulation Name" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Z to A" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: "Filter (2)" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Remove Simulation Status - Active" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Remove Date Created - Last 30 days" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Remove Simulation Name - Z to A" })).toBeInTheDocument();
    // Focus came back to Sort as its menu closed; the picture shows the row at rest.
    await userEvent.hover(canvas.getByText("Total: 104 Simulations"));
    await expect(canvas.getByRole("button", { name: "Sort" })).toHaveFocus();
    canvas.getByRole("button", { name: "Sort" }).blur();
  },
};

/** The Sort menu of the Figma reference board, open on "Simulation Name"; the current order carries a check. */
export const SortMenu: Story = {
  render: () => <ListToolbar />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sort" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Date Created" }));
    await expect(await screen.findByRole("menuitemradio", { name: "Newest first" })).toHaveAttribute("aria-checked", "true");
  },
};

interface Person {
  id: string;
  name: string;
  email: string;
}

const people: Person[] = [
  { id: "p1", name: "Herdy Santoso", email: "herdy_intlabs@gmail.com" },
  { id: "p2", name: "Ayu Lestari", email: "ayu@example.com" },
];

/** A row's actions at the end of a table row, opening toward the row's start. */
export const RowActions: Story = {
  render: () => (
    <Card className="max-w-2xl">
      <ul className="flex flex-col">
        {people.map((person) => (
          <li key={person.id} className="flex h-(--table-row-height) items-center justify-between gap-4 border-b border-line px-(--table-cell-padding-x)">
            <div className="flex min-w-0 flex-col">
              <Text variant="body-lg" tone="body" truncate>
                {person.name}
              </Text>
              <Text tone="subtle" truncate>
                {person.email}
              </Text>
            </div>
            <Menu align="end" trigger={<IconButton icon={Ellipsis} label={`Actions for ${person.name}`} />}>
              <MenuItem icon={KeyRound}>Reset password</MenuItem>
              <MenuItem icon={LogOut}>Sign out everywhere</MenuItem>
              <MenuSeparator />
              <MenuItem icon={UserX} tone="danger">
                Suspend
              </MenuItem>
            </Menu>
          </li>
        ))}
      </ul>
    </Card>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Actions for Herdy Santoso" }));
    const menu = await screen.findByRole("menu");
    await expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Reset password", "Sign out everywhere", "Suspend"]);
  },
};
