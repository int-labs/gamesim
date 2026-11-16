import { CircleX } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";

/**
 * An active filter or sort under the list toolbar (Figma 3409:196594), measured: a 28 px blue 100
 * pill, 8 px in, a 12 px circled x, 5 px, the filter in SemiBold 12/16 blue 800, 12 px out. The
 * whole chip is the button that removes it, so the target is the full 28 px.
 */
export const filterChipVariants = tv({
  base: [
    "inline-flex h-(--filter-chip-height) shrink-0 cursor-pointer items-center gap-(--filter-chip-gap) rounded-full ps-(--filter-chip-padding-start) pe-(--filter-chip-padding-end)",
    "bg-info-soft type-caption font-semibold whitespace-nowrap text-info-soft-fg transition duration-fast ease-standard hover:brightness-95",
    "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
  ],
});

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick"> {
  /** The filter, as Figma writes it: "Simulation Status - Active". */
  children: ReactNode;
  /** Removes the filter. */
  onRemove: () => void;
  /** Said before the filter by assistive technology. Default "Remove". */
  removeLabel?: string;
}

/** A filter that is on, which a press takes off. Put them in a row after a label ("Active Filter:"). */
export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { children, onRemove, removeLabel = "Remove", className, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" onClick={onRemove} className={filterChipVariants({ className })} {...props}>
      <Icon icon={CircleX} size="xs" />
      <span className="sr-only">{removeLabel} </span>
      {children}
    </button>
  );
});
