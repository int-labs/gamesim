import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/layout/brand-logo";
import { WordmarkMark } from "@/components/layout/wordmark";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { WithTooltip } from "@/components/ui/tooltip";
import { DUR, EASE, SPRING } from "@/lib/motion";
import { NAV_GROUPS, groupFor, type NavEntry } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** M3 NavItem — active pill + left indicator share one FLIP layoutId (§4.3 #16). */
function NavItem({
  entry,
  collapsed,
  badge,
  index,
}: {
  entry: NavEntry;
  collapsed: boolean;
  badge?: number;
  index: number;
}) {
  const { icon: Icon, label, to } = entry;

  return (
    <NavLink to={to} end={to === "/"}>
      {({ isActive }) => (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DUR.base, ease: EASE.out, delay: Math.min(index, 14) * 0.02 }}
          className={cn(
            "group/nav relative flex h-10 items-center rounded-md transition-colors duration-150",
            collapsed ? "w-11 justify-center" : "gap-3 px-3",
            isActive
              ? "text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {isActive && (
            <>
              <motion.span
                layoutId="nav-active-pill"
                transition={SPRING.snappy}
                className="absolute inset-0 rounded-md bg-accent"
              />
              {!collapsed && (
                <motion.span
                  layoutId="nav-active-bar"
                  transition={SPRING.snappy}
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
                />
              )}
            </>
          )}
          <Icon
            className={cn(
              "relative z-10 shrink-0 transition-colors size-5",
              isActive ? "text-primary" : "group-hover/nav:text-primary"
            )}
          />
          {!collapsed && (
            <>
              <span
                className="relative z-10 flex-1 truncate font-semibold text-[13.5px]"
              >
                {label}
              </span>
              {badge != null && badge > 0 && (
                <Badge tone="count" size="sm" className="relative z-10">
                  {badge}
                </Badge>
              )}
            </>
          )}
        </motion.div>
      )}
    </NavLink>
  );
}

const OPEN_KEY = "il-nav-open";

export function Sidebar({
  collapsed,
  onToggle,
  badges,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  badges?: Record<string, number>;
  /** Kept for API compatibility with AppShell; the promo card it opened is gone. */
  onOpenPalette?: () => void;
  className?: string;
}) {
  const location = useLocation();
  let runningIndex = 0;

  // Which groups are expanded. Persisted so the console doesn't re-collapse
  // the section you were working in on every reload.
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "null");
      if (saved && typeof saved === "object") return saved;
    } catch {
      /* fall through to defaults */
    }
    return Object.fromEntries(NAV_GROUPS.map((g) => [g.eyebrow, !!g.defaultOpen]));
  });

  React.useEffect(() => {
    localStorage.setItem(OPEN_KEY, JSON.stringify(open));
  }, [open]);

  // Landing on a page inside a closed group — via the palette, a link, or a
  // reload — must not leave its section shut with the active item hidden.
  React.useEffect(() => {
    const g = groupFor(location.pathname);
    if (g) setOpen((prev) => (prev[g] ? prev : { ...prev, [g]: true }));
  }, [location.pathname]);

  return (
    <motion.aside
      aria-label="Main navigation"
      animate={{ width: collapsed ? 76 : 264 }}
      transition={SPRING.smooth}
      className={cn("flex h-dvh shrink-0 flex-col border-r border-border bg-card", className)}
    >
      {/* Logo row — the collapse control lives here, next to what it collapses. */}
      <div
        className={cn(
          "flex h-[68px] shrink-0 items-center",
          collapsed ? "justify-center px-3" : "gap-2 px-5"
        )}
      >
        {collapsed ? (
          <IconButton label="Expand sidebar" onClick={onToggle} tooltipSide="right">
            <PanelLeftOpen />
          </IconButton>
        ) : (
          <>
            <BrandLogo tone="color" width={104} className="h-[22px] dark:hidden" />
            <BrandLogo tone="white" width={104} className="hidden h-[22px] dark:block" />
            <IconButton label="Collapse sidebar" onClick={onToggle} className="ml-auto">
              <PanelLeftClose />
            </IconButton>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const isOpen = collapsed || open[group.eyebrow];
          return (
            <div key={group.eyebrow}>
              {collapsed ? (
                <div className="mx-auto mb-2 mt-3 h-px w-6 bg-border" />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [group.eyebrow]: !prev[group.eyebrow] }))
                  }
                  aria-expanded={isOpen}
                  className="mt-3 flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
                >
                  <span className="eyebrow flex-1 text-left">{group.eyebrow}</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      isOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
              )}

              {isOpen && (
                <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
                  {group.items.map((entry) => {
                    const item = (
                      <NavItem
                        key={entry.to}
                        entry={entry}
                        collapsed={collapsed}
                        badge={badges?.[entry.to]}
                        index={runningIndex++}
                      />
                    );
                    return collapsed ? (
                      <WithTooltip key={entry.to} label={entry.label} side="right">
                        <div>{item}</div>
                      </WithTooltip>
                    ) : (
                      item
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* location keeps the FLIP indicator honest across route changes */}
      <span className="sr-only">{location.pathname}</span>
    </motion.aside>
  );
}

/** Re-exported so AppShell's collapsed rail can still show the square mark. */
export { WordmarkMark };
