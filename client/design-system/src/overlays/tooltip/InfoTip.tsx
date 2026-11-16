import { Popover as BasePopover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../../primitives/icon-button/IconButton";
import { tokens } from "../../tokens";
import { TOOLTIP_OFFSET, TooltipBeak, tooltipVariants, type TooltipAlign, type TooltipSide } from "./Tooltip";

const DELAY = Number.parseFloat(tokens.component.tooltip.delay);

export interface InfoTipProps {
  /** Names the button: "About CSAT". */
  label: string;
  /** The explanation: a sentence or two of plain text. */
  children: ReactNode;
  /** Default `top`. */
  side?: TooltipSide;
  align?: TooltipAlign;
  /** Open from the start, as after a press. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * The info button beside a label that explains it (a KPI's "Customer Satisfaction score across
 * the company"), in the tooltip's look. The explanation shows while the pointer rests on the
 * button, and a press or a tap keeps it open until Escape, a press elsewhere or another press:
 * a tooltip does not open on a touch screen, and players read these on tablets. Screen readers
 * read it as the button's description when they reach it.
 */
export function InfoTip({ label, children, side = "top", align = "center", defaultOpen, className }: InfoTipProps) {
  const descriptionId = useId();
  const slots = tooltipVariants();
  return (
    <BasePopover.Root defaultOpen={defaultOpen}>
      <BasePopover.Trigger
        openOnHover
        delay={DELAY}
        render={<IconButton icon={Info} label={label} size="sm" iconSize="sm" aria-describedby={descriptionId} className={className} />}
      />
      {/* As a tooltip's: present while closed, so it is read on focus, and portalled, so it adds nothing to the row. */}
      {typeof document !== "undefined"
        ? createPortal(
            <span id={descriptionId} hidden>
              {children}
            </span>,
            document.body,
          )
        : null}
      <BasePopover.Portal data-ds-root="">
        <BasePopover.Positioner side={side} align={align} sideOffset={TOOLTIP_OFFSET} className={slots.positioner()}>
          {/* Focus stays on the button; the text is read through it, so the bubble is hidden from screen readers. */}
          <BasePopover.Popup initialFocus={false} aria-hidden className={slots.popup()}>
            {children}
            <BasePopover.Arrow className={slots.arrow()}>
              <TooltipBeak />
            </BasePopover.Arrow>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
