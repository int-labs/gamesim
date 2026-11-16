import { Input as BaseInput } from "@base-ui/react/input";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { X } from "lucide-react";
import { useAnimate } from "motion/react";
import { forwardRef, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { NumericFormat, type NumberFormatValues, type SourceInfo } from "react-number-format";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { useReducedEffects } from "../../foundations/motion/MotionProvider";
import { shake } from "../../foundations/motion/presets";
import { tv } from "../../lib/tv";
import { tokens } from "../../tokens";
import { IconButton } from "../icon-button/IconButton";
import { inputVariants } from "../input/Input";

const FIELD = tokens.component["number-field"];
const num = (value: string) => Number.parseFloat(value);
/** A value typed out of range is checked this long after the last keystroke. */
const CHECK_DELAY = num(FIELD["check-delay"]);
/** A message stays this long, unless the player dismisses it or types again. */
const MESSAGE_DURATION = num(FIELD["message-duration"]);
/** From the field to its message. */
const MESSAGE_OFFSET = num(FIELD["message-offset"]);
/** How Base UI says a popup closes on Escape. */
const ESCAPE_KEY: BaseTooltip.Root.ChangeEventReason = "escape-key";

/** The limits a message names, written as the field writes values ("$1,000", "12.50%"). */
export interface NumberFieldLimits {
  min?: string;
  max?: string;
}

export interface NumberFieldMessages {
  /** Typed over the maximum. Wrap the number to act on in ** to set it in bold. */
  above: (limits: NumberFieldLimits & { max: string }) => string;
  /** Typed under the minimum. */
  below: (limits: NumberFieldLimits & { min: string }) => string;
  /** Refused for another reason (a shared budget): the limits the field has. */
  outside: (limits: NumberFieldLimits) => string;
  /** After leaving an entry that did not fit: the limit it broke, and the value put back. */
  reset: (values: NumberFieldLimits & { restored: string; broke: "max" | "min" | "other" }) => string;
  /** The message's close button. */
  dismiss: string;
  /** Read after a percentage's value by screen readers. */
  percent: string;
}

/** Today's copy (InputField), word for word. */
export const defaultNumberFieldMessages: NumberFieldMessages = {
  above: ({ min, max }) =>
    min !== undefined ? `That's above the **${max}** limit. Enter a value between ${min} and ${max}.` : `That's above the **${max}** limit. Enter ${max} or less.`,
  below: ({ min, max }) =>
    max !== undefined
      ? `That's below the **${min}** minimum. Enter a value between ${min} and ${max}.`
      : `That's below the **${min}** minimum. Enter ${min} or more.`,
  outside: ({ min, max }) => {
    if (max !== undefined && min !== undefined) return `Enter a value between **${min}** and **${max}**.`;
    if (max !== undefined) return `Enter **${max}** or less.`;
    if (min !== undefined) return `Enter **${min}** or more.`;
    return "";
  },
  reset: ({ restored, min, max, broke }) => {
    const limit =
      broke === "max" || (broke === "other" && max !== undefined)
        ? `The maximum is **${max}**.`
        : min !== undefined
          ? `The minimum is **${min}**.`
          : "";
    return `${limit} Reset to ${restored}.`.trim();
  },
  dismiss: "Dismiss",
  percent: "percent",
};

/** The message without its ** marks, for plain text. */
export function stripEmphasis(message: string) {
  return message.replace(/\*\*/g, "");
}

/** The message with its ** spans in bold: the number the player has to act on. */
function withEmphasis(message: string) {
  return message
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
}

export const numberFieldVariants = tv({
  slots: {
    box: "",
    message: [
      "field-message flex items-center gap-1.5 rounded-lg bg-danger-soft py-1 ps-3 pe-1 type-body font-medium text-fg-danger shadow-md",
      "inset-ring inset-ring-line-danger-soft popover-motion motion-reduce:transition-none",
    ],
    dismiss: "text-fg-danger",
  },
  variants: {
    /** A key figure of the round (Figma's "Current:" field): brand pink at 16%. */
    emphasis: { true: { box: "bg-primary-soft" } },
  },
});

export interface NumberFieldProps {
  /** The committed value. */
  value: number;
  /** A value to keep: while typing when it fits, and when the player leaves an entry that did not (the value put back). */
  onValueChange: (value: number) => void;
  /** When the player leaves the field or presses Enter, with the value that stays. */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  /** Another rule a value must meet (a shared budget cap): false refuses it as a limit would. */
  isAllowed?: (value: number) => boolean;
  /** How the value reads in the field and its messages. Default `number`. */
  kind?: "number" | "currency" | "percent";
  /** Decimal places the field takes. Default 2. */
  decimals?: number;
  /** Always show all decimal places (12.50). */
  fixedDecimals?: boolean;
  allowNegative?: boolean;
  /** Check an entry 300 ms after the last keystroke, as well as when leaving. Default true. */
  validateWhileTyping?: boolean;
  /** Told each message, in plain text (the field shows it itself). */
  onValidationError?: (message: string) => void;
  /** `decision` for a player's decisions (40 px, right-aligned); `form` for the Admin's forms (47 px). */
  variant?: "decision" | "form";
  /** A key figure of the round, filled brand pink. */
  emphasis?: boolean;
  /** Marks the value as refused by a rule the app checks itself (a budget), with the red edge. */
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  messages?: Partial<NumberFieldMessages>;
  className?: string;
}

/**
 * A number the player types, grouped as they type (1,250,000), with today's rules to the letter:
 * a value that fits is kept at once; one that does not is checked 300 ms after the last keystroke
 * and refused with a message under the field that names the limit, and a shake; leaving it (or
 * pressing Enter) puts back the limit it broke, or the last value when a rule other than the
 * limits refused it, and says so. Escape dismisses the message, which also goes by itself after
 * five seconds or at the next keystroke. A currency shows its symbol before the value.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  {
    value,
    onValueChange,
    onCommit,
    min,
    max,
    isAllowed,
    kind = "number",
    decimals = 2,
    fixedDecimals = false,
    allowNegative = false,
    validateWhileTyping = true,
    onValidationError,
    variant = "decision",
    emphasis = false,
    invalid = false,
    disabled = false,
    placeholder,
    id,
    name,
    "aria-describedby": describedBy,
    messages,
    className,
    ...labelling
  },
  ref,
) {
  const text = { ...defaultNumberFieldMessages, ...messages };
  const format = useNumberFormat();
  const reduced = useReducedEffects();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const unitId = useId();
  const messageId = useId();
  const [draft, setDraft] = useState(String(value));
  const [message, setMessage] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Once the player types, the draft is theirs until they leave the field: a value that arrives
  // meanwhile (a live refresh, the page's own rounding of what was typed) waits, and the value
  // they leave wins. A field switched off meanwhile (the round locked) goes back to the value.
  const [editing, setEditing] = useState(false);
  if (editing && disabled) {
    setEditing(false);
    setDraft(String(value));
  }
  // Otherwise the committed value wins whenever it changes (a new round, an undo, a value put
  // back); a keystroke that keeps the same number (the "." of "1.") keeps what was typed.
  const [committed, setCommitted] = useState(value);
  if (!Object.is(committed, value)) {
    setCommitted(value);
    if (!editing) setDraft(String(value));
  }
  useEffect(
    () => () => {
      clearTimeout(checkTimer.current);
      clearTimeout(messageTimer.current);
    },
    [],
  );

  const symbol =
    kind === "currency"
      ? (new Intl.NumberFormat(format.locale, { style: "currency", currency: format.currency, currencyDisplay: "narrowSymbol" })
          .formatToParts(0)
          .find((part) => part.type === "currency")?.value ?? "")
      : "";
  const unit =
    kind === "currency"
      ? (new Intl.DisplayNames([format.locale], { type: "currency" }).of(format.currency) ?? format.currency)
      : kind === "percent"
        ? text.percent
        : null;

  /** A value as the messages write it: today's formats, in the app's locale and currency. */
  const written = (amount: number) => {
    if (kind === "percent") return `${amount.toFixed(2)}%`;
    const digits = decimals === 0 ? Math.round(amount) : amount;
    const grouped = digits.toLocaleString(format.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return kind === "currency" ? `${symbol}${grouped}` : grouped;
  };
  const limits: NumberFieldLimits = {
    min: min === undefined ? undefined : written(min),
    max: max === undefined ? undefined : written(max),
  };
  const fits = (amount: number) =>
    (min === undefined || amount >= min) && (max === undefined || amount <= max) && (isAllowed?.(amount) ?? true);

  const dismiss = () => {
    clearTimeout(messageTimer.current);
    setMessage(null);
  };
  const present = (next: string) => {
    if (!next) return;
    clearTimeout(messageTimer.current);
    setMessage(next);
    messageTimer.current = setTimeout(() => setMessage(null), MESSAGE_DURATION);
    onValidationError?.(stripEmphasis(next));
  };
  const shakeField = () => {
    if (reduced || !scope.current) return;
    const { transition, ...keyframes } = shake;
    void animate(scope.current, keyframes, transition);
  };

  /** Says why a value does not fit, and shakes; true when it fits. */
  const check = (amount: number) => {
    if (fits(amount)) return true;
    const overMax = max !== undefined && amount > max;
    const underMin = min !== undefined && amount < min;
    present(
      overMax && limits.max !== undefined
        ? text.above({ ...limits, max: limits.max })
        : underMin && limits.min !== undefined
          ? text.below({ ...limits, min: limits.min })
          : text.outside(limits),
    );
    shakeField();
    return false;
  };

  const handleChange = ({ value: typed, floatValue }: NumberFormatValues, { source }: SourceInfo) => {
    // Only the player's typing counts. react-number-format also reports each value it formats
    // from the prop, rounded to the field's decimals: writing that back, or checking it, would
    // change a value nobody typed. It types the source as an enum it does not export.
    if ((source as string) !== "event") return;
    setDraft(typed);
    setEditing(true);
    if (floatValue === undefined) return;
    if (validateWhileTyping) {
      clearTimeout(checkTimer.current);
      checkTimer.current = setTimeout(() => check(floatValue), CHECK_DELAY);
    }
    if (!validateWhileTyping || fits(floatValue)) {
      dismiss();
      onValueChange(floatValue);
    }
  };

  const handleBlur = () => {
    clearTimeout(checkTimer.current);
    setEditing(false);
    const amount = Number.parseFloat(draft) || 0;
    if (fits(amount)) {
      dismiss();
      // What the player leaves wins over a value that arrived while they typed.
      if (!Object.is(amount, value)) onValueChange(amount);
      onCommit?.(amount);
      return;
    }
    const overMax = max !== undefined && amount > max;
    const underMin = min !== undefined && amount < min;
    // The limit it broke, or the last value when another rule refused it.
    const restored = overMax && max !== undefined ? max : underMin && min !== undefined ? min : value;
    setDraft(String(restored));
    onCommit?.(restored);
    onValueChange(restored);
    present(text.reset({ ...limits, restored: written(restored), broke: overMax ? "max" : underMin ? "min" : "other" }));
    shakeField();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter keeps the value, as leaving the field does.
    if (event.key === "Enter") event.currentTarget.blur();
    else if (event.key === "Escape") dismiss();
  };

  const field = inputVariants({ variant, size: "lg", align: variant === "decision" ? "end" : "start", invalid: invalid || message !== null });
  const slots = numberFieldVariants({ emphasis });
  const described = [unit ? unitId : undefined, message ? messageId : undefined, describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div ref={scope} className={className}>
      <div ref={boxRef} className={field.root({ className: slots.box() })}>
        {symbol ? (
          <span aria-hidden className={field.adornment()}>
            {symbol}
          </span>
        ) : null}
        <NumericFormat
          customInput={BaseInput}
          getInputRef={ref}
          id={id}
          name={name}
          value={draft}
          valueIsNumericString
          thousandSeparator=","
          decimalSeparator="."
          decimalScale={decimals}
          fixedDecimalScale={fixedDecimals}
          allowNegative={allowNegative}
          allowLeadingZeros={false}
          suffix={kind === "percent" ? " %" : undefined}
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || message !== null || undefined}
          aria-describedby={described}
          {...labelling}
          onValueChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={field.control()}
        />
      </div>
      {unit ? (
        <span id={unitId} hidden>
          {unit}
        </span>
      ) : null}
      <FieldMessage anchor={boxRef} id={messageId} message={message} dismissLabel={text.dismiss} onDismiss={dismiss} slots={slots} />
    </div>
  );
});

interface FieldMessageProps {
  anchor: React.RefObject<HTMLElement | null>;
  id: string;
  message: string | null;
  dismissLabel: string;
  onDismiss: () => void;
  slots: ReturnType<typeof numberFieldVariants>;
}

/**
 * The message under a field (today's error pill): at its end edge, never over the form, gone after
 * five seconds. It floats on Base UI's tooltip parts, which place it without taking focus (a popover
 * with no trigger would add focus guards that screen readers are told to skip).
 */
function FieldMessage({ anchor, id, message, dismissLabel, onDismiss, slots }: FieldMessageProps) {
  // The last message is kept while the bubble animates out, so its text does not vanish first.
  const [shown, setShown] = useState(message);
  if (message !== null && message !== shown) setShown(message);
  return (
    <BaseTooltip.Root
      open={message !== null}
      onOpenChange={(open, details) => {
        // A press elsewhere leaves it to its timer, as today; Escape closes it.
        if (!open && details.reason === ESCAPE_KEY) onDismiss();
      }}
    >
      <BaseTooltip.Portal data-ds-root="">
        <BaseTooltip.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={MESSAGE_OFFSET}
          collisionAvoidance={{ side: "none", align: "shift" }}
          className="z-toast"
        >
          <BaseTooltip.Popup role="alert" id={id} className={slots.message()}>
            <span>{withEmphasis(shown ?? "")}</span>
            <IconButton icon={X} label={dismissLabel} size="sm" iconSize="sm" onClick={onDismiss} className={slots.dismiss()} />
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

