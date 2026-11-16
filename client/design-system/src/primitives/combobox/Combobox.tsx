import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { FormField } from "../form-field/FormField";
import { inputVariants } from "../input/Input";
import { selectVariants } from "../select/Select";
import { Spinner } from "../spinner/Spinner";

/**
 * A select to type into (Figma draws none): the form input with a clear button and the select's
 * chevron, over the select's list, where an option may carry a second line (a person's email).
 */
export const comboboxVariants = tv({
  slots: {
    // The chevron's 16 px icon lands 16 px from the edge, where the select draws its own.
    actions: "-me-1 flex shrink-0 items-center gap-0.5",
    action: [
      "inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors duration-fast ease-standard",
      "hover:bg-surface-hover hover:text-fg-body outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-disabled:cursor-not-allowed data-disabled:hover:bg-transparent",
    ],
    chevron: "transition-transform duration-fast ease-standard group-data-popup-open/trigger:rotate-180 motion-reduce:transition-none",
    itemText: "flex min-w-0 flex-1 flex-col",
    itemLabel: "truncate",
    // Gray 500 reads 4.4:1 on the slate of a highlighted row: it takes gray 600 there.
    itemDescription: "truncate type-body font-normal text-fg-subtle group-data-highlighted/item:text-fg-muted",
    // The select list's panel, with its list scrolling inside and the notes around it staying put.
    popup: [
      "combobox-popup rounded-(--menu-radius) bg-surface-card p-2 shadow-md inset-ring inset-ring-line outline-none",
      "popover-motion motion-reduce:transition-none",
    ],
    list: "min-h-0 flex-1 overflow-y-auto overscroll-contain",
    // Kept mounted for screen readers, and empty without a message.
    note: "flex shrink-0 items-center gap-2 px-2.5 py-2 type-body text-fg-subtle empty:p-0",
  },
});

export interface ComboboxOption<Value extends string = string> {
  value: Value;
  /** What the option is called, shown in the list and in the field once chosen. */
  label: string;
  /** A second line: a person's email, an app's key. It is searched too. */
  description?: string;
  /** More words that find the option. */
  keywords?: readonly string[];
  disabled?: boolean;
}

export interface ComboboxMessages {
  /** When nothing matches. Default "No matches". */
  empty: string;
  /** While the app searches. Default "Searching". */
  loading: string;
  /** Names the clear button. Default "Clear". */
  clear: string;
  /** Names the chevron. Default "Show options". */
  open: string;
  /** Under a list cut at its limit. Default "{n} more: keep typing to narrow the list". */
  more: (count: number) => string;
}

const defaultMessages: ComboboxMessages = {
  empty: "No matches",
  loading: "Searching",
  clear: "Clear",
  open: "Show options",
  more: (count) => `${count} more: keep typing to narrow the list`,
};

export interface ComboboxProps<Value extends string = string> {
  options: readonly ComboboxOption<Value>[];
  /** The chosen option's value, or null. */
  value: Value | null;
  onValueChange: (value: Value | null) => void;
  placeholder?: string;
  /** A visible label; without it, name the field with aria-label. */
  label?: ReactNode;
  "aria-label"?: string;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** The field's name when the form is submitted; the chosen value is sent. */
  name?: string;
  /** 47 px in forms (default), 42 px in list filters, 38 px in dense rows. */
  size?: "sm" | "md" | "lg";
  /**
   * How typing finds options. By default an option matches when its label, description or keywords
   * contain what is typed, ignoring case and accents. Pass `false` when the app searches itself
   * (on the server) and gives the results as `options`, keeping the chosen option among them.
   */
  filter?: false | ((option: ComboboxOption<Value>, query: string) => boolean);
  /** What is typed, for an app that searches itself. */
  onInputChange?: (query: string) => void;
  /** The app is searching: the list says so. */
  loading?: boolean;
  /** The most options listed at once; the list says how many more match. Default 50. */
  limit?: number;
  messages?: Partial<ComboboxMessages>;
  className?: string;
}

/**
 * A long list to choose one from by typing: a person by name or email, an app, a simulation. The
 * arrows move through the matches, Enter chooses, Escape closes; the clear button empties it.
 */
export function Combobox<Value extends string = string>({
  options,
  value,
  onValueChange,
  placeholder,
  label,
  "aria-label": ariaLabel,
  description,
  error,
  required,
  disabled,
  name,
  size,
  filter,
  onInputChange,
  loading = false,
  limit = 50,
  messages: messageOverrides,
  className,
}: ComboboxProps<Value>) {
  const messages = { ...defaultMessages, ...messageOverrides };
  const field = inputVariants({ variant: "form", size });
  const list = selectVariants();
  const slots = comboboxVariants();
  const { contains } = BaseCombobox.useFilter({ sensitivity: "base" });
  const [query, setQuery] = useState("");

  const items = useMemo(
    () => BaseCombobox.createItems([...options], { getValue: (option) => option.value, getLabel: (option) => option.label }),
    [options],
  );
  const chosen = options.find((option) => option.value === value);
  // The chosen option's label in the field is not a search: every option shows.
  const search = chosen && query === chosen.label ? "" : query.trim();
  const matched = useMemo(() => {
    if (filter === false || search === "") return options;
    const matches =
      typeof filter === "function"
        ? (option: ComboboxOption<Value>) => filter(option, search)
        : (option: ComboboxOption<Value>) =>
            [option.label, option.description, ...(option.keywords ?? [])].some((text) => text !== undefined && contains(text, search));
    return options.filter(matches);
  }, [options, filter, search, contains]);
  const shown = matched.slice(0, limit);
  const more = matched.length - shown.length;

  const control = (
    <BaseCombobox.Root
      items={items}
      filteredItems={shown}
      value={value}
      onValueChange={(next) => onValueChange(next ?? null)}
      onInputValueChange={(next) => {
        setQuery(next);
        onInputChange?.(next);
      }}
      autoHighlight
      disabled={disabled}
      required={required}
      name={label || description || error ? undefined : name}
    >
      <BaseCombobox.InputGroup className={field.root({ className })}>
        <BaseCombobox.Input placeholder={placeholder} aria-label={ariaLabel} className={field.control()} />
        <span className={slots.actions()}>
          <BaseCombobox.Clear aria-label={messages.clear} className={slots.action()}>
            <Icon icon={X} size="md" />
          </BaseCombobox.Clear>
          <BaseCombobox.Trigger aria-label={messages.open} className={slots.action({ className: "group/trigger" })}>
            <Icon icon={ChevronDown} size="md" className={slots.chevron()} />
          </BaseCombobox.Trigger>
        </span>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal data-ds-root="">
        <BaseCombobox.Positioner sideOffset={5} className="z-popover">
          <BaseCombobox.Popup className={slots.popup()}>
            <BaseCombobox.Status className={slots.note()}>
              {loading ? (
                <>
                  <Spinner size="sm" />
                  {messages.loading}
                </>
              ) : null}
            </BaseCombobox.Status>
            <BaseCombobox.Empty className={slots.note()}>{loading ? null : messages.empty}</BaseCombobox.Empty>
            <BaseCombobox.List className={list.list({ className: slots.list() })}>
              {(option: ComboboxOption<Value>) => (
                <BaseCombobox.Item key={option.value} value={option.value} disabled={option.disabled} className={list.item({ className: "group/item" })}>
                  <span className={slots.itemText()}>
                    <span className={slots.itemLabel()}>{option.label}</span>
                    {option.description ? <span className={slots.itemDescription()}>{option.description}</span> : null}
                  </span>
                  <BaseCombobox.ItemIndicator className={list.indicator()}>
                    <Icon icon={Check} size="md" />
                  </BaseCombobox.ItemIndicator>
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
            {more > 0 ? <p className={slots.note()}>{messages.more(more)}</p> : null}
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
  return label || description || error ? (
    <FormField label={label} description={description} error={error} required={required} disabled={disabled} name={name}>
      {control}
    </FormField>
  ) : (
    control
  );
}
