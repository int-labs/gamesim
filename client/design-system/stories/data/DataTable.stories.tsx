import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowDownAZ, Filter, Search } from "lucide-react";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  HeatCell,
  heatScores,
  Input,
  Pagination,
  Text,
  type BadgeProps,
  type DataTableColumn,
  type DataTableSort,
} from "../../src";
import { withStoryRouter } from "../support/router";

const meta = {
  title: "Data/Data table",
  decorators: [withStoryRouter],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Status = "ACTIVE" | "COMPLETED" | "DRAFT";

interface Simulation {
  id: string;
  name: string;
  status: Status;
  round: number;
  rounds: number;
  teams: number;
  created: string;
}

// The rows of the Figma Simulations list (Frame 38984).
const simulations: Simulation[] = [
  { id: "veritas", name: "Veritas Capital Market Drill", status: "ACTIVE", round: 2, rounds: 5, teams: 4, created: "4 Dec 2025" },
  { id: "stratos", name: "Stratos Finance Innovation Sprint", status: "COMPLETED", round: 5, rounds: 5, teams: 5, created: "4 Dec 2025" },
  { id: "novabank", name: "Novabank Growth Simulation", status: "DRAFT", round: 1, rounds: 5, teams: 5, created: "2 Dec 2025" },
  { id: "neobank", name: "Neobank Leadership Strategy Simulation", status: "ACTIVE", round: 2, rounds: 5, teams: 5, created: "12 Oct 2025" },
  { id: "alturabank", name: "AlturaBank Digital Shift Simulation", status: "ACTIVE", round: 4, rounds: 4, teams: 4, created: "18 Nov 2025" },
  { id: "zenith", name: "Zenith Credit Simulation Round", status: "COMPLETED", round: 4, rounds: 4, teams: 2, created: "17 Nov 2025" },
  { id: "lynqbank", name: "LynqBank Resilience Lab", status: "ACTIVE", round: 2, rounds: 5, teams: 5, created: "9 Nov 2025" },
  { id: "aurora", name: "Aurora Financial Challenge Simulation", status: "DRAFT", round: 1, rounds: 5, teams: 3, created: "12 Oct 2025" },
];

const statusTone: Record<Status, BadgeProps["tone"]> = { ACTIVE: "info", COMPLETED: "success", DRAFT: "neutral" };

// The Figma columns: the name takes the rest; the others are fixed.
const columns: DataTableColumn<Simulation>[] = [
  { id: "name", header: "Simulation Name", cell: (row) => row.name, primary: true, sortable: true },
  { id: "status", header: "Status", cell: (row) => <Badge tone={statusTone[row.status]}>{row.status}</Badge>, width: 180 },
  { id: "rounds", header: "Rounds", cell: (row) => `${row.round} / ${row.rounds}`, width: 120 },
  { id: "teams", header: "Total Team", cell: (row) => row.teams, width: 120 },
  { id: "created", header: "Created on", cell: (row) => row.created, sortable: true, width: 150 },
];

interface SimulationsListProps {
  loading?: boolean;
  empty?: boolean;
  /** Classes for the table's scrolling area. */
  tableClassName?: string;
}

function SimulationsList({ loading = false, empty = false, tableClassName }: SimulationsListProps) {
  const [sort, setSort] = useState<DataTableSort>({ column: "created", direction: "descending" });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const rows = empty ? [] : simulations;
  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <Input variant="toolbar" placeholder="Search Simulations..." aria-label="Search simulations" startIcon={Search} className="max-w-(--table-search-width)" />
        <Button variant="secondary" iconEnd={ArrowDownAZ}>
          Sort
        </Button>
        <Button variant="secondary" iconEnd={Filter}>
          Filter
        </Button>
        <Text tone="subtle" className="ms-auto">
          Total: {empty ? 0 : 104} Simulations
        </Text>
      </div>
      <DataTable
        label="Simulations"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        rowHref={(row) => `#simulations/${row.id}`}
        sort={sort}
        onSortChange={setSort}
        loading={loading}
        empty={<EmptyState title="No simulations yet" />}
        className={tableClassName}
      />
      <Pagination
        page={page}
        pageCount={empty ? 1 : 10}
        onPageChange={setPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(next) => {
          setRowsPerPage(next);
          setPage(1);
        }}
      />
    </Card>
  );
}

/** The Figma Simulations list: search, sort and filter, the table, rows per page and pagination. */
export const SimulationsListPage: Story = {
  render: () => <SimulationsList />,
};

/** Sorting, paging and rows per page are asked of the app, which answers with new rows and state. */
export const SortingAndPaging: Story = {
  // The select's list animates as it closes: the end state is checked here, not screenshotted.
  tags: ["no-screenshot"],
  render: () => <SimulationsList />,
  play: async ({ canvas }) => {
    const table = canvas.getByRole("table", { name: "Simulations" });
    await expect(within(table).getByRole("columnheader", { name: "Created on" })).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(within(table).getByRole("button", { name: "Simulation Name" }));
    await expect(within(table).getByRole("columnheader", { name: "Simulation Name" })).toHaveAttribute("aria-sort", "ascending");
    await expect(within(table).getByRole("columnheader", { name: "Created on" })).toHaveAttribute("aria-sort", "none");
    await userEvent.click(canvas.getByRole("button", { name: "Page 2" }));
    await expect(canvas.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    const rowsPerPage = canvas.getByRole("combobox", { name: "Rows per page:" });
    await userEvent.click(rowsPerPage);
    await userEvent.click(await screen.findByRole("option", { name: "25" }));
    await waitFor(() => expect(rowsPerPage).toHaveTextContent("25"));
    // A new page size starts again from the first page.
    await expect(canvas.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
  },
};

/**
 * A table given a height keeps its header in view while the rows scroll under it. The vertical
 * scrollbar runs beside the rows only, the header's slate carrying on over its gutter, as in Figma.
 */
export const StickyHeader: Story = {
  render: () => <SimulationsList tableClassName="max-h-72" />,
  play: async ({ canvas }) => {
    const table = canvas.getByRole("table", { name: "Simulations" });
    const scroller = table.parentElement;
    if (!scroller) throw new Error("The table has no scrolling area");
    // Scrolled by a row and a half: the header stays at the top, over the rows.
    scroller.scrollTop = 78;
    await waitFor(() => expect(scroller.scrollTop).toBe(78));
    const header = within(table).getByRole("columnheader", { name: "Status" });
    await expect(header.getBoundingClientRect().top).toBe(scroller.getBoundingClientRect().top);
  },
};

/**
 * A table wider than its frame, with nothing to press in it: the frame takes the keyboard's focus
 * and is named as the table, so the arrow keys scroll it. A table that fits adds no tab stop.
 */
export const Overflowing: Story = {
  render: () => (
    <Card className="max-w-sm">
      <DataTable label="Round results" columns={columns} rows={simulations} rowKey={(row) => row.id} />
    </Card>
  ),
  play: async ({ canvas }) => {
    const region = await canvas.findByRole("region", { name: "Round results" });
    await userEvent.tab();
    await expect(region).toHaveFocus();
  },
};

/** While the page loads: skeleton rows at the real row height. */
export const Loading: Story = {
  render: () => <SimulationsList loading />,
};

/** Nothing to list. */
export const Empty: Story = {
  render: () => <SimulationsList empty />,
};

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
}

const people: Person[] = [
  { id: "p1", name: "Herdy Santoso", email: "herdy_intlabs@gmail.com", role: "Administrator" },
  { id: "p2", name: "Ayu Lestari", email: "ayu@example.com", role: "Facilitator" },
  { id: "p3", name: "Budi Hartono", email: "budi@example.com", role: "Client viewer" },
];

function PeopleTable() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["p2"]));
  return (
    <Card>
      <Text tone="muted">{selected.size} selected</Text>
      <DataTable
        label="People"
        columns={[
          { id: "name", header: "Name", cell: (row: Person) => row.name, primary: true },
          { id: "email", header: "Email", cell: (row: Person) => row.email },
          { id: "role", header: "Role", cell: (row: Person) => row.role },
        ]}
        rows={people}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.name}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        rowActions={(row) => (
          <Button variant="text">
            Suspend <span className="sr-only">{row.name}</span>
          </Button>
        )}
      />
    </Card>
  );
}

/** Choosing several people for a bulk grant, with an action on each row. */
export const Selectable: Story = {
  render: () => <PeopleTable />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: "Select all rows on this page" }));
    await expect(canvas.getByText("3 selected")).toBeInTheDocument();
  },
};

interface RevenueLine {
  line: string;
  byTeam: number[];
}

const revenueTeams = ["Bankruptcy Avoidance Squad", "Juliebear Bank", "Deutsche Bonk", "Leeman Siblings", "The Loan Rangers"];
const revenueLines: RevenueLine[] = [
  { line: "Retail Mass Deposit Revenue", byTeam: [2.41, 2.12, 2.66, 2.28, 2.53] },
  { line: "Retail Mass Loan Revenue", byTeam: [1.87, 2.05, 1.59, 1.92, 1.74] },
  { line: "Retail Affluent Deposit Revenue", byTeam: [1.33, 1.33, 1.33, 1.33, 1.33] },
];

/**
 * Today's feedback revenue table: each value on the tone of its place among the teams, green for
 * the most to red for the least; a row where every team is even sits in the middle band.
 */
export const HeatColours: Story = {
  render: () => (
    <Card className="max-w-5xl">
      <DataTable
        label="Retail Revenue Breakdown"
        columns={[
          { id: "line", header: "Business Unit", cell: (row: RevenueLine) => row.line, primary: true },
          ...revenueTeams.map((team, index) => ({
            id: team,
            header: team,
            cell: (row: RevenueLine) => (
              <HeatCell score={heatScores(row.byTeam)[index] ?? 0.5}>{(row.byTeam[index] ?? 0).toFixed(2)}</HeatCell>
            ),
            align: "end" as const,
          })),
        ]}
        rows={revenueLines}
        rowKey={(row) => row.line}
      />
    </Card>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("2.66")).toHaveAttribute("data-band", "high");
    await expect(canvas.getByText("2.12")).toHaveAttribute("data-band", "low");
  },
};
