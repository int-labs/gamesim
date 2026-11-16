import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { FormField } from "../form-field/FormField";

/**
 * The Preline select of the Figma forms, measured: a white field with a gray 200 edge, 8 px
 * corners and no shadow, the placeholder in Regular 15 gray 500, a chosen value in SemiBold 16
 * gray 800, the chevron 16 px from the right; its list opens 5 px below, with 44 px SemiBold
 * items 5 px apart on a slate hover. `filled` is the table footer's "Rows per page" chip: slate,
 * no edge, 38 px, 8 px from the value to the chevron. `decision` is a player's dropdown decision
 * (Figma 864:34310 and its menus 654:79659, 778:144363): the decision number field with the
 * chevron, the value at its end in 16/24, a longer one on two lines as today's text dropdowns
 * have it; its list has 36 px SemiBold 14/20 items with no gap, under the menus' shadow, and an
 * option can carry what choosing it costs beside its label.
 */
export const selectVariants = tv({
  slots: {
    trigger: [
      "group/select flex cursor-pointer items-center justify-between gap-(--input-gap) rounded-(--input-radius) text-start",
      "transition duration-fast ease-standard outline-none",
      "focus-visible:ring-4 focus-visible:ring-focus-ring/16 focus-visible:inset-ring focus-visible:inset-ring-focus-ring",
      // A locked decision's column dims as one (DecisionRow), so a select in it does not dim again.
      "data-disabled:cursor-not-allowed data-disabled:not-in-data-locked:opacity-50",
    ],
    value: "min-w-0 truncate data-placeholder:text-fg-subtle",
    icon: "flex shrink-0 transition-transform duration-fast ease-standard group-data-popup-open/select:rotate-180 motion-reduce:transition-none",
    popup: [
      "select-popup rounded-(--menu-radius) bg-surface-card p-2 shadow-md inset-ring inset-ring-line outline-none",
      "popover-motion motion-reduce:transition-none",
    ],
    // Not display: contents, which would take the listbox out of the accessibility tree in some browsers.
    list: "flex flex-col gap-(--menu-option-gap)",
    item: [
      "group/item flex min-h-11 cursor-pointer items-center gap-3 rounded-(--menu-item-radius) p-2.5 type-body-lg font-semibold text-fg-body outline-none select-none",
      "data-highlighted:bg-surface-panel data-disabled:cursor-not-allowed data-disabled:opacity-50",
    ],
    itemText: "min-w-0 flex-1",
    detail: "flex shrink-0 items-center gap-0.5",
    indicator: "flex shrink-0 text-fg-accent",
    // The FormField around a select with a visible label: its own look, and a width as the select's.
    field: "",
  },
  variants: {
    variant: {
      /** A form field, with the field edge (`--color-line-field`) as Input's. */
      outline: {
        trigger: [
          "bg-surface-card px-(--input-padding-x) type-label text-fg-primary inset-ring inset-ring-line-field hover:inset-ring-line-strong",
          "data-invalid:inset-ring-danger data-disabled:hover:inset-ring-line-field",
        ],
        value: "type-body-lg font-semibold text-fg-body data-placeholder:type-label data-placeholder:font-normal",
        icon: "text-fg-subtle",
      },
      /** The table footer's rows-per-page chip. */
      filled: {
        trigger: "gap-2 bg-surface-hover px-3 type-body-lg font-semibold text-fg-muted hover:brightness-95 data-disabled:hover:brightness-100",
        icon: "text-fg-muted",
      },
      /** A player's decision: the decision field's box, 40 px or two lines, the value at its end. */
      decision: {
        trigger: "min-h-10 gap-2 bg-surface-card px-3 py-2 type-body-lg text-fg-primary ring ring-line-accent-soft",
        value: "line-clamp-2 flex-1 text-end whitespace-normal wrap-break-word",
        icon: "text-fg-subtle",
        popup: "shadow-lg",
        list: "gap-0",
        item: "min-h-9 px-3 py-2 type-body",
        // The check keeps its place in every row, so what the options cost lines up.
        indicator: "invisible group-data-selected/item:visible",
      },
    },
    size: {
      sm: { trigger: "h-(--input-height-sm)" },
      md: { trigger: "h-(--input-height-md)" },
      lg: { trigger: "h-(--input-height-lg)" },
    },
    width: {
      /** Fills its row: a form field, a filter. */
      full: { trigger: "w-full" },
      /**
       * As wide as its value, 160 px at least: in a header row beside other controls. With a
       * visible label the field around it hugs the label and the select too, rather than filling
       * the row.
       */
      fit: { trigger: "w-auto min-w-40 max-w-full", field: "w-fit max-w-full" },
    },
  },
  // A decision's field keeps its own height, whatever the size.
  compoundVariants: [{ variant: "decision", class: { trigger: "h-auto" } }],
  defaultVariants: { variant: "outline", size: "lg", width: "full" },
});

export interface SelectOption<Value extends string = string> {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
  /** Beside the label in the list only: what choosing it costs, as small ResourceChips (Figma 778:144363). */
  detail?: ReactNode;
}

export interface SelectProps<Value extends string = string> {
  options: readonly SelectOption<Value>[];
  /** Controlled value; `null` shows the placeholder. */
  value?: Value | null;
  defaultValue?: Value | null;
  onValueChange?: (value: Value | null) => void;
  /** Shown while nothing is chosen ("Select Event..."). */
  placeholder?: ReactNode;
  /** 47 px in forms (default), 42 px in list filters, 38 px in dense rows and the table footer. */
  size?: "sm" | "md" | "lg";
  /** `outline` (default) in forms; `filled` for the table footer's rows-per-page chip; `decision` for a player's decision (its own 40 px, whatever the size). */
  variant?: "outline" | "filled" | "decision";
  /** `full` (default) fills its row; `fit` is as wide as its value, 160 px at least, for a header row beside other controls, a visible label included. */
  width?: "full" | "fit";
  /** A visible label; without it, name the select with aria-label, or aria-labelledby for text beside it. */
  label?: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** The field's name when the form is submitted. */
  name?: string;
  className?: string;
}

/**
 * A list to choose one value from: filters (role, status, app, round), rows per page, a grant's
 * app. The Preline select of the Figma forms, opening its list below the field.
 */
export function Select<Value extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  size,
  variant,
  width,
  label,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  description,
  error,
  required,
  disabled,
  name,
  className,
}: SelectProps<Value>) {
  const slots = selectVariants({ size, variant, width });
  const id = useId();
  const select = (
    <BaseSelect.Root<Value>
      items={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next)}
      required={required}
      disabled={disabled}
      name={label ? undefined : name}
    >
      <BaseSelect.Trigger id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className={slots.trigger({ className })}>
        <BaseSelect.Value className={slots.value()} placeholder={placeholder} />
        <BaseSelect.Icon className={slots.icon()}>
          <Icon icon={ChevronDown} size="md" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal data-ds-root="">
        <BaseSelect.Positioner alignItemWithTrigger={false} sideOffset={5} className="z-popover">
          <BaseSelect.Popup className={slots.popup()}>
            <BaseSelect.List className={slots.list()}>
              {options.map((option) => (
                <BaseSelect.Item key={option.value} value={option.value} disabled={option.disabled} className={slots.item()}>
                  <BaseSelect.ItemText className={slots.itemText()}>{option.label}</BaseSelect.ItemText>
                  {option.detail ? <span className={slots.detail()}>{option.detail}</span> : null}
                  <BaseSelect.ItemIndicator keepMounted={variant === "decision"} className={slots.indicator()}>
                    <Icon icon={Check} size="md" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
  return label || description || error ? (
    <FormField label={label} description={description} error={error} required={required} disabled={disabled} name={name} className={slots.field()}>
      {select}
    </FormField>
  ) : (
    select
  );
}
