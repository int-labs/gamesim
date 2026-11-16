import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv, type VariantProps } from "../../lib/tv";

/**
 * The checkboxes of the Figma screens. `form` (Create Simulation): white with a gray 200 edge and
 * 4 px corners; checked, brand pink with a thin white check; `md` (16 px) for rows and products,
 * `lg` (24 px) for the group above them. `choice` (the initiative table, 2101:491037): 28 px, white
 * with a gray 400 edge and 8 px corners; checked, a thin gray 800 check on the white. Inside a
 * locked or dimmed row (data-locked) a disabled box does not dim again.
 */
export const checkboxVariants = tv({
  slots: {
    root: [
      "group/checkbox flex shrink-0 cursor-pointer items-center justify-center bg-surface-card inset-ring",
      "transition-colors duration-fast ease-standard outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-disabled:cursor-not-allowed data-disabled:not-in-data-locked:opacity-50",
    ],
    indicator: "flex",
  },
  variants: {
    variant: {
      form: {
        root: [
          "rounded-sm inset-ring-line-field",
          "data-checked:bg-primary data-checked:inset-ring-primary data-indeterminate:bg-primary data-indeterminate:inset-ring-primary",
        ],
        indicator: "text-fg-on-primary",
      },
      choice: { root: "rounded-lg inset-ring-line-control", indicator: "text-fg-body" },
    },
    size: {
      md: { root: "size-4" },
      lg: { root: "size-6" },
    },
  },
  // The choice box has one size, Figma's 28.
  compoundVariants: [{ variant: "choice", class: { root: "size-7" } }],
  defaultVariants: { variant: "form", size: "md" },
});

export interface CheckboxProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseCheckbox.Root>, "className">,
    VariantProps<typeof checkboxVariants> {
  /** Names the checkbox when no visible label is associated with it ("Select Novabank"). */
  "aria-label"?: string;
  className?: string;
}

/** A checkbox; checked, unchecked, or partly checked for a group whose items differ. */
export function Checkbox({ variant, size, className, ...props }: CheckboxProps) {
  const slots = checkboxVariants({ variant, size });
  return (
    <BaseCheckbox.Root className={slots.root({ className })} {...props}>
      <BaseCheckbox.Indicator className={slots.indicator()}>
        <Icon icon={Check} size="sm" className="group-data-indeterminate/checkbox:hidden" />
        <Icon icon={Minus} size="sm" className="hidden group-data-indeterminate/checkbox:block" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
