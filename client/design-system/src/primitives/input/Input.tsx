import { Input as BaseInput } from "@base-ui/react/input";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv, type VariantProps } from "../../lib/tv";

/**
 * The Preline input of the Figma file: white, a gray 200 edge, 8 px corners, a faint shadow, 16 px
 * of padding and 15 px text; a red edge when invalid. Focus adds the design system's ring. The
 * edge is an inset ring, as Figma's inside stroke: the text starts 16 px from the outside. Its
 * colour is the field edge (`--color-line-field`), which an app can raise for fields beside gray
 * 400 controls, as in a list toolbar.
 * `toolbar` is the list toolbar's search: 40 px, 6 px corners, a gray 400 edge outside the box,
 * no shadow, 12 px of padding and 16/24 text.
 */
export const inputVariants = tv({
  slots: {
    root: [
      "relative flex w-full items-center gap-(--input-gap) bg-surface-card transition duration-fast ease-standard",
      "focus-within:ring-4 focus-within:ring-focus-ring/16 focus-within:inset-ring focus-within:inset-ring-focus-ring",
      "has-data-invalid:shadow-none has-data-invalid:inset-ring-danger has-data-invalid:focus-within:ring-danger/16",
      // A locked decision's column dims as one (DecisionRow), so a field in it does not dim again.
      "control-disabled:cursor-not-allowed control-disabled:not-in-data-locked:opacity-50",
    ],
    control: [
      "h-full min-w-0 flex-1 bg-transparent text-fg-primary outline-none no-reveal",
      "placeholder:text-fg-subtle disabled:cursor-not-allowed",
    ],
    adornment: "flex shrink-0 items-center text-fg-subtle",
  },
  variants: {
    variant: {
      form: {
        root: [
          "rounded-(--input-radius) px-(--input-padding-x) shadow-xs inset-ring inset-ring-line-field",
          "hover:inset-ring-line-strong control-disabled:hover:inset-ring-line-field",
        ],
        control: "type-label",
      },
      toolbar: {
        root: "gap-2 rounded-md px-3 ring ring-line-control",
        control: "type-body-lg",
      },
      /**
       * A player's decision (Figma 2097:184137): 40 px, 6 px corners, a 1 px brand indigo 40% edge
       * outside the box, 12 px of padding, the value in 16/24, a prefix such as "$" in gray 600.
       */
      decision: {
        root: "gap-2 rounded-md px-3 ring ring-line-accent-soft",
        control: "type-body-lg",
        adornment: "type-body-lg text-fg-muted",
      },
    },
    size: {
      /** 38 px: dense tables. */
      sm: { root: "h-(--input-height-sm)" },
      /** 42 px: filters. */
      md: { root: "h-(--input-height-md)" },
      /** 47 px: forms (the Figma default). */
      lg: { root: "h-(--input-height-lg)" },
    },
    invalid: {
      true: { root: "shadow-none inset-ring-danger hover:inset-ring-danger focus-within:ring-danger/16 focus-within:inset-ring-danger" },
    },
    align: {
      start: { control: "text-start" },
      end: { control: "text-end tabular-nums" },
    },
  },
  compoundVariants: [
    // The toolbar and decision fields have their own 40 px height, whatever the size.
    { variant: ["toolbar", "decision"], class: { root: "h-10" } },
  ],
  defaultVariants: { variant: "form", size: "lg", align: "start" },
});

export interface InputProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseInput>, "className" | "size">,
    VariantProps<typeof inputVariants> {
  /** An icon before the text (a search glass, for example). */
  startIcon?: LucideIcon;
  /** An icon after the text. */
  endIcon?: LucideIcon;
  /** Anything after the text: a unit, a button (the password eye). */
  endAdornment?: ReactNode;
  className?: string;
}

/** A text input. Inside a FormField it takes its label, description and error from the field. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant, size, invalid, align, startIcon, endIcon, endAdornment, className, ...props },
  ref,
) {
  const slots = inputVariants({ variant, size, invalid, align });
  return (
    <div className={slots.root({ className })}>
      {startIcon ? (
        <span className={slots.adornment()}>
          <Icon icon={startIcon} size="md" />
        </span>
      ) : null}
      <BaseInput ref={ref} aria-invalid={invalid || undefined} className={slots.control()} {...props} />
      {endIcon ? (
        <span className={slots.adornment()}>
          <Icon icon={endIcon} size="md" />
        </span>
      ) : null}
      {endAdornment ? <span className={slots.adornment()}>{endAdornment}</span> : null}
    </div>
  );
});
