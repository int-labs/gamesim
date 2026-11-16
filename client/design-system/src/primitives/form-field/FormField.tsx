import { Field } from "@base-ui/react/field";
import type { ReactNode } from "react";
import { tv } from "../../lib/tv";

export const formFieldVariants = tv({
  slots: {
    root: "flex w-full flex-col gap-(--input-gap)",
    label: "type-label font-semibold text-fg-primary",
    required: "text-fg-primary",
    description: "type-body text-fg-muted",
    error: "type-label text-fg-danger",
  },
});

export interface FormFieldProps {
  /** The label, as in the Figma forms ("Current Password"). */
  label?: ReactNode;
  /** Shown after the label as an asterisk; the control itself carries `required`. */
  required?: boolean;
  /** Help under the control. */
  description?: ReactNode;
  /**
   * The error under the control. When set, the field is invalid: the control's border turns red
   * and screen readers read the message with the control.
   */
  error?: ReactNode;
  disabled?: boolean;
  /** The field's name when the form is submitted (overrides the control's name). */
  name?: string;
  className?: string;
  /** The control: an Input, or any Base UI control (Select, Combobox, NumberField ...). */
  children: ReactNode;
}

/** Label, control, help and error, wired together for assistive technology (Base UI Field). */
export function FormField({ label, required = false, description, error, disabled, name, className, children }: FormFieldProps) {
  const slots = formFieldVariants();
  const invalid = error !== undefined && error !== null && error !== false && error !== "";
  return (
    <Field.Root invalid={invalid} disabled={disabled} name={name} className={slots.root({ className })}>
      {label ? (
        <Field.Label className={slots.label()}>
          {label}
          {required ? (
            <span aria-hidden className={slots.required()}>
              *
            </span>
          ) : null}
        </Field.Label>
      ) : null}
      {children}
      {description ? <Field.Description className={slots.description()}>{description}</Field.Description> : null}
      {invalid ? (
        <Field.Error match className={slots.error()}>
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}
