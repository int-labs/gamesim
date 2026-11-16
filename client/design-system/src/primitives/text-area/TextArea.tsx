import { Field } from "@base-ui/react/field";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { tv } from "../../lib/tv";
import { formFieldVariants } from "../form-field/FormField";

/**
 * The multi-line text field: Preline's textarea, of the family of the Figma forms' input. The
 * input's white field, gray 200 edge, 8 px corners and faint shadow, its 16 px sides and 15 px
 * text on 19 px lines, 14 px above and below them. It grows with what is typed, from `minRows` to
 * `maxRows` lines, then scrolls. With a `maxLength`, the count shows at the end of the help line.
 */
export const textAreaVariants = tv({
  slots: {
    box: "relative w-full",
    control: [
      "block w-full resize-none rounded-(--input-radius) bg-surface-card px-(--input-padding-x) py-(--textarea-padding-y)",
      "type-label text-fg-primary shadow-xs inset-ring inset-ring-line-field outline-none transition duration-fast ease-standard",
      "placeholder:text-fg-subtle hover:inset-ring-line-strong",
      "focus:ring-4 focus:ring-focus-ring/16 focus:inset-ring-focus-ring",
      "data-invalid:shadow-none data-invalid:inset-ring-danger data-invalid:focus:ring-danger/16",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:inset-ring-line-field",
    ],
    // Measures the text at the field's width, out of sight, so the field never shrinks to measure it:
    // shrinking would shorten the page for a moment and could move where it is scrolled to.
    shadow: "invisible absolute inset-x-0 top-0 h-0 overflow-hidden px-(--input-padding-x) py-(--textarea-padding-y) type-label",
    help: "flex items-start justify-between gap-3",
    count: "ms-auto shrink-0 type-body text-fg-muted tabular-nums",
  },
  variants: {
    /** Nothing more can be typed: the count says why. */
    full: { true: { count: "text-fg-warning" } },
  },
});

export interface TextAreaMessages {
  /** What a screen reader hears for the count: "123 of 5,000 characters". */
  count: (length: string, max: string) => string;
}

const defaultMessages: TextAreaMessages = {
  count: (length, max) => `${length} of ${max} characters`,
};

export interface TextAreaProps extends Omit<ComponentPropsWithoutRef<"textarea">, "className" | "rows" | "cols"> {
  label?: ReactNode;
  description?: ReactNode;
  /** An error message; when set the field is invalid. */
  error?: ReactNode;
  /** Lines shown while little is typed. Default 4. */
  minRows?: number;
  /** Lines it grows to before it scrolls. Default 10. */
  maxRows?: number;
  /** The count at the end of the help line. Shown by default when there is a `maxLength`. */
  showCount?: boolean;
  messages?: Partial<TextAreaMessages>;
  /** Classes for the text box. */
  className?: string;
}

/** Sizes what is typed with its line height and padding, from the field's own styles. */
function measure(input: HTMLTextAreaElement) {
  const style = window.getComputedStyle(input);
  const line = Number.parseFloat(style.lineHeight);
  const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  return { line: Number.isFinite(line) ? line : 0, padding: Number.isFinite(padding) ? padding : 0 };
}

/**
 * A labelled multi-line text field with help and error text, as TextField for one line: its label
 * and required mark, description, error and focus ring. Every textarea prop reaches the
 * <textarea>, so it works with React Hook Form's register(). Enter starts a new line.
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    label,
    description,
    error,
    required,
    disabled,
    name,
    minRows = 4,
    maxRows = 10,
    showCount,
    messages,
    className,
    value,
    defaultValue,
    maxLength,
    onChange,
    ...textareaProps
  },
  ref,
) {
  const field = formFieldVariants();
  const format = useNumberFormat();
  const text = { ...defaultMessages, ...messages };
  const invalid = error !== undefined && error !== null && error !== false && error !== "";

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const shadowRef = useRef<HTMLTextAreaElement>(null);
  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const controlled = value !== undefined;
  const [typed, setTyped] = useState(() => String(defaultValue ?? "").length);
  const length = controlled ? String(value ?? "").length : typed;
  // The most that can be typed, when the count shows it.
  const max = maxLength !== undefined && maxLength >= 0 && (showCount ?? true) ? maxLength : undefined;
  const slots = textAreaVariants({ full: max !== undefined && length >= max });

  // The field as tall as its text, from minRows to maxRows lines; past them, it scrolls.
  const fit = useCallback(() => {
    const input = inputRef.current;
    const shadow = shadowRef.current;
    if (!input || !shadow) return;
    const { line, padding } = measure(input);
    if (!line) return;
    // An empty field is sized by its placeholder, so a long one shows whole.
    shadow.value = input.value || input.placeholder;
    const content = shadow.scrollHeight - padding;
    const lines = Math.min(Math.max(content, minRows * line), maxRows * line);
    input.style.height = `${lines + padding}px`;
    input.style.overflowY = content > maxRows * line ? "auto" : "hidden";
  }, [minRows, maxRows]);

  // On mount, and whenever a controlled value changes.
  useLayoutEffect(() => fit(), [fit, value]);

  // A narrower or wider field wraps its text again; the web font arriving changes the lines too.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fit();
    });
    if (typeof ResizeObserver === "undefined") {
      return () => {
        live = false;
      };
    }
    let width = input.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (input.offsetWidth === width) return;
      width = input.offsetWidth;
      fit();
    });
    observer.observe(input);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [fit]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!controlled) setTyped(event.currentTarget.value.length);
    fit();
    onChange?.(event);
  };

  return (
    <Field.Root invalid={invalid} disabled={disabled} className={field.root()}>
      {label ? (
        <Field.Label className={field.label()}>
          {label}
          {required ? (
            <span aria-hidden className={field.required()}>
              *
            </span>
          ) : null}
        </Field.Label>
      ) : null}
      <div className={slots.box()}>
        {/* Base UI's field control, drawn as a textarea: the label, help and error are wired to it.
            Its props are the input's, so the textarea's are handed over as they are. */}
        <Field.Control
          ref={setRefs}
          render={<textarea rows={minRows} />}
          name={name}
          required={required}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          className={slots.control({ className })}
          {...(textareaProps as ComponentPropsWithoutRef<typeof Field.Control>)}
          onChange={(event) => handleChange(event as unknown as ChangeEvent<HTMLTextAreaElement>)}
        />
        <textarea ref={shadowRef} aria-hidden tabIndex={-1} readOnly rows={1} className={slots.shadow()} />
      </div>
      {description || max !== undefined ? (
        <div className={slots.help()}>
          {description ? <Field.Description className={field.description()}>{description}</Field.Description> : null}
          {max !== undefined ? (
            <Field.Description className={slots.count()}>
              <span aria-hidden>{`${format.number(length)}/${format.number(max)}`}</span>
              <span className="sr-only">{text.count(format.number(length), format.number(max))}</span>
            </Field.Description>
          ) : null}
        </div>
      ) : null}
      {invalid ? (
        <Field.Error match className={field.error()}>
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
});
