import { useSidebar } from "../../layout/sidebar/SidebarContext";
import { tv } from "../../lib/tv";

/**
 * The round chip under the player sidebar's brand (Figma Component 2): the round the simulation
 * is on, on a gray pill 32 px tall.
 */
export const roundChipVariants = tv({
  base: "flex h-8 items-center justify-center rounded-lg bg-surface-hover type-caption font-semibold text-fg-primary",
});

export interface RoundChipProps {
  /** The round the simulation is on. */
  round: number;
  /** The word before the number, in the app's language. Default "Round". */
  label?: string;
  className?: string;
}

/**
 * "Round: 1", for the SidebarHeader's `status`. On the collapsed rail it shows the number alone,
 * and the whole name to screen readers.
 */
export function RoundChip({ round, label = "Round", className }: RoundChipProps) {
  const { collapsed } = useSidebar();
  const name = `${label}: ${round}`;
  return (
    <div className={roundChipVariants({ className })}>
      {collapsed ? (
        <>
          <span aria-hidden>{round}</span>
          <span className="sr-only">{name}</span>
        </>
      ) : (
        name
      )}
    </div>
  );
}
