import { DollarSign, Layers, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { Tooltip } from "../../overlays/tooltip/Tooltip";

/** What a decision spends or reaches: money, energy, or its level. */
export type ResourceKind = "cost" | "energy" | "level";

export interface ResourceChipMessages {
  /** Read before the value, and the tooltip's lead. */
  name: Record<ResourceKind, string>;
  /** What each resource means, in the tooltip (Figma's words). */
  about: Record<ResourceKind, string>;
}

export const defaultResourceChipMessages: ResourceChipMessages = {
  name: { cost: "Cost", energy: "Energy", level: "Level" },
  about: {
    cost: "Financial investment required to execute a decision.",
    energy: "Effort or resources needed to implement an action.",
    level: "Quality or maturity of a product, service, or capability.",
  },
};

/**
 * A decision's cost, energy or level (Figma Component 9, 2125:327535): 24 px, 8 px corners, 6 px
 * at the sides, a 14 px icon at the start and the value in SemiBold 14/20 at the end; pink, yellow
 * or indigo at 85% under the glass shadow. `flat` is the full colour without the glass, for Tech &
 * Ops and the initiative table. `sm` is the pill beside an option in a decision's menu (778:144363):
 * 16 px, round, 2 px at the sides, a 12 px icon and Regular 12/16, always flat.
 */
export const resourceChipVariants = tv({
  slots: {
    root: "flex items-center whitespace-nowrap tabular-nums",
    icon: "shrink-0",
    value: "truncate",
    change: "type-caption font-normal",
    list: "flex justify-end gap-(--chip-list-gap)",
  },
  variants: {
    kind: {
      cost: { root: "text-fg-on-primary" },
      energy: { root: "text-fg-primary", icon: "text-fg-on-energy" },
      level: { root: "text-fg-on-accent" },
    },
    size: {
      md: {
        root: [
          "h-(--chip-height) min-w-0 flex-1 basis-0 justify-between gap-(--chip-gap) rounded-(--chip-radius) px-(--chip-padding-x)",
          "max-w-(--chip-width) type-body font-semibold",
        ],
      },
      sm: { root: "h-4 shrink-0 gap-0.5 rounded-full px-0.5 type-caption" },
    },
    flat: {
      true: {},
      false: { root: "inset-shadow-glass" },
    },
  },
  compoundVariants: [
    { kind: "cost", flat: false, class: { root: "bg-(--chip-cost-bg)" } },
    { kind: "energy", flat: false, class: { root: "bg-(--chip-energy-bg)" } },
    { kind: "level", flat: false, class: { root: "bg-(--chip-level-bg)" } },
    { kind: "cost", flat: true, class: { root: "bg-primary" } },
    { kind: "energy", flat: true, class: { root: "bg-energy" } },
    { kind: "level", flat: true, class: { root: "bg-accent" } },
  ],
  defaultVariants: { size: "md", flat: false },
});

export interface ResourceChipProps {
  kind: ResourceKind;
  /** A cost in the app's currency, an energy, or a level. */
  value: number;
  /** A cost's decimal places (today's cost digits). Default 0. */
  decimals?: number;
  /** A level's change this round, after it in brackets: "(+1)". */
  change?: number;
  flat?: boolean;
  /** `md` (default) under a decision; `sm` beside an option in its menu, flat and without the tooltip. */
  size?: "md" | "sm";
  messages?: Partial<ResourceChipMessages>;
  className?: string;
}

/**
 * A resource a decision spends or reaches, written as today's chips write it: a cost compact in the
 * app's currency ("250M" after its symbol), an energy and a level as whole numbers, a level's
 * change signed. Screen readers hear the resource and the whole amount ("Cost: $250M"); the
 * pointer resting on it shows what the resource means, as Figma draws.
 */
export function ResourceChip({ kind, value, decimals = 0, change, flat, size = "md", messages, className }: ResourceChipProps) {
  const format = useNumberFormat();
  const name = messages?.name?.[kind] ?? defaultResourceChipMessages.name[kind];
  const about = messages?.about?.[kind] ?? defaultResourceChipMessages.about[kind];
  const small = size === "sm";
  const slots = resourceChipVariants({ kind, size, flat: flat || small });
  const iconSize = small ? "xs" : "sm";

  let icon: ReactNode;
  let shown: string;
  let spoken: string;
  if (kind === "cost") {
    const parts = new Intl.NumberFormat(format.locale, {
      style: "currency",
      currency: format.currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).formatToParts(value);
    const symbol = parts.find((part) => part.type === "currency")?.value ?? "";
    shown = parts
      .filter((part) => part.type !== "currency")
      .map((part) => part.value)
      .join("")
      .trim();
    spoken = parts.map((part) => part.value).join("");
    // Figma's dollar sign is lucide's; another currency shows its own symbol in its place.
    icon = symbol === "$" ? <Icon icon={DollarSign} size={iconSize} className={slots.icon()} /> : <span aria-hidden className={slots.icon()}>{symbol}</span>;
  } else {
    shown = format.number(value);
    const signed = change === undefined ? "" : ` (${format.number(change, { signed: true })})`;
    spoken = `${shown}${signed}`;
    icon = <Icon icon={kind === "energy" ? Zap : Layers} size={iconSize} className={slots.icon()} />;
  }

  const chip = (
    <span className={slots.root({ className })}>
      {icon}
      <span className={slots.value()}>
        <span className="sr-only">
          {name}: {spoken}
        </span>
        <span aria-hidden>
          {shown}
          {kind === "level" && change !== undefined ? <span className={slots.change()}> ({format.number(change, { signed: true })})</span> : null}
        </span>
      </span>
    </span>
  );
  // In a menu the option is what the pointer rests on; the pill explains nothing more there.
  if (small) return chip;
  return (
    <Tooltip
      content={
        <>
          <strong>{name}:</strong> {about}
        </>
      }
      describe={false}
    >
      {chip}
    </Tooltip>
  );
}

export interface ResourceChipsProps {
  /** ResourceChip, one to three. */
  children: ReactNode;
  className?: string;
}

/** A decision's chips at the end of its column, 8 apart; three fill a slider's width. */
export function ResourceChips({ children, className }: ResourceChipsProps) {
  return <div className={resourceChipVariants().list({ className })}>{children}</div>;
}
