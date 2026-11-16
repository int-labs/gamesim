import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { tv } from "../../lib/tv";

/**
 * A switch for a setting that applies at once ("Hide unselected segments and products" on Create
 * Simulation). Figma's (Preline's, in a hidden row of Create Simulation): a 50 x 28 track, a 24 px
 * white thumb on a small shadow, the label SemiBold 16/24 and 16 px from the track. Figma has no
 * "on" colour, so on takes the forms' brand pink, as the checked checkbox; off, a gray 500 track
 * replaces Figma's gray 200, which the white thumb does not stand out from.
 */
export const switchVariants = tv({
  slots: {
    // The label wraps the switch, so the words flip it too.
    field: "group/switch inline-flex cursor-pointer items-center gap-(--switch-gap) select-none has-data-disabled:cursor-not-allowed",
    text: "flex min-w-0 flex-col group-has-data-disabled/switch:opacity-50",
    label: "type-body-lg font-semibold text-fg-body",
    // As a form field's help: gray 600 reads on white and on a slate panel alike.
    description: "type-body text-fg-muted",
    root: [
      "relative inline-flex h-(--switch-height) w-(--switch-width) shrink-0 cursor-pointer items-center rounded-full p-(--switch-thumb-inset)",
      "bg-(--switch-track-off) transition-colors duration-fast ease-standard data-checked:bg-primary",
      "not-data-disabled:hover:bg-(--switch-track-off-hover) not-data-disabled:group-hover/switch:bg-(--switch-track-off-hover)",
      "not-data-disabled:data-checked:hover:bg-primary-hover not-data-disabled:data-checked:group-hover/switch:bg-primary-hover",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
    ],
    thumb: [
      "block size-(--switch-thumb-size) rounded-full bg-surface-card shadow-sm transition-transform duration-fast ease-standard",
      "data-checked:translate-x-(--switch-thumb-travel) rtl:data-checked:-translate-x-(--switch-thumb-travel) motion-reduce:transition-none",
    ],
  },
});

export interface SwitchProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseSwitch.Root>, "className" | "render" | "children" | "aria-label" | "aria-labelledby"> {
  /** The words beside the switch; pressing them flips it too. */
  label?: ReactNode;
  /** A line under the label, read as the switch's description. */
  description?: ReactNode;
  /** Default `end`: the switch, then its label. `start` puts the label first, as the Create Simulation row does. */
  labelPosition?: "start" | "end";
  /** Names the switch when there is no visible label. */
  "aria-label"?: string;
  className?: string;
}

/** On or off, taking effect at once; checked, onCheckedChange, name and value as a checkbox has them. */
export function Switch({ label, description, labelPosition = "end", "aria-label": ariaLabel, className, ...props }: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  const slots = switchVariants();
  const control = (
    <BaseSwitch.Root
      // Named by the label's words alone, not the description beside them.
      aria-labelledby={label ? labelId : undefined}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={description ? descriptionId : undefined}
      className={slots.root({ className: label ? undefined : className })}
      {...props}
    >
      <BaseSwitch.Thumb className={slots.thumb()} />
    </BaseSwitch.Root>
  );
  if (!label) return control;
  const text = (
    <span className={slots.text()}>
      <span id={labelId} className={slots.label()}>
        {label}
      </span>
      {description ? (
        <span id={descriptionId} className={slots.description()}>
          {description}
        </span>
      ) : null}
    </span>
  );
  return (
    <label className={slots.field({ className })}>
      {labelPosition === "start" ? text : null}
      {control}
      {labelPosition === "end" ? text : null}
    </label>
  );
}
