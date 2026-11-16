import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { DayPicker, type ChevronProps, type DateRange, type DayButtonProps, type Formatters, type Labels, type Matcher, type Modifiers } from "react-day-picker";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { parseDay, toDay, type DayString } from "./days";

/**
 * A month of days to choose from, in the design system's language (Figma draws no calendar): the
 * month between two 32 px chevron buttons, short weekday names, and 40 px days with 8 px corners.
 * The chosen day is indigo with white figures, as selection is across the system (white on
 * indigo reads 13:1); today is SemiBold indigo; a range runs as a pale indigo band between its
 * ends. Days outside the allowed span are faded and cannot be chosen.
 */
export const calendarVariants = tv({
  slots: {
    root: "w-fit",
    months: "flex",
    // Seven day columns: the previous button over the first, the month over the middle five, the
    // next button over the last, then the grid across all seven.
    month: "grid grid-cols-7 items-center",
    caption: "col-span-5 flex h-(--calendar-nav-size) min-w-0 items-center justify-center",
    captionLabel: "truncate type-body-lg font-semibold text-fg-primary",
    nav: [
      "inline-flex size-(--calendar-nav-size) cursor-pointer items-center justify-center justify-self-center rounded-(--calendar-day-radius) text-fg-muted",
      "transition-colors duration-fast ease-standard hover:bg-surface-panel hover:text-fg-body",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent",
    ],
    grid: "col-span-7 mt-(--calendar-gap) border-separate border-spacing-x-0 border-spacing-y-(--calendar-row-gap)",
    weekday: "h-(--calendar-weekday-height) w-(--calendar-day-size) p-0 text-center type-caption font-semibold text-fg-subtle",
    // The cell carries a range's band; the button inside it carries the day.
    day: "size-(--calendar-day-size) p-0 text-center",
    rangeStart: "rounded-s-(--calendar-day-radius) bg-accent-soft",
    rangeEnd: "rounded-e-(--calendar-day-radius) bg-accent-soft",
    rangeMiddle: "bg-accent-soft",
    hidden: "invisible",
    dayButton: [
      "inline-flex size-(--calendar-day-size) cursor-pointer items-center justify-center rounded-(--calendar-day-radius) type-body text-fg-body tabular-nums",
      "transition-colors duration-fast ease-standard hover:bg-surface-panel",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
    ],
  },
  variants: {
    // What a day is, from the calendar's modifiers; later entries win.
    outside: { true: { dayButton: "text-fg-subtle" } },
    today: { true: { dayButton: "font-semibold text-fg-accent" } },
    inRange: { true: { dayButton: "text-fg-accent hover:bg-transparent" } },
    chosen: { true: { dayButton: "bg-accent font-semibold text-fg-on-accent hover:bg-accent" } },
    disabled: { true: { dayButton: "cursor-not-allowed text-fg-disabled hover:bg-transparent" } },
  },
});

export interface CalendarMessages {
  previousMonth: string;
  nextMonth: string;
  /** Said after a day's date when it is today. Default "today". */
  today: string;
  /** Said after a day's date when it is chosen. Default "selected". */
  selected: string;
}

export const defaultCalendarMessages: CalendarMessages = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  today: "today",
  selected: "selected",
};

interface CalendarBaseProps {
  /** The first day that can be chosen, "yyyy-mm-dd". */
  min?: DayString;
  /** The last day that can be chosen. */
  max?: DayString;
  /** The month shown first ("yyyy-mm-dd" of any day in it). Default: the chosen day, else today. */
  defaultMonth?: DayString;
  /** Today, when the app knows it better than the device (a server date, a fixed day in a story). */
  today?: DayString;
  /** Names of months and days, and the week's first day. Default "en-GB". */
  locale?: string;
  /** 0 for Sunday to 6 for Saturday. Default: the locale's (Monday in en-GB, Sunday in id-ID). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Moves focus to the chosen day, or today, when the calendar appears. */
  autoFocus?: boolean;
  messages?: Partial<CalendarMessages>;
  className?: string;
}

export interface SingleCalendarProps extends CalendarBaseProps {
  mode: "single";
  value: DayString | null;
  onValueChange: (value: DayString | null) => void;
}

export interface DayRange {
  from: DayString | null;
  to: DayString | null;
}

export interface RangeCalendarProps extends CalendarBaseProps {
  mode: "range";
  value: DayRange;
  onValueChange: (value: DayRange) => void;
}

export type CalendarProps = SingleCalendarProps | RangeCalendarProps;

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type LocaleWithWeek = Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };

/** The locale's first day of the week (Intl counts Sunday as 7), else Monday. */
export function weekStartFor(locale: string): WeekDay {
  try {
    const info = new Intl.Locale(locale) as LocaleWithWeek;
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    return firstDay === undefined ? 1 : ((firstDay % 7) as WeekDay);
  } catch {
    return 1;
  }
}

function CalendarChevron({ orientation, className }: ChevronProps) {
  return <Icon icon={orientation === "left" ? ChevronLeft : ChevronRight} size="md" stroke="regular" className={className} />;
}

/** A day of the grid, styled from what the calendar knows of it. Keeps the calendar's focus handling. */
function CalendarDayButton({ day, modifiers, className, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  const middle = Boolean(modifiers.range_middle);
  const { dayButton } = calendarVariants({
    outside: Boolean(modifiers.outside),
    today: Boolean(modifiers.today),
    inRange: middle,
    chosen: Boolean(modifiers.selected) && !middle,
    disabled: Boolean(modifiers.disabled),
  });
  return <button ref={ref} {...props} className={dayButton()} />;
}

/**
 * A month grid for choosing a day or a range of days, from the keyboard too: arrows move by day
 * and week, Page Up and Page Down by month (with Shift, by year), Home and End to the week's ends.
 * Days are "yyyy-mm-dd" strings in local time.
 */
export function Calendar(props: CalendarProps) {
  const { min, max, defaultMonth, today, locale = "en-GB", weekStartsOn, autoFocus, messages: messageOverrides, className } = props;
  const messages = { ...defaultCalendarMessages, ...messageOverrides };
  const slots = calendarVariants();

  const { formatters, labels } = useMemo(() => {
    const caption = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" });
    const full = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const formatters: Partial<Formatters> = {
      formatCaption: (month: Date) => caption.format(month),
      formatWeekdayName: (day: Date) => weekday.format(day),
    };
    const labels: Partial<Labels> = {
      labelPrevious: () => messages.previousMonth,
      labelNext: () => messages.nextMonth,
      labelGrid: (month: Date) => caption.format(month),
      labelWeekday: (day: Date) => weekdayLong.format(day),
      labelDayButton: (date: Date, modifiers: Modifiers) =>
        [full.format(date), modifiers.today ? messages.today : null, modifiers.selected ? messages.selected : null].filter(Boolean).join(", "),
    };
    return { formatters, labels };
  }, [locale, messages.previousMonth, messages.nextMonth, messages.today, messages.selected]);

  const minDate = parseDay(min);
  const maxDate = parseDay(max);
  const disabled: Matcher[] = [];
  if (minDate) disabled.push({ before: minDate });
  if (maxDate) disabled.push({ after: maxDate });

  const chosen = props.mode === "single" ? props.value : (props.value.from ?? props.value.to);
  const shared = {
    lang: locale,
    weekStartsOn: weekStartsOn ?? weekStartFor(locale),
    showOutsideDays: true,
    fixedWeeks: true,
    navLayout: "around" as const,
    defaultMonth: parseDay(defaultMonth ?? chosen ?? today),
    startMonth: minDate,
    endMonth: maxDate,
    today: parseDay(today),
    disabled,
    autoFocus,
    formatters,
    labels,
    components: { Chevron: CalendarChevron, DayButton: CalendarDayButton },
    classNames: {
      root: slots.root({ className }),
      months: slots.months(),
      month: slots.month(),
      month_caption: slots.caption(),
      caption_label: slots.captionLabel(),
      button_previous: slots.nav(),
      button_next: slots.nav(),
      month_grid: slots.grid(),
      weekday: slots.weekday(),
      day: slots.day(),
      range_start: slots.rangeStart(),
      range_end: slots.rangeEnd(),
      range_middle: slots.rangeMiddle(),
      hidden: slots.hidden(),
    },
  };

  if (props.mode === "single") {
    const { value, onValueChange } = props;
    return (
      <DayPicker {...shared} mode="single" selected={parseDay(value)} onSelect={(date: Date | undefined) => onValueChange(date ? toDay(date) : null)} />
    );
  }
  const { value, onValueChange } = props;
  const selected: DateRange | undefined = value.from || value.to ? { from: parseDay(value.from), to: parseDay(value.to) } : undefined;
  return (
    <DayPicker
      {...shared}
      mode="range"
      selected={selected}
      // Two presses make a range, in either order: the first sets the start, the second the end;
      // a third starts again. (The calendar's own first press makes a one-day range.)
      onDayClick={(date: Date, modifiers: Modifiers) => {
        if (modifiers.disabled) return;
        onValueChange(nextRange(value, toDay(date)));
      }}
    />
  );
}

/** The range after a press on a day: a start waiting for its end, or the finished range in order. */
export function nextRange(range: DayRange, day: DayString): DayRange {
  if (range.from && !range.to) return range.from <= day ? { from: range.from, to: day } : { from: day, to: range.from };
  return { from: day, to: null };
}
