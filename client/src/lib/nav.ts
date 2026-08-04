import {
  ChartPie,
  Database,
  Eye,
  Gauge,
  GitBranch,
  Globe,
  Image,
  IterationCw,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  MonitorPlay,
  Package,
  Palette,
  Rocket,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TileTone } from "@/components/app/bits";

export type NavEntry = {
  label: string;
  to: string;
  icon: LucideIcon;
  tone: TileTone;
  /** Pages that are meaningless without an active simulation (spec §10.0). */
  scoped?: boolean;
};

export type NavGroup = {
  eyebrow: string;
  /** Groups start closed unless this is set — see the note below. */
  defaultOpen?: boolean;
  items: NavEntry[];
};

/**
 * Grouped by WHEN you use it, not by what table it maps to.
 *
 * Twenty-one flat entries under headings like "Menu" and "Catalog" put the
 * thing you touch every session (Rounds) at the same visual weight as the one
 * you touch once a year (Param List), and gave no clue which was which. The
 * split is now the platform's own: running a live session, authoring the game,
 * tuning the market model it is scored by, and the platform underneath all of
 * it.
 *
 * Only the first group is open by default. An operator mid-session sees eight
 * entries instead of twenty-one, and the authoring surface is one click away
 * rather than permanently in the way.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    // Everything here answers "what is happening in the room right now".
    eyebrow: "Session",
    defaultOpen: true,
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard, tone: "brand" },
      { label: "Simulations", to: "/simulations", icon: MonitorPlay, tone: "brand" },
      { label: "Rounds", to: "/rounds", icon: IterationCw, tone: "peri", scoped: true },
      { label: "Teams", to: "/teams", icon: Users, tone: "gold", scoped: true },
      { label: "Decisions", to: "/decisions", icon: GitBranch, tone: "brand", scoped: true },
      { label: "Results", to: "/results", icon: Trophy, tone: "gold", scoped: true },
      { label: "Projections", to: "/projections", icon: TrendingUp, tone: "success", scoped: true },
      { label: "Debrief", to: "/debrief", icon: MessageSquareText, tone: "peri", scoped: true },
    ],
  },
  {
    // The template side: what a simulation is made of, before anyone plays it.
    // Split from "Model" below because these are the things a facilitator
    // rewrites for a new client — names, copy, what teams are asked.
    eyebrow: "Game design",
    items: [
      { label: "Game Content", to: "/game-content", icon: Palette, tone: "brand" },
      { label: "Simulation Types", to: "/simulation-types", icon: Shapes, tone: "navy" },
      { label: "Products", to: "/products", icon: Package, tone: "success" },
      // Sits right after Products because that is where its rows live, but as a
      // peer: one indented entry in the whole sidebar read as a rendering bug
      // rather than as a hierarchy.
      { label: "Decision fields", to: "/product-fields", icon: ListChecks, tone: "neutral" },
      { label: "Segments", to: "/segments", icon: ChartPie, tone: "gold" },
    ],
  },
  {
    // The numbers behind the scoring. Editable, but a different job from the
    // copy above: touching these changes what the engine computes, and several
    // of them refuse edits once a round has been scored against them.
    eyebrow: "Market model",
    items: [
      { label: "Base Data", to: "/base-data", icon: Database, tone: "neutral" },
      { label: "Drivers", to: "/drivers", icon: Gauge, tone: "gold" },
      { label: "Global Inputs", to: "/global-inputs", icon: Globe, tone: "peri" },
      { label: "Initiatives", to: "/initiatives", icon: Rocket, tone: "brand" },
      // Was in a "Reference" group on the mistaken belief that it had no write
      // API. `paramRoutes.ts` is mounted at /param-list with POST, PATCH and
      // DELETE; the earlier survey looked for `paramListRoutes.ts`.
      { label: "Param List", to: "/param-list", icon: SlidersHorizontal, tone: "neutral" },
    ],
  },
  {
    eyebrow: "Platform",
    items: [
      { label: "Image Assets", to: "/image-assets", icon: Image, tone: "peri" },
      // Team pass keys live on the Teams page; this is staff accounts only.
      { label: "Staff access", to: "/users", icon: ShieldCheck, tone: "navy" },
      { label: "Player Preview", to: "/sim-preview", icon: Eye, tone: "neutral" },
    ],
  },
];

export const ALL_NAV: NavEntry[] = NAV_GROUPS.flatMap((g) => g.items);

export function navEntryFor(pathname: string): NavEntry | undefined {
  return (
    ALL_NAV.find((e) => e.to === pathname) ??
    ALL_NAV.filter((e) => e.to !== "/").find((e) => pathname.startsWith(e.to))
  );
}

/** The group an entry belongs to — used to auto-open it on navigation. */
export function groupFor(pathname: string): string | undefined {
  const entry = navEntryFor(pathname);
  if (!entry) return undefined;
  return NAV_GROUPS.find((g) => g.items.includes(entry))?.eyebrow;
}
