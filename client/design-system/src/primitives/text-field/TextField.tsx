import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type ReactNode } from "react";
import { FormField } from "../form-field/FormField";
import { IconButton } from "../icon-button/IconButton";
import { Input, type InputProps } from "../input/Input";

export interface TextFieldProps extends Omit<InputProps, "invalid"> {
  label?: ReactNode;
  description?: ReactNode;
  /** An error message; when set the field is invalid. */
  error?: ReactNode;
}

/**
 * A labelled text input with help and error text. Every input prop reaches the <input>, so it
 * works with React Hook Form's register(): <TextField label="Email" {...register("email")} />.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, description, error, required, disabled, name, ...inputProps },
  ref,
) {
  return (
    <FormField label={label} required={required} description={description} error={error} disabled={disabled}>
      <Input ref={ref} name={name} required={required} disabled={disabled} {...inputProps} />
    </FormField>
  );
});

export interface PasswordFieldProps extends Omit<TextFieldProps, "type" | "endAdornment"> {
  /** Label of the eye button while the password is hidden. Default "Show password". */
  showLabel?: string;
  /** Label of the eye button while the password is shown. Default "Hide password". */
  hideLabel?: string;
}

/** A password field with the Figma eye button that shows and hides what was typed. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { showLabel = "Show password", hideLabel = "Hide password", disabled, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      type={visible ? "text" : "password"}
      disabled={disabled}
      endAdornment={
        <IconButton
          icon={visible ? EyeOff : Eye}
          label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          size="sm"
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        />
      }
      {...props}
    />
  );
});
