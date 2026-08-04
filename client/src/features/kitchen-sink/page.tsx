import {
  Calendar,
  Check,
  Download,
  Filter,
  LayoutGrid,
  List,
  Package,
  Plus,
  Rocket,
  Search,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  ActiveChip,
  CopyChip,
  DeltaChip,
  EntityCell,
  IconTile,
  ProgressLinear,
  RoleChip,
  RoundStatusChip,
  ScoreBar,
  SegmentedControl,
  SimulationStatusChip,
  Sparkline,
  Tag,
} from "@/components/app/bits";
import { Card, CardHeader } from "@/components/app/card";
import { Banner, EmptyState } from "@/components/app/feedback";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatCardSkeleton } from "@/components/app/stat-card";
import { Wordmark, WordmarkMark } from "@/components/layout/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardArrow, IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import {
  Avatar,
  AvatarGroup,
  Checkbox,
  Eyebrow,
  Kbd,
  Label,
  Separator,
  Skeleton,
  StatusDot,
  Switch,
} from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/layout/theme-toggle";

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="font-display text-[18px] font-semibold text-foreground">{title}</h2>
        {note && <span className="text-[12px] text-muted-foreground">{note}</span>}
      </div>
      <Card className="flex flex-wrap items-center gap-4">{children}</Card>
    </section>
  );
}

export default function KitchenSinkPage() {
  const [checked, setChecked] = React.useState(true);
  const [on, setOn] = React.useState(true);
  const [view, setView] = React.useState<"table" | "grid">("table");
  const [text, setText] = React.useState("Team Alpha");

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <PageHeader
        title="Kitchen sink"
        subtitle="Every atom and molecule in the Int Labs console design system. Flip the theme to check both surfaces."
        count={42}
        actions={
          <>
            <ThemeToggle />
            <Button variant="outline" shape="pill">
              <Download /> Export
            </Button>
            <Button shape="pill">
              <Plus /> Primary action
            </Button>
          </>
        }
      />

      <Section title="Brand" note="wordmark = live Poppins Bold text, not a bitmap">
        <div className="flex items-center gap-6 rounded-lg bg-white p-6">
          <Wordmark />
          <WordmarkMark />
        </div>
        <div className="flex items-center gap-6 rounded-lg bg-navy-700 p-6">
          <Wordmark variant="yellow" />
          <Wordmark variant="white" />
        </div>
        <div className="flex items-center gap-2">
          {(["#F9137D", "#2E2D7E", "#FEE606", "#525CA9", "#EBEBEB"] as const).map((c) => (
            <div key={c} className="text-center">
              <div className="size-14 rounded-md border border-border" style={{ background: c }} />
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">{c}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="A1 Button" note="pill for page-level primaries, rounded in forms">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tinted">Tinted</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">
          <Trash2 /> Delete 4 teams
        </Button>
        <Button variant="link">Link</Button>
        <Button loading>Saving…</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
        <Button size="lg" shape="pill">
          Large pill
        </Button>
      </Section>

      <Section title="A2 IconButton + CardArrow">
        <IconButton label="Search">
          <Search />
        </IconButton>
        <IconButton label="Filter" variant="outline">
          <Filter />
        </IconButton>
        <IconButton label="Add" variant="solid">
          <Plus />
        </IconButton>
        <CardArrow label="Open detail" />
        <div className="rounded-md bg-navy-700 p-2">
          <CardArrow label="Open on dark" onDark />
        </div>
      </Section>

      <Section title="A3 Badge · status chips" note="canonical gamesim mapping (spec §3.3)">
        <RoundStatusChip status="Active" />
        <RoundStatusChip status="Pending" />
        <RoundStatusChip status="Completed" />
        <SimulationStatusChip status="Active" />
        <SimulationStatusChip status="Inactive" />
        <RoleChip role="admin" />
        <RoleChip role="operator" />
        <RoleChip role="team" />
        <RoleChip role="client" />
        <ActiveChip active />
        <ActiveChip active={false} />
        <Badge tone="signal">Yellow chip</Badge>
        <Badge tone="outline">Outline</Badge>
        <Badge tone="count">12</Badge>
      </Section>

      <Section title="A4 DeltaChip · A19 ScoreBar · A14 Progress · A16 Sparkline">
        <DeltaChip value={12.4} />
        <DeltaChip value={-3.2} />
        <DeltaChip value={0} />
        <ScoreBar value={8} />
        <ScoreBar value={5} />
        <ScoreBar value={2} />
        <div className="w-40">
          <ProgressLinear value={64} />
        </div>
        <div className="w-40">
          <ProgressLinear value={40} hatchRemainder />
        </div>
        <Sparkline data={[3, 7, 4, 9, 6, 11, 8, 14]} />
      </Section>

      <Section title="A5 Avatar · A17 StatusDot · A8 Kbd · A20 Tag">
        <Avatar name="Team Alpha" size="2xl" />
        <Avatar name="Team Beta" size="xl" />
        <Avatar name="rido@int-labs.com" size="lg" />
        <AvatarGroup names={["Team Alpha", "Team Beta", "Team Gamma", "Team Delta", "Team Echo"]} />
        <div className="flex items-center gap-3">
          <StatusDot tone="success" live />
          <StatusDot tone="warning" />
          <StatusDot tone="danger" />
          <StatusDot tone="neutral" />
        </div>
        <div className="flex items-center gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </div>
        <Tag label="Status: Active" onRemove={() => {}} />
        <Tag label="Brand tag" tone="brand" onRemove={() => {}} />
        <CopyChip value="6a6c04aba3080efe29a3c173" />
      </Section>

      <Section title="A9 Input · A10 Select · A11 Checkbox · A13 Switch">
        <div className="w-56 space-y-1.5">
          <Label htmlFor="ks-name">Team name</Label>
          <Input id="ks-name" value={text} onChange={(e) => setText(e.target.value)} onClear={() => setText("")} />
        </div>
        <div className="w-56 space-y-1.5">
          <Label htmlFor="ks-search">With icon</Label>
          <Input id="ks-search" icon={<Search />} placeholder="Search teams…" />
        </div>
        <div className="w-56 space-y-1.5">
          <Label>Error state</Label>
          <Input error defaultValue="bad value" />
          <p className="text-[12px] text-destructive">End date must be after start date</p>
        </div>
        <div className="w-56 space-y-1.5">
          <Label>Status</Label>
          <Select defaultValue="Active">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1.5">
          <Label>Notes</Label>
          <Textarea placeholder="Optional description…" />
        </div>
        <label className="flex items-center gap-2.5 text-[13px] font-medium text-body">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
          Select row
        </label>
        <label className="flex items-center gap-2.5 text-[13px] font-medium text-body">
          <Switch checked={on} onCheckedChange={setOn} />
          Active
        </label>
      </Section>

      <Section title="A12 SegmentedControl">
        <SegmentedControl
          layoutId="ks-view"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table", icon: <List /> },
            { value: "grid", label: "Grid", icon: <LayoutGrid /> },
          ]}
        />
      </Section>

      <Section title="Overlays" note="Dialog · DropdownMenu · Popover · Toast">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Delete Round 3?</DialogTitle>
            <DialogDescription>
              This deletes Round 3 and its 14 decisions. Teams will need to resubmit.
            </DialogDescription>
            <DialogFooter>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">Delete round</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Row menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>
              <Check /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download /> Export CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Calendar /> Popover
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Eyebrow>Filter by status</Eyebrow>
            <div className="mt-3 space-y-2">
              {["Active", "Pending", "Completed"].map((s) => (
                <label key={s} className="flex items-center gap-2.5 text-[13px]">
                  <Checkbox defaultChecked={s === "Active"} /> {s}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" onClick={() => toast.success("Simulation created")}>
          Success toast
        </Button>
        <Button variant="outline" onClick={() => toast.error("Couldn't save — end date is before start date")}>
          Error toast
        </Button>
      </Section>

      <Section title="M15 EntityCell · IconTile">
        <div className="w-64">
          <EntityCell
            leading={<IconTile icon={<Package />} tone="success" />}
            primary="Student Notebook"
            secondary="notebook · 9 fields"
          />
        </div>
        <div className="w-64">
          <EntityCell
            leading={<Avatar name="Team Alpha" />}
            primary="Team Alpha"
            secondary="Alpha Leader"
          />
        </div>
        <IconTile icon={<Trophy />} tone="gold" />
        <IconTile icon={<Rocket />} tone="brand" />
        <IconTile icon={<Users />} tone="peri" />
        <IconTile icon={<Package />} tone="navy" />
      </Section>

      <Section title="M13 Banner">
        <div className="w-full space-y-3">
          <Banner tone="info" action={{ label: "Review decisions", onClick: () => {} }}>
            Round 2 closes in 2 h 14 m — 4 teams haven't submitted.
          </Banner>
          <Banner tone="warning">Reconnecting to the live feed…</Banner>
          <Banner tone="danger">Round calculation failed — check the server logs.</Banner>
        </div>
      </Section>

      <Separator className="my-10" />

      <h2 className="mb-4 font-display text-[18px] font-semibold text-foreground">M1 StatCard</h2>
      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          hero
          label="Active simulations"
          value={2}
          delta={12.5}
          footnote="vs last month"
          onOpen={() => {}}
        />
        <StatCard label="Teams" value={3} footnote="across 2 simulations" onOpen={() => {}} />
        <StatCard label="Decisions this round" value={0} footnote="2 teams pending" sparkline={[2, 4, 3, 6, 5, 8, 7]} />
        <StatCardSkeleton />
      </div>

      <h2 className="mb-4 font-display text-[18px] font-semibold text-foreground">
        Hero surface · M14 EmptyState · A18 Skeleton
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card hero className="flex flex-col justify-between">
          <CardHeader
            onDark
            eyebrow="Round 2 · Active"
            title="Time remaining"
            action={<CardArrow onDark label="Open round" />}
          />
          <div className="mt-6 font-display text-[44px] font-semibold leading-none tracking-tight text-hero-fg tnum">
            01:24<span className="animate-blink">:</span>08
          </div>
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-[38%] rounded-full bg-hero-accent" />
            </div>
            <p className="mt-2 text-[12px] text-hero-muted">38% of 2 h elapsed</p>
          </div>
        </Card>

        <Card padded={false}>
          <EmptyState
            icon={<Trophy />}
            title="No results yet"
            hint="Results appear once the operator calculates this round."
            action={<Button variant="outline">Open rounds</Button>}
          />
        </Card>

        <Card className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-full rounded-full" />
          <Skeleton className="h-5 w-3/4 rounded-full" />
          <div className="flex items-center gap-3 pt-2">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
