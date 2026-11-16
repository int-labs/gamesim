import { Zap } from "lucide-react";
import { useAnimate } from "motion/react";
import { useEffect, useRef } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { useReducedEffects } from "../../foundations/motion/MotionProvider";
import { nudge, successPop } from "../../foundations/motion/presets";
import { tv } from "../../lib/tv";
import { Tooltip } from "../../overlays/tooltip/Tooltip";

/**
 * The energy left this round, beside Submit (Figma Frame 35): brand yellow, 12 px corners, a
 * 20 px zap and the number in SemiBold 16/24 gray 950. On the desktop bar the yellow is at 80%
 * with the glass shadow; on tablets and phones it is solid. As today's pill, it turns red while the
 * decisions cost more energy than is left or a move is refused, and a refusal also nudges it with a
 * red glow. KpiBarActions gives it Figma's width.
 */
export const energyPillVariants = tv({
  slots: {
    root: [
      "flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-energy px-2 type-body-lg font-semibold text-fg-on-energy tabular-nums",
      "transition duration-fast ease-standard xl:bg-energy/80 xl:inset-shadow-glass motion-reduce:transition-none",
    ],
  },
  variants: {
    /** Over, or refusing a move: today's red 200. The text is red 800 (the Figma red badge), which
        reads at 5.7:1 there; today's red 700 falls just short of 4.5. */
    over: {
      true: { root: "bg-(--kpi-bar-energy-over-bg) text-danger-soft-fg xl:bg-(--kpi-bar-energy-over-bg)" },
    },
    refusing: {
      true: { root: "shadow-refusal ring-2 ring-danger/50" },
    },
  },
});

export interface EnergyPillProps {
  /** The energy left, or during a refused move, what would have been left. */
  value: number;
  /** The decisions cost more energy than is left. */
  over?: boolean;
  /** A move was just refused for energy: the pill nudges and glows while this is true. */
  refusing?: boolean;
  /** Shown under the pill, and read, while it is over or refusing. Default "Not enough energy. Adjust your decisions." */
  message?: string;
  /** Read before the number. Default "Energy". */
  label?: string;
  className?: string;
}

/** The round's energy, beside Submit: it announces its changes, and says when there is not enough. */
export function EnergyPill({
  value,
  over = false,
  refusing = false,
  message = "Not enough energy. Adjust your decisions.",
  label = "Energy",
  className,
}: EnergyPillProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedEffects();
  const wasRefusing = useRef(refusing);
  useEffect(() => {
    // Each new refusal nudges the pill once, as today's.
    if (refusing && !wasRefusing.current && !reduced && scope.current) {
      const { transition, ...keyframes } = nudge;
      void animate(scope.current, keyframes, transition);
    }
    wasRefusing.current = refusing;
  }, [refusing, reduced, animate, scope]);

  // A change in the energy left gives the pill a small pop, so the player sees what a decision cost.
  const previousValue = useRef(value);
  useEffect(() => {
    if (value !== previousValue.current && !refusing && !reduced && scope.current) {
      const { transition, ...keyframes } = successPop;
      void animate(scope.current, keyframes, transition);
    }
    previousValue.current = value;
  }, [value, refusing, reduced, animate, scope]);

  const warn = over || refusing;
  return (
    <Tooltip content={warn ? message : null} side="bottom" describe={false}>
      <div ref={scope} role="status" className={energyPillVariants({ over: warn, refusing }).root({ className })}>
        <Icon icon={Zap} size="lg" />
        <span className="sr-only">{label}: </span>
        <span>{value}</span>
        {warn ? <span className="sr-only">. {message}</span> : null}
      </div>
    </Tooltip>
  );
}
