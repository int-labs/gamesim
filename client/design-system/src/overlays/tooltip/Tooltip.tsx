import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cloneElement, forwardRef, useId, type HTMLAttributes, type ReactElement, type ReactNode, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";
import { tv } from "../../lib/tv";
import { tokens } from "../../tokens";

const TOOLTIP = tokens.component.tooltip;
const px = (value: string) => Number.parseFloat(value);
/** From the anchor to the tooltip's body; the beak spans most of it. */
export const TOOLTIP_OFFSET = px(TOOLTIP.offset);
/** How long the pointer rests on the anchor before the tooltip opens. */
const DELAY = px(TOOLTIP.delay);

/**
 * The Figma tooltip (Preline Overlays/Tooltips; the KPI tooltip 2184:242826 and the chart tooltip
 * 3310:177953): gray 900, 8 px corners, 8/10 padding, SemiBold 14/20 white, no shadow, and a sharp
 * beak pointing at what it explains. Figma's tooltips are one line; longer text wraps at 280 px,
 * without a lone word on its last line.
 */
export const tooltipVariants = tv({
  slots: {
    positioner: "z-tooltip",
    popup: [
      "relative w-max max-w-(--tooltip-max-width) rounded-(--tooltip-radius) bg-surface-inverse px-(--tooltip-padding-x) py-(--tooltip-padding-y)",
      // Pretty, not balanced: balanced lines would leave the box at its full width around shorter lines.
      "text-center type-body font-semibold text-pretty wrap-break-word text-fg-on-inverse",
      // Between tooltips of one group (the collapsed rail) the next one appears at once.
      "popover-motion data-instant:transition-none motion-reduce:transition-none",
    ],
    arrow: "tooltip-arrow flex fill-surface-inverse",
  },
});

export type TooltipSide = "top" | "right" | "bottom" | "left";
export type TooltipAlign = "start" | "center" | "end";

export interface TooltipProps extends Omit<HTMLAttributes<HTMLElement>, "content" | "children"> {
  /** What the tooltip says: a few words of plain text, nothing to press. Empty (null, false or "") shows no tooltip, as MUI's title="". */
  content: ReactNode;
  /**
   * The element it explains: a Button, an IconButton, a link. It must take a ref and pass its
   * props on. A disabled button gets no pointer or focus events: give it `focusableWhenDisabled`
   * so its tooltip can still say why it is disabled.
   */
  children: ReactElement;
  /** Default `top`. The tooltip moves to the other side when there is no room. */
  side?: TooltipSide;
  /** Default `center`: the beak points at the anchor's middle either way. */
  align?: TooltipAlign;
  /** From the anchor to the tooltip's body, in pixels. Default 11, as Figma's. */
  offset?: number;
  /**
   * What the tooltip points at, when that is not the element it is for: a chart's bar, while
   * the whole column around it opens the tooltip.
   */
  anchor?: Element | null | RefObject<Element | null>;
  /** How long the pointer rests on the anchor before the tooltip opens, in milliseconds. Default 100; focus opens it at once. */
  delay?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Default true: assistive technology reads the text as the anchor's description, after its
   * name. Pass false when the anchor already says the same words (an IconButton whose label is
   * the tooltip, a link on the collapsed rail), so they are not read twice.
   */
  describe?: boolean;
  /** Keeps the tooltip closed. */
  disabled?: boolean;
}

/** The beak, drawn pointing up; the tooltip-arrow recipe turns it to the anchor. */
export function TooltipBeak() {
  return (
    <svg viewBox="0 0 18.25 10.75" className="size-full">
      <path d="M9.125 0 18.25 10.75H0Z" />
    </svg>
  );
}

function isEmpty(content: ReactNode) {
  return content === null || content === undefined || typeof content === "boolean" || content === "";
}

function joinIds(...ids: (string | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

/**
 * A short label or explanation that appears while the pointer rests on its anchor or while the
 * anchor has keyboard focus; Escape closes it, and the pointer can move onto it to read it.
 * Tooltips side by side (TooltipProvider) open one after the other without the delay. Only one
 * shows at a time. A tap on a touch screen does not open it (MUI's opened on a long press): what
 * a player must be able to read on a tablet belongs on the screen, or in a tip that opens on tap.
 */
export const Tooltip = forwardRef<HTMLElement, TooltipProps>(function Tooltip(
  {
    content,
    children,
    side = "top",
    align = "center",
    offset = TOOLTIP_OFFSET,
    anchor,
    delay = DELAY,
    open,
    defaultOpen,
    onOpenChange,
    describe = true,
    disabled = false,
    ...props
  },
  ref,
) {
  const descriptionId = useId();
  const empty = isEmpty(content);
  // The description lives in a hidden element of its own, present while the tooltip is closed
  // too, so it is read when the anchor gets focus. It is portalled so it adds nothing to the
  // anchor's parent, whose layout (a flex row, space-x) counts its children.
  const described = describe && !empty;
  const childDescription = (children.props as { "aria-describedby"?: string })["aria-describedby"];
  const trigger = described ? cloneElement(children, { "aria-describedby": joinIds(childDescription, descriptionId) }) : children;
  const slots = tooltipVariants();
  return (
    // Always the same tree, empty or not: switching would remount the anchor and lose its focus.
    <BaseTooltip.Root open={open} defaultOpen={defaultOpen} onOpenChange={(next) => onOpenChange?.(next)} disabled={disabled || empty}>
      {/* Base UI types the ref by its default element, a button; the anchor may be a link. */}
      <BaseTooltip.Trigger ref={ref as Ref<HTMLButtonElement>} render={trigger} delay={delay} {...props} />
      {described && typeof document !== "undefined"
        ? createPortal(
            <span id={descriptionId} hidden>
              {content}
            </span>,
            document.body,
          )
        : null}
      <BaseTooltip.Portal data-ds-root="">
        <BaseTooltip.Positioner side={side} align={align} sideOffset={offset} anchor={anchor} className={slots.positioner()}>
          {/* Read through the anchor (its name or description), so hidden here: it is not read twice. */}
          <BaseTooltip.Popup aria-hidden className={slots.popup()}>
            {content}
            <BaseTooltip.Arrow className={slots.arrow()}>
              <TooltipBeak />
            </BaseTooltip.Arrow>
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
});

/**
 * Groups tooltips that sit side by side (a KPI bar, a toolbar): once one has opened, moving to the
 * next opens it at once. The collapsed sidebar groups its own.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>;
}
