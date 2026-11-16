import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { tokens } from "../../tokens";

const MENU = tokens.component.menu;
const px = (value: string) => Number.parseFloat(value);
/** The gap between a menu and its trigger. */
const OFFSET = px(MENU.offset);
/** A submenu's gap beside its menu: the row that opens it sits inside the panel's padding and inset. */
const SUBMENU_OFFSET = OFFSET + px(MENU.padding) + px(MENU["parent-item-inset"]);

/**
 * The dropdown menus of the Figma Admin (Frame 38717: the list's Sort and Filter), measured: a
 * white panel with a black 16% edge, 12 px corners and padding, 48 px rows 4 px apart, Regular
 * 14/20 labels. A row that opens a submenu ends in a 20 px chevron and turns lavender with a
 * SemiBold label while its submenu is open; the submenu opens 12 px to the side, top to top with
 * that row, and hugs its labels. The first level is at least 210 wide and floats on a soft shadow.
 */
export const menuVariants = tv({
  slots: {
    positioner: "z-popover outline-none",
    popup: [
      "menu-popup flex flex-col gap-(--menu-gap) rounded-(--menu-radius) bg-surface-card p-(--menu-padding)",
      "inset-ring inset-ring-line-strong outline-none popover-motion motion-reduce:transition-none",
    ],
    // As the sidebar's items: a 46 px highlight inset at the sides, 2 px above the next row.
    parentItem: [
      "mx-(--menu-parent-item-inset) mb-0.5 flex h-(--menu-parent-item-height) min-w-(--menu-parent-item-width) shrink-0 cursor-pointer items-center gap-3",
      "rounded-(--menu-parent-item-radius) px-(--menu-parent-item-padding-x) type-body whitespace-nowrap text-fg-primary outline-none select-none",
      "data-highlighted:bg-surface-selected data-popup-open:bg-surface-selected data-popup-open:font-semibold",
      "data-disabled:cursor-not-allowed data-disabled:opacity-50",
    ],
    item: [
      "flex h-(--menu-item-height) shrink-0 cursor-pointer items-center gap-3 rounded-(--menu-item-radius) px-(--menu-item-padding-x)",
      "type-body whitespace-nowrap outline-none select-none",
      "data-highlighted:bg-surface-selected data-disabled:cursor-not-allowed data-disabled:opacity-50",
    ],
    label: "min-w-0 flex-1",
    chevron: "text-fg-muted",
    indicator: "flex text-fg-accent",
    // A box of its own, not display: contents, which drops the group from the accessibility tree in some browsers.
    group: "flex flex-col gap-(--menu-gap)",
    separator: "mx-(--menu-item-padding-x) my-1 h-px shrink-0 bg-line",
    groupLabel: "px-(--menu-item-padding-x) pt-2 pb-1 type-caption font-semibold text-fg-subtle",
  },
  variants: {
    nested: {
      true: {},
      false: { popup: "shadow-menu" },
    },
    tone: {
      default: { item: "text-fg-primary" },
      danger: { item: "text-fg-danger" },
    },
  },
  defaultVariants: { nested: false, tone: "default" },
});

function MenuPopup({ nested, side, align, children }: { nested: boolean; side?: MenuSide; align?: MenuAlign; children: ReactNode }) {
  const slots = menuVariants({ nested });
  return (
    <BaseMenu.Portal data-ds-root="">
      <BaseMenu.Positioner
        side={nested ? "inline-end" : side}
        align={nested ? "start" : align}
        sideOffset={nested ? SUBMENU_OFFSET : OFFSET}
        className={slots.positioner()}
      >
        <BaseMenu.Popup className={slots.popup()}>{children}</BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

type MenuSide = "top" | "bottom";
type MenuAlign = "start" | "center" | "end";

export interface MenuProps {
  /** The button that opens the menu: a Button (Sort, Filter) or an IconButton (a row's actions). */
  trigger: ReactElement;
  /** MenuItem, MenuLinkItem, MenuSubmenu, MenuRadioGroup, MenuCheckboxItem, MenuGroup, MenuSeparator. */
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Default `bottom`; the menu turns to the other side when there is no room. */
  side?: MenuSide;
  /** Default `start`: the menu's edge on the trigger's. Use `end` for a menu at the end of a table row. */
  align?: MenuAlign;
}

/**
 * A list of actions or choices under a button: the list's Sort and Filter, a row's actions. Arrow
 * keys move through it, the arrow toward a submenu opens it, typing a letter jumps to an item,
 * Escape closes it and focus returns to the button.
 */
export function Menu({ trigger, children, open, defaultOpen, onOpenChange, side = "bottom", align = "start" }: MenuProps) {
  return (
    <BaseMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={(next) => onOpenChange?.(next)}>
      <BaseMenu.Trigger render={trigger} />
      <MenuPopup nested={false} side={side} align={align}>
        {children}
      </MenuPopup>
    </BaseMenu.Root>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  /** A 16 px icon before the label. */
  icon?: LucideIcon;
  /** `danger` for an action that removes or ends something (Revoke, Suspend): red 700 text. */
  tone?: "default" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  /** Default true: choosing the item closes the menu. */
  closeOnClick?: boolean;
  /** The words typing jumps to, when the label is not plain text. */
  label?: string;
}

/** An action. To confirm it first, open a ConfirmDialog from onClick. */
export function MenuItem({ children, icon, tone, onClick, disabled, closeOnClick, label }: MenuItemProps) {
  const slots = menuVariants({ tone });
  return (
    <BaseMenu.Item onClick={onClick} disabled={disabled} closeOnClick={closeOnClick} label={label} className={slots.item()}>
      {icon ? <Icon icon={icon} size="md" /> : null}
      <span className={slots.label()}>{children}</span>
    </BaseMenu.Item>
  );
}

export interface MenuLinkItemProps {
  children: ReactNode;
  /** Where it leads. */
  href?: string;
  /** The router's link instead of href: render={<Link to="/people/42" />}. */
  render?: ReactElement;
  icon?: LucideIcon;
  label?: string;
}

/** An item that goes to a page: a real link, so it can open in a new tab. */
export function MenuLinkItem({ children, href, render, icon, label }: MenuLinkItemProps) {
  const slots = menuVariants();
  return (
    <BaseMenu.LinkItem href={href} render={render} closeOnClick label={label} className={slots.item()}>
      {icon ? <Icon icon={icon} size="md" /> : null}
      <span className={slots.label()}>{children}</span>
    </BaseMenu.LinkItem>
  );
}

export interface MenuSubmenuProps {
  /** The row's label: "Simulation Status", "Date Created". */
  label: ReactNode;
  children: ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
}

/** A row that opens a second menu beside the first, on hover, a click or the arrow key. */
export function MenuSubmenu({ label, children, icon, disabled }: MenuSubmenuProps) {
  const slots = menuVariants();
  return (
    <BaseMenu.SubmenuRoot>
      <BaseMenu.SubmenuTrigger disabled={disabled} className={slots.parentItem()}>
        {icon ? <Icon icon={icon} size="md" /> : null}
        <span className={slots.label()}>{label}</span>
        <Icon icon={ChevronRight} size="lg" stroke="regular" className={slots.chevron()} />
      </BaseMenu.SubmenuTrigger>
      <MenuPopup nested>{children}</MenuPopup>
    </BaseMenu.SubmenuRoot>
  );
}

export interface MenuRadioGroupProps<Value extends string> {
  /** The chosen value, or null when this group holds none of it (another column is sorted). */
  value: Value | null;
  onValueChange: (value: Value) => void;
  children: ReactNode;
  /** Names the group for assistive technology when the row above does not ("Sort direction"). */
  label?: string;
}

/** One choice among a few, marked with a check: a sort order, a status to filter by. */
export function MenuRadioGroup<Value extends string>({ value, onValueChange, children, label }: MenuRadioGroupProps<Value>) {
  return (
    <BaseMenu.RadioGroup value={value} onValueChange={(next: Value) => onValueChange(next)} aria-label={label} className={menuVariants().group()}>
      {children}
    </BaseMenu.RadioGroup>
  );
}

export interface MenuRadioItemProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  /** Default true: choosing applies the choice and closes the menu, as the Admin's Sort and Filter do. */
  closeOnClick?: boolean;
  /** The words typing jumps to, when the label is not plain text ("A to Z" for an arrow). */
  label?: string;
}

export function MenuRadioItem({ value, children, disabled, closeOnClick = true, label }: MenuRadioItemProps) {
  const slots = menuVariants();
  return (
    <BaseMenu.RadioItem value={value} disabled={disabled} closeOnClick={closeOnClick} label={label} className={slots.item()}>
      <span className={slots.label()}>{children}</span>
      <BaseMenu.RadioItemIndicator className={slots.indicator()}>
        <Icon icon={Check} size="md" />
      </BaseMenu.RadioItemIndicator>
    </BaseMenu.RadioItem>
  );
}

export interface MenuCheckboxItemProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  /** The words typing jumps to, when the label is not plain text. */
  label?: string;
}

/** An option that turns on and off, for filters that combine; the menu stays open. */
export function MenuCheckboxItem({ checked, onCheckedChange, children, disabled, label }: MenuCheckboxItemProps) {
  const slots = menuVariants();
  return (
    <BaseMenu.CheckboxItem
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next)}
      disabled={disabled}
      label={label}
      className={slots.item()}
    >
      <span className={slots.label()}>{children}</span>
      <BaseMenu.CheckboxItemIndicator className={slots.indicator()}>
        <Icon icon={Check} size="md" />
      </BaseMenu.CheckboxItemIndicator>
    </BaseMenu.CheckboxItem>
  );
}

/** Items under a small heading. */
export function MenuGroup({ label, children }: { label: ReactNode; children: ReactNode }) {
  const slots = menuVariants();
  return (
    <BaseMenu.Group className={slots.group()}>
      <BaseMenu.GroupLabel className={slots.groupLabel()}>{label}</BaseMenu.GroupLabel>
      {children}
    </BaseMenu.Group>
  );
}

/** A line between groups of items. */
export function MenuSeparator() {
  return <BaseMenu.Separator className={menuVariants().separator()} />;
}
