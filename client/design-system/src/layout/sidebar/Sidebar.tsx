import { Button as BaseButton } from "@base-ui/react/button";
import { Collapsible } from "@base-ui/react/collapsible";
import { useRender } from "@base-ui/react/use-render";
import { AtSign, PanelLeftClose, PanelLeftOpen, Pencil, X, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { Icon } from "../../foundations/icon/Icon";
import { useReducedEffects } from "../../foundations/motion/MotionProvider";
import { tv } from "../../lib/tv";
import { Tooltip, TOOLTIP_OFFSET, TooltipProvider } from "../../overlays/tooltip/Tooltip";
import { IconButton } from "../../primitives/icon-button/IconButton";
import { tokens } from "../../tokens";
import { SidebarContext, SidebarMenuContext, useSidebar } from "./SidebarContext";

// Collapsing follows the Figma smart animate: 300 ms, ease out. The width narrows, the brand and
// labels fade and fold away, and nothing jumps; with reduced motion it all changes at once.
const move = "transition-all duration-base ease-standard motion-reduce:transition-none";

// On the rail, an item's or the account's name shows in a tooltip beside the rail, not over it:
// the tooltip's usual distance counts from the rail's edge, past its padding (and an item's margin).
const px = (value: string) => Number.parseFloat(value);
const RAIL_PADDING = px(tokens.component.sidebar.padding);
const RAIL_ITEM_TOOLTIP_OFFSET = RAIL_PADDING + px(tokens.spacing["1"]) + TOOLTIP_OFFSET;
const RAIL_ACCOUNT_TOOLTIP_OFFSET = RAIL_PADDING + TOOLTIP_OFFSET;

/**
 * The sidebar of the Figma Admin and player screens (Frame 38716): 268 px, white, a gray right
 * edge, 10 px of padding and 16 px between blocks; collapsed, a 74 px rail of icons.
 */
export const sidebarVariants = tv({
  slots: {
    root: [
      "relative flex h-full shrink-0 flex-col gap-(--sidebar-gap) overflow-hidden bg-surface-card p-(--sidebar-padding)",
      // The gray right edge is drawn over the padding, as a Figma inside stroke: it takes no width.
      "after:absolute after:inset-y-0 after:inset-e-0 after:w-px after:bg-line",
      move,
    ],
    header: "flex flex-col gap-6",
    brandGroup: "flex flex-col gap-3",
    brandRow: "flex items-center justify-between",
    brand: ["min-w-0 overflow-hidden", move],
    toggle: move,
    // pb-1 keeps the last item's focus ring inside the scrolling area.
    nav: "flex min-h-0 flex-1 flex-col gap-(--sidebar-gap) overflow-y-auto pb-1",
    footer: "flex flex-col gap-1",
  },
  variants: {
    collapsed: {
      true: {
        root: "w-(--sidebar-width-collapsed)",
        // Hidden, the brand still holds the row's height, so the rail's rows line up with the full sidebar's.
        brand: "invisible opacity-0",
        // The 32 px button sits mid-rail.
        toggle: "me-2.5",
      },
      false: {
        root: "w-(--sidebar-width)",
        brandRow: "gap-2",
        brand: "px-1",
        // The icon ends at the right edge, as in Figma; the button's own padding overhangs.
        toggle: "-me-1.5",
      },
    },
    /** Opened as the small-screen menu: as wide as the drawer, with the drawer's 24 px padding. */
    menu: {
      true: { root: "w-full p-(--sidebar-menu-padding)" },
    },
  },
});

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Controlled collapsed state. */
  collapsed?: boolean;
  /** Initial collapsed state when uncontrolled. */
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  children: ReactNode;
}

/** The sidebar frame. Put a SidebarHeader, a SidebarNav with sections and a SidebarFooter inside. */
export function Sidebar({
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  children,
  onTransitionEnd,
  ...props
}: SidebarProps) {
  const closeMenu = useContext(SidebarMenuContext);
  const reduced = useReducedEffects();
  const [uncontrolled, setUncontrolled] = useState(defaultCollapsed);
  // In the mobile menu the sidebar is always full width.
  const isCollapsed = closeMenu ? false : (collapsed ?? uncontrolled);
  // Where the width last came to rest. A name wraps onto a second line only once the sidebar has
  // finished widening: wrapping while the width moves would make the rows jump. Without the
  // animation there is nothing to wait for.
  const [restingCollapsed, setRestingCollapsed] = useState(isCollapsed);
  if (reduced && restingCollapsed !== isCollapsed) setRestingCollapsed(isCollapsed);
  const labelsWrap = !isCollapsed && !restingCollapsed;
  const setCollapsed = useCallback(
    (next: boolean) => {
      if (collapsed === undefined) setUncontrolled(next);
      onCollapsedChange?.(next);
    },
    [collapsed, onCollapsedChange],
  );
  const state = useMemo(
    () => ({ collapsed: isCollapsed, setCollapsed, closeMenu, labelsWrap }),
    [isCollapsed, setCollapsed, closeMenu, labelsWrap],
  );
  const slots = sidebarVariants({ collapsed: isCollapsed, menu: closeMenu !== undefined });
  const handleTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    onTransitionEnd?.(event);
    if (event.target === event.currentTarget && event.propertyName === "width") setRestingCollapsed(isCollapsed);
  };
  return (
    <SidebarContext.Provider value={state}>
      {/* The rail's tooltips are one group: after the first, moving along the rail shows each name at once. */}
      <TooltipProvider>
        <aside
          data-collapsed={isCollapsed || undefined}
          className={slots.root({ className })}
          onTransitionEnd={handleTransitionEnd}
          {...props}
        >
          {children}
        </aside>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

export interface SidebarHeaderProps {
  /** The brand, usually a Wordmark ("intlabs.", "LIFE Bank."). Hidden on the collapsed rail. */
  brand: ReactNode;
  /** A line 12 px under the brand, such as the player's round chip. */
  status?: ReactNode;
  /** 24 px under the brand: the SidebarAccount. */
  children?: ReactNode;
  collapseLabel?: string;
  expandLabel?: string;
  closeMenuLabel?: string;
}

/** The brand row with the collapse button (the close button in the mobile menu), and what sits under it. */
export function SidebarHeader({
  brand,
  status,
  children,
  collapseLabel = "Collapse sidebar",
  expandLabel = "Expand sidebar",
  closeMenuLabel = "Close menu",
}: SidebarHeaderProps) {
  const { collapsed, setCollapsed, closeMenu } = useSidebar();
  const slots = sidebarVariants({ collapsed });
  const toggle = closeMenu
    ? { icon: X, label: closeMenuLabel, onClick: closeMenu }
    : collapsed
      ? { icon: PanelLeftOpen, label: expandLabel, onClick: () => setCollapsed(false) }
      : { icon: PanelLeftClose, label: collapseLabel, onClick: () => setCollapsed(true) };
  return (
    <div className={slots.header()}>
      <div className={slots.brandGroup()}>
        <div className={slots.brandRow()}>
          <div className={slots.brand()} aria-hidden={collapsed || undefined}>
            {brand}
          </div>
          <IconButton
            icon={toggle.icon}
            label={toggle.label}
            iconSize="lg"
            stroke="thin"
            aria-expanded={closeMenu ? undefined : !collapsed}
            onClick={toggle.onClick}
            className={slots.toggle()}
          />
        </div>
        {status}
      </div>
      {children}
    </div>
  );
}

const accountVariants = tv({
  slots: {
    // An inset ring, not a border: like the Figma stroke it takes no room from the 12 px padding.
    root: "flex w-full items-center rounded-lg bg-surface-card text-start inset-ring inset-ring-line",
    avatar: "size-(--avatar-size-lg) shrink-0 overflow-hidden rounded-full *:size-full",
    text: "flex min-w-0 flex-1 flex-col",
    titleRow: "flex items-center justify-between gap-2.5",
    title: "min-w-0 truncate text-fg-primary",
    description: "truncate type-caption text-fg-subtle",
  },
  variants: {
    /** `compact`: one line (the Admin email chip). `profile`: two lines or an avatar (the player team card). */
    size: {
      compact: { root: "h-(--sidebar-account-height)", title: "type-caption" },
      profile: { root: "h-(--sidebar-profile-height)", title: "type-body-lg" },
    },
    collapsed: {
      true: { root: "justify-center", text: "sr-only" },
      false: { root: "gap-2" },
    },
    withAvatar: { true: {}, false: {} },
    interactive: {
      true: {
        root: [
          "cursor-pointer transition-colors duration-fast ease-standard hover:bg-surface-selected-subtle",
          "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
        ],
      },
    },
  },
  compoundVariants: [
    { collapsed: false, withAvatar: true, class: { root: "px-2" } },
    { collapsed: false, withAvatar: false, class: { root: "px-3" } },
  ],
});

export interface SidebarAccountProps {
  /** Who is signed in: an email, a name, a team name. */
  label: string;
  /** A second line under the label: a role ("Administrator"), the team leader. */
  description?: string;
  /** An avatar image, shown in a 46 px circle (the player's team card). */
  avatar?: ReactNode;
  /** What pressing the chip does, for assistive technology. Default "Edit account". */
  actionLabel?: string;
  /** Makes the chip a button with the edit pencil (change password, edit team details). */
  onClick?: () => void;
}

/**
 * Who is signed in, under the brand: the Admin's email chip, or with a second line and an avatar,
 * the player's team card. On the collapsed rail only the avatar remains, or an @, and the label
 * shows in a tooltip.
 */
export function SidebarAccount({ label, description, avatar, actionLabel = "Edit account", onClick }: SidebarAccountProps) {
  const { collapsed } = useSidebar();
  const interactive = onClick !== undefined;
  const slots = accountVariants({
    size: description || avatar ? "profile" : "compact",
    collapsed,
    withAvatar: avatar !== undefined,
    interactive,
  });
  const content = (
    <>
      {avatar ? (
        <span className={slots.avatar()}>{avatar}</span>
      ) : collapsed ? (
        <Icon icon={AtSign} size="md" className="text-fg-primary" />
      ) : null}
      <span className={slots.text()}>
        <span className={slots.titleRow()}>
          <span className={slots.title()}>{label}</span>
          {interactive && !collapsed ? <Icon icon={Pencil} size="sm" className="text-fg-subtle" /> : null}
        </span>
        {description ? <span className={slots.description()}>{description}</span> : null}
      </span>
    </>
  );
  return (
    // The name is already the chip's (its label, or its text, kept for screen readers on the rail).
    <Tooltip content={collapsed ? label : null} side="right" offset={RAIL_ACCOUNT_TOOLTIP_OFFSET} describe={false}>
      {interactive ? (
        <BaseButton onClick={onClick} aria-label={`${actionLabel}: ${label}`} className={slots.root()}>
          {content}
        </BaseButton>
      ) : (
        <div className={slots.root()}>{content}</div>
      )}
    </Tooltip>
  );
}

export interface SidebarNavProps {
  /** Names the navigation landmark. Default "Main". */
  label?: string;
  children: ReactNode;
}

/** The scrolling list of sections: a navigation landmark. */
export function SidebarNav({ label = "Main", children }: SidebarNavProps) {
  const { collapsed } = useSidebar();
  return (
    <nav aria-label={label} className={sidebarVariants({ collapsed }).nav()}>
      {children}
    </nav>
  );
}

const sectionVariants = tv({
  slots: {
    // 32 px on the rail too, where only the rule shows: the items stay put when the sidebar collapses.
    titleRow: ["flex h-8 items-center", move],
    // Figma draws the title in gray 400 (2.5:1 on white); gray 500 reads 4.8:1.
    title: ["min-w-0 max-w-full overflow-hidden type-overline whitespace-nowrap text-fg-subtle", move],
    rule: "h-px flex-1 bg-line",
  },
  variants: {
    collapsed: {
      // The title folds away but still names the group for screen readers.
      true: { titleRow: "gap-0", title: "max-w-0 opacity-0" },
      false: { titleRow: "gap-3" },
    },
  },
});

export interface SidebarSectionProps {
  /** The overline title ("Simulation management"); only a rule on the collapsed rail. */
  title?: string;
  children: ReactNode;
}

/** A group of items under an uppercase title with a rule after it. */
export function SidebarSection({ title, children }: SidebarSectionProps) {
  const { collapsed } = useSidebar();
  const id = useId();
  const slots = sectionVariants({ collapsed });
  return (
    <div role="group" aria-labelledby={title ? id : undefined} className="flex flex-col gap-1">
      {title ? (
        <div className={slots.titleRow()}>
          <span id={id} className={slots.title()}>
            {title}
          </span>
          <span aria-hidden className={slots.rule()} />
        </div>
      ) : null}
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

/**
 * A navigation item (Figma Item:margin): a 46 px link inside 4 px of margin, and under an open
 * business unit, its sub items on a 2 px rule (Figma Frame 39080). A long name takes a second
 * line and the row grows with it; past two lines it ends in an ellipsis.
 */
const itemVariants = tv({
  slots: {
    item: "flex flex-col",
    margin: "px-1 pb-0.5",
    link: [
      "flex min-h-(--sidebar-item-height) w-full cursor-pointer items-center rounded-(--sidebar-item-radius) py-1 pe-(--sidebar-item-padding-x) text-start",
      "nav-transition outline-offset-2 hover:bg-surface-selected focus-visible:outline-2 focus-visible:outline-focus-ring motion-reduce:transition-none",
    ],
    label: ["min-w-0 max-w-full type-body", move],
    // A picture in the icon's place: a business unit's own mark, a report page's.
    picture: "size-(--sidebar-icon-size) shrink-0 rounded-sm object-contain",
    subPanel: "collapse-height motion-reduce:transition-none",
    subList: [
      "ms-(--sidebar-sub-list-indent) me-1 mt-1 flex flex-col gap-(--sidebar-sub-item-gap)",
      "border-s-(length:--sidebar-divider-width) border-line ps-(--sidebar-sub-list-gap)",
    ],
    subLink: [
      "flex min-h-(--sidebar-sub-item-height) w-full cursor-pointer items-center gap-2 rounded-(--sidebar-item-radius) px-3 py-1.5 text-start type-body font-semibold text-fg-body",
      "transition-colors duration-fast ease-standard outline-offset-2 hover:bg-surface-selected-subtle focus-visible:outline-2 focus-visible:outline-focus-ring",
    ],
    subLabel: "min-w-0",
  },
  variants: {
    collapsed: {
      // On the rail the icon sits mid-item and the label folds to nothing, still read by screen readers.
      true: { link: "gap-0 ps-(--sidebar-item-padding-x-collapsed)", label: "max-w-0 opacity-0" },
      false: { link: "gap-(--sidebar-item-gap) ps-(--sidebar-item-padding-x)" },
    },
    /** Two lines at most once the sidebar is at rest at full width; one line while it moves or on the rail. */
    wrap: {
      true: { label: "line-clamp-2 wrap-break-word", subLabel: "line-clamp-2 wrap-break-word" },
      false: { label: "truncate", subLabel: "truncate" },
    },
    tone: {
      default: { link: "text-fg-primary" },
      /** Log Out. Figma's red 500 reads 3.8:1 on white; the danger text token reads 6.5:1. */
      danger: { link: "text-fg-danger" },
    },
    active: {
      true: { link: "bg-surface-selected", label: "font-semibold", subLink: "bg-surface-selected-subtle" },
    },
    /** Shown but not open yet (the business units while the team's group decisions come first). */
    disabled: {
      true: { link: "pointer-events-none opacity-50", subLink: "pointer-events-none opacity-50" },
    },
  },
  defaultVariants: { tone: "default", wrap: true },
});

type ClickHandler = (event: MouseEvent<HTMLElement>) => void;

/** The icon, or the picture in its place; a picture that can't be shown gives way to the icon. */
function ItemGlyph({ icon, picture, className }: { icon?: LucideIcon; picture?: string; className: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (picture && failed !== picture) {
    return <img src={picture} alt="" className={className} onError={() => setFailed(picture)} />;
  }
  return icon ? <Icon icon={icon} size="lg" /> : null;
}

export interface SidebarItemProps {
  /** The item's icon. */
  icon?: LucideIcon;
  /**
   * A picture in the icon's place, by its address: a business unit's own mark, a report page's
   * icon. Drawn in the icon's 20 px box; if it can't be shown, `icon` shows instead.
   */
  picture?: string;
  label: string;
  /** The current page, or for an item with sub items, the section the current page is in. */
  active?: boolean;
  /** `danger` for Log Out. */
  tone?: "default" | "danger";
  /**
   * Shown but not open yet: dimmed, out of the tab order, and choosing it does nothing (the
   * business units while the team's group decisions come first).
   */
  disabled?: boolean;
  /**
   * A link to this page; or pass `render` with the router's link. Choosing a link closes the
   * mobile menu. Without either, the item is a button, which leaves the menu open: Log Out, or
   * the open business unit when pressing it folds its products away.
   */
  href?: string;
  render?: useRender.RenderProp;
  onClick?: ClickHandler;
  /** Shows the sub items (the products of the open business unit); they fold away on the rail. */
  expanded?: boolean;
  /** SidebarSubItem elements. */
  children?: ReactNode;
}

/** A navigation item: icon and label; on the collapsed rail the icon alone, and the label in a tooltip. */
export function SidebarItem({
  icon,
  picture,
  label,
  active = false,
  tone,
  disabled = false,
  href,
  render,
  onClick,
  expanded = false,
  children,
}: SidebarItemProps) {
  const { collapsed, closeMenu, labelsWrap } = useSidebar();
  const slots = itemVariants({ collapsed, wrap: labelsWrap, tone, active, disabled });
  const isLink = href !== undefined || render !== undefined;
  const open = expanded && !collapsed;
  // With sub items, the current page is one of them: this item is the current section.
  const current = active ? (children ? "true" : "page") : undefined;
  const handleClick: ClickHandler = (event) => {
    // A router's link navigates unless the click is cancelled.
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    // Not skipped when the router's link cancels the click: that is how it navigates.
    if (isLink) closeMenu?.();
  };
  const content = (
    <>
      <ItemGlyph icon={icon} picture={picture} className={slots.picture()} />
      <span className={slots.label()}>{label}</span>
    </>
  );
  const link = useRender({
    defaultTagName: "a",
    render,
    props: {
      href,
      className: slots.link(),
      onClick: handleClick,
      "aria-current": current,
      ...(disabled ? { "aria-disabled": true, tabIndex: -1 } : {}),
      children: content,
    },
  });
  return (
    <li className={slots.item()}>
      <div className={slots.margin()}>
        {/* The label stays in the link for screen readers, so the tooltip does not repeat it. */}
        <Tooltip content={collapsed ? label : null} side="right" offset={RAIL_ITEM_TOOLTIP_OFFSET} describe={false}>
          {isLink ? (
            link
          ) : (
            <BaseButton
              className={slots.link()}
              onClick={handleClick}
              disabled={disabled}
              aria-current={current}
              aria-expanded={children ? open : undefined}
            >
              {content}
            </BaseButton>
          )}
        </Tooltip>
      </div>
      {children ? (
        <Collapsible.Root open={open}>
          <Collapsible.Panel className={slots.subPanel()}>
            <ul className={slots.subList()}>{children}</ul>
          </Collapsible.Panel>
        </Collapsible.Root>
      ) : null}
    </li>
  );
}

export interface SidebarSubItemProps {
  label: string;
  /** A small picture before the name, by its address (a report page's icon). */
  picture?: string;
  active?: boolean;
  /** Shown but not open yet: dimmed, out of the tab order, and choosing it does nothing. */
  disabled?: boolean;
  href?: string;
  render?: useRender.RenderProp;
  /** A link closes the mobile menu when chosen; without `href` or `render` the item is a button. */
  onClick?: ClickHandler;
}

/** An item under an open SidebarItem (Deposit, Loan, Credit Card), on the rule. */
export function SidebarSubItem({ label, picture, active = false, disabled = false, href, render, onClick }: SidebarSubItemProps) {
  const { closeMenu, labelsWrap } = useSidebar();
  const slots = itemVariants({ wrap: labelsWrap, active, disabled });
  const isLink = href !== undefined || render !== undefined;
  const current = active ? "page" : undefined;
  const handleClick: ClickHandler = (event) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (isLink) closeMenu?.();
  };
  const content = (
    <>
      {picture ? <ItemGlyph picture={picture} className={slots.picture()} /> : null}
      <span className={slots.subLabel()}>{label}</span>
    </>
  );
  const link = useRender({
    defaultTagName: "a",
    render,
    props: {
      href,
      className: slots.subLink(),
      onClick: handleClick,
      "aria-current": current,
      ...(disabled ? { "aria-disabled": true, tabIndex: -1 } : {}),
      children: content,
    },
  });
  return (
    <li>
      {isLink ? (
        link
      ) : (
        <BaseButton className={slots.subLink()} onClick={handleClick} disabled={disabled} aria-current={current}>
          {content}
        </BaseButton>
      )}
    </li>
  );
}

/** The bottom of the sidebar: Log Out. */
export function SidebarFooter({ children }: { children: ReactNode }) {
  return <ul className={sidebarVariants().footer()}>{children}</ul>;
}
