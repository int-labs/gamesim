import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useReducedEffects } from "../../foundations/motion/MotionProvider";
import { tv } from "../../lib/tv";

/**
 * The Figma underline tabs (_nav-active-link), measured: equal-width tabs, each a 66 px Poppins
 * 18/27 label over a 1 px gray rule; the active one SemiBold in brand indigo over a 2 px indigo
 * bar that slides between tabs; slate on hover. Figma draws the other labels in gray 400 (2.5:1);
 * they use gray 500 (4.8:1), and gray 600 on the slate hover, where gray 500 reads 3.9:1.
 */
export const tabsVariants = tv({
  slots: {
    // When the tabs do not fit (ten rounds on a phone), they scroll sideways inside their own strip.
    scroller: "tabs-scroller",
    // One gray rule under all the tabs, drawn over their bottom pixel; the active bar covers it.
    list: "relative flex w-max min-w-full after:absolute after:inset-x-0 after:bottom-0 after:h-(--tabs-rail-width) after:bg-line",
    // Equal widths when they fit; never narrower than their label.
    tab: [
      "flex h-(--tabs-height) flex-1 cursor-pointer items-center justify-center gap-2 px-(--tabs-item-padding-x) pb-px",
      "type-tab whitespace-nowrap text-fg-subtle transition-colors duration-fast ease-standard",
      "not-data-disabled:hover:bg-surface-hover not-data-disabled:not-data-active:hover:text-fg-muted",
      "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring",
      "data-active:font-semibold data-active:text-fg-accent data-disabled:cursor-not-allowed data-disabled:opacity-50",
    ],
    indicator: "tab-indicator absolute bottom-0 z-raised h-(--tabs-indicator-width) rounded-full bg-accent motion-reduce:transition-none",
    panel: "outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring",
  },
});

export interface TabItem<Value extends string = string> {
  value: Value;
  /** The label, with an icon if the tab has a state (a round's check or dot). */
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<Value extends string = string> {
  className?: string;
  tabs: readonly TabItem<Value>[];
  /** Controlled value. */
  value?: Value;
  defaultValue?: Value;
  onValueChange?: (value: Value) => void;
  /** Names the tab list for assistive technology ("Rounds"). */
  label: string;
  /** The panels: TabsPanel elements, one per tab. */
  children?: ReactNode;
}

/**
 * Brings the selected tab into view when it is outside the strip, centred so its neighbours show.
 * A tab already in view stays where it is.
 */
function revealTab(scroller: HTMLElement, tab: HTMLElement, smooth: boolean) {
  const start = tab.offsetLeft;
  const end = start + tab.offsetWidth;
  if (start >= scroller.scrollLeft && end <= scroller.scrollLeft + scroller.clientWidth) return;
  scroller.scrollTo({ left: start - (scroller.clientWidth - tab.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
}

/**
 * Tabs across a card: rounds, statements, access views. Arrow keys move between them. When they do
 * not fit, the strip scrolls sideways and the selected tab is brought into view.
 */
export function Tabs<Value extends string = string>({ tabs, value, defaultValue, onValueChange, label, className, children }: TabsProps<Value>) {
  const slots = tabsVariants();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const initial = defaultValue ?? tabs[0]?.value;
  const [uncontrolled, setUncontrolled] = useState(initial);
  const active = value ?? uncontrolled;
  const reduced = useReducedEffects();
  const revealed = useRef(false);

  // On the first render the selected tab jumps into view; later changes glide to it.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const tab = scroller?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (scroller && tab) revealTab(scroller, tab, revealed.current && !reduced);
    revealed.current = true;
  }, [active, reduced]);

  return (
    <BaseTabs.Root
      value={value}
      defaultValue={initial}
      onValueChange={(next: Value) => {
        setUncontrolled(next);
        onValueChange?.(next);
      }}
      className={className}
    >
      <div ref={scrollerRef} className={slots.scroller()}>
        <BaseTabs.List aria-label={label} className={slots.list()}>
          {tabs.map((tab) => (
            <BaseTabs.Tab key={tab.value} value={tab.value} disabled={tab.disabled} className={slots.tab()}>
              {tab.label}
            </BaseTabs.Tab>
          ))}
          <BaseTabs.Indicator className={slots.indicator()} />
        </BaseTabs.List>
      </div>
      {children}
    </BaseTabs.Root>
  );
}

export interface TabsPanelProps extends Pick<ComponentProps<typeof BaseTabs.Panel>, "keepMounted"> {
  value: string;
  className?: string;
  children: ReactNode;
}

/** The content of one tab. */
export function TabsPanel({ value, className, keepMounted, children }: TabsPanelProps) {
  return (
    <BaseTabs.Panel value={value} keepMounted={keepMounted} className={tabsVariants().panel({ className })}>
      {children}
    </BaseTabs.Panel>
  );
}
