import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { Button } from "../button/Button";
import { formFieldVariants } from "../form-field/FormField";
import { selectVariants } from "../select/Select";
import { Calendar, defaultCalendarMessages, type CalendarMessages, type DayRange } from "./Calendar";
import { formatDay, today as deviceToday, type DayString } from "./days";

/**
 * The date field (Figma draws none): it looks like the form select, with a calendar icon for its
 * chevron, and opens a calendar 5 px below it on the select list's panel. Choosing a day closes it.
 */
export const datePickerVariants = tv({
  slots: {
    trigger: "aria-invalid:inset-ring-danger",
    icon: "flex shrink-0 text-fg-subtle",
    popup: [
      "rounded-(--menu-radius) bg-surface-card p-(--menu-padding) shadow-md inset-ring inset-ring-line outline-none",
      "popover-motion motion-reduce:transition-none",
    ],
    footer: "mt-2 flex items-center justify-between gap-2 border-t border-line pt-2",
  },
});

export interface DatePickerMessages extends CalendarMessages {
  /** Shown while no day is chosen. Default "Select a date". */
  placeholder: string;
  /** Names the calendar popup. Default "Choose a date". */
  calendar: string;
  /** The button that chooses today. Default "Today". */
  pickToday: string;
  /** The button that empties the field. Default "Clear". */
  clear: string;
  /** Joins a range's days. Default "{from} to {to}". */
  range: (from: string, to: string) => string;
  /** A range with only its first day. Default "From {from}". */
  rangeFrom: (from: string) => string;
  /** A range with only its last day. Default "Until {to}". */
  rangeTo: (to: string) => string;
}

const defaultMessages: DatePickerMessages = {
  ...defaultCalendarMessages,
  placeholder: "Select a date",
  calendar: "Choose a date",
  pickToday: "Today",
  clear: "Clear",
  range: (from, to) => `${from} to ${to}`,
  rangeFrom: (from) => `From ${from}`,
  rangeTo: (to) => `Until ${to}`,
};

interface DateFieldBaseProps {
  /** A visible label; without it, name the field with aria-label. */
  label?: ReactNode;
  "aria-label"?: string;
  description?: ReactNode;
  /** When set, the field is invalid: its edge turns red and screen readers read the message with it. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** The first day that can be chosen, "yyyy-mm-dd" ("today" for a grant that cannot start in the past). */
  min?: DayString;
  /** The last day that can be chosen. */
  max?: DayString;
  /** Today, when the app knows it better than the device (a server date, a fixed day in a story). */
  today?: DayString;
  /** Names of months and days, and the date format. Default "en-GB" ("24 Sept 2026"). */
  locale?: string;
  /** 0 for Sunday to 6 for Saturday. Default: the locale's. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** 47 px in forms (default), 42 px in list filters, 38 px in dense rows. */
  size?: "sm" | "md" | "lg";
  messages?: Partial<DatePickerMessages>;
  className?: string;
}

interface DateFieldFrameProps extends DateFieldBaseProps {
  /** What the field shows: the chosen day or range, or undefined for the placeholder. */
  display: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The calendar and the footer's actions. */
  children: ReactNode;
  /** Form submission: hidden inputs carrying the value. */
  hidden?: ReactNode;
}

function isSet(value: ReactNode) {
  return value !== undefined && value !== null && value !== false && value !== "";
}

/** The label, the field, the popup and the help around a calendar, wired for assistive technology. */
function DateFieldFrame({
  label,
  "aria-label": ariaLabel,
  description,
  error,
  required = false,
  disabled = false,
  size,
  messages: messageOverrides,
  className,
  display,
  open,
  onOpenChange,
  children,
  hidden,
}: DateFieldFrameProps) {
  const messages = { ...defaultMessages, ...messageOverrides };
  const field = formFieldVariants();
  const select = selectVariants({ variant: "outline", size });
  const slots = datePickerVariants();
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const invalid = isSet(error);
  const popupRef = useRef<HTMLDivElement>(null);
  const describedBy = [isSet(description) ? descriptionId : null, invalid ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={field.root({ className })}>
      {label ? (
        <label id={labelId} htmlFor={`${id}-trigger`} className={field.label()}>
          {label}
          {required ? (
            <span aria-hidden className={field.required()}>
              *
            </span>
          ) : null}
        </label>
      ) : (
        <span id={labelId} hidden>
          {ariaLabel}
        </span>
      )}
      <Popover.Root open={open} onOpenChange={(next) => onOpenChange(next)} modal="trap-focus">
        <Popover.Trigger
          id={`${id}-trigger`}
          disabled={disabled}
          // The field's name, then what it holds: "Start date, 24 Sept 2026".
          aria-labelledby={`${labelId} ${valueId}`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={select.trigger({ className: slots.trigger() })}
        >
          <span id={valueId} className={select.value()} data-placeholder={display === undefined ? "" : undefined}>
            {display ?? messages.placeholder}
          </span>
          <span className={slots.icon()}>
            <Icon icon={CalendarDays} size="md" />
          </span>
        </Popover.Trigger>
        <Popover.Portal data-ds-root="">
          <Popover.Positioner side="bottom" align="start" sideOffset={5} className="z-popover">
            <Popover.Popup
              ref={popupRef}
              aria-label={messages.calendar}
              // Straight to the chosen day, else today, as the calendar makes it the one to tab to.
              initialFocus={() => popupRef.current?.querySelector<HTMLElement>('[role="grid"] button[tabindex="0"]') ?? true}
              className={slots.popup()}
            >
              {children}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {isSet(description) ? (
        <p id={descriptionId} className={field.description()}>
          {description}
        </p>
      ) : null}
      {invalid ? (
        <p id={errorId} className={field.error()}>
          {error}
        </p>
      ) : null}
      {hidden}
    </div>
  );
}

export interface DatePickerProps extends DateFieldBaseProps {
  /** The chosen day, "yyyy-mm-dd" in local time, or null. */
  value: DayString | null;
  onValueChange: (value: DayString | null) => void;
  /** Offers Clear, for a field that may stay empty ("No end date"). Default: when not required. */
  clearable?: boolean;
  /** The field's name when the form is submitted; the value goes as "yyyy-mm-dd". */
  name?: string;
}

/**
 * A day, chosen from a calendar: a grant's start or its last day. Values are "yyyy-mm-dd" strings
 * in local time, never shifted through UTC; min and max bound the days that can be chosen.
 */
export function DatePicker({ value, onValueChange, clearable, name, ...props }: DatePickerProps) {
  const { min, max, today, locale = "en-GB", weekStartsOn, required = false, messages: messageOverrides } = props;
  const messages = { ...defaultMessages, ...messageOverrides };
  const [open, setOpen] = useState(false);
  const now = today ?? deviceToday();
  const todayAllowed = (!min || now >= min) && (!max || now <= max);
  const choose = (next: DayString | null) => {
    onValueChange(next);
    setOpen(false);
  };
  return (
    <DateFieldFrame
      {...props}
      display={formatDay(value, locale)}
      open={open}
      onOpenChange={setOpen}
      hidden={name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    >
      <Calendar
        mode="single"
        value={value}
        // Pressing the chosen day again keeps it (the calendar would otherwise let it go) and closes.
        onValueChange={(next) => choose(next ?? value)}
        min={min}
        max={max}
        today={today}
        locale={locale}
        weekStartsOn={weekStartsOn}
        messages={messages}
      />
      <div className={datePickerVariants().footer()}>
        <Button variant="text" size="xs" disabled={!todayAllowed} onClick={() => choose(now)}>
          {messages.pickToday}
        </Button>
        {(clearable ?? !required) && value ? (
          <Button variant="text" size="xs" onClick={() => choose(null)}>
            {messages.clear}
          </Button>
        ) : null}
      </div>
    </DateFieldFrame>
  );
}

export interface DateRangePickerProps extends DateFieldBaseProps {
  /** The chosen days, "yyyy-mm-dd" in local time; either end may be null. */
  value: DayRange;
  onValueChange: (value: DayRange) => void;
  /** The form names of the two days. */
  names?: { from: string; to: string };
}

/**
 * A span of days from one calendar: the audit's from and to. The first press sets the start, the
 * second the end, and the calendar closes; Clear empties both.
 */
export function DateRangePicker({ value, onValueChange, names, ...props }: DateRangePickerProps) {
  const { min, max, today, locale = "en-GB", weekStartsOn, messages: messageOverrides } = props;
  const messages = { ...defaultMessages, ...messageOverrides };
  const [open, setOpen] = useState(false);
  const from = formatDay(value.from, locale);
  const to = formatDay(value.to, locale);
  const display = from && to ? messages.range(from, to) : from ? messages.rangeFrom(from) : to ? messages.rangeTo(to) : undefined;
  return (
    <DateFieldFrame
      {...props}
      display={display}
      open={open}
      onOpenChange={setOpen}
      hidden={
        names ? (
          <>
            <input type="hidden" name={names.from} value={value.from ?? ""} />
            <input type="hidden" name={names.to} value={value.to ?? ""} />
          </>
        ) : null
      }
    >
      <Calendar
        mode="range"
        value={value}
        onValueChange={(next) => {
          onValueChange(next);
          if (next.from && next.to) setOpen(false);
        }}
        min={min}
        max={max}
        today={today}
        locale={locale}
        weekStartsOn={weekStartsOn}
        messages={messages}
      />
      {value.from || value.to ? (
        <div className={datePickerVariants().footer({ className: "justify-end" })}>
          <Button variant="text" size="xs" onClick={() => onValueChange({ from: null, to: null })}>
            {messages.clear}
          </Button>
        </div>
      ) : null}
    </DateFieldFrame>
  );
}
