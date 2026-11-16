import { ArrowLeft, ArrowRight, Maximize2, Minimize2 } from "lucide-react";
import { AnimatePresence, m, type Variants } from "motion/react";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { transitions } from "../../foundations/motion/presets";
import { Heading } from "../../foundations/text/Heading";
import { tv } from "../../lib/tv";
import { Button } from "../../primitives/button/Button";
import { IconButton } from "../../primitives/icon-button/IconButton";
import { tokens } from "../../tokens";

const SLIDES = tokens.component.slides;
const px = (value: string) => Number.parseFloat(value);
/** The size a slide is laid out at; it grows to fit, and shrinks below it only on a phone or in full screen. */
const SLIDE_WIDTH = px(SLIDES["slide-width"]);
const SLIDE_HEIGHT = px(SLIDES["slide-height"]);
/** A phone: a screen narrower than the sm breakpoint, or a touch screen, where pinch-zoom enlarges the page. */
const PHONE_QUERY = `(max-width: ${px(tokens.breakpoint.sm) - 0.02}px), (pointer: coarse)`;
/** How far a slide moves as it comes in or goes. */
const SLIDE_TRAVEL = px(tokens.spacing["6"]);

/** Keys the deck leaves to what has focus: fields, and widgets that move with the arrows themselves. */
const OWN_KEYS = "input, textarea, select, [contenteditable='true'], [role='slider'], [role='grid'], [role='listbox'], [role='menu'], [role='tablist']";

export interface SlideDeckMessages {
  previous: string;
  next: string;
  /** Between Previous and Next: "Slide 2/10". */
  position: (number: number, total: number) => string;
  /** What screen readers hear when a slide shows. */
  announce: (number: number, total: number, title?: string) => string;
  /** A slide without a title, for screen readers: "2 of 10". */
  slideLabel: (number: number, total: number) => string;
  fullScreen: string;
  exitFullScreen: string;
  /** What screen readers call the deck and each slide. */
  deck: string;
  slide: string;
}

export const defaultSlideDeckMessages: SlideDeckMessages = {
  previous: "Previous",
  next: "Next",
  position: (number, total) => `Slide ${number}/${total}`,
  announce: (number, total, title) => (title ? `Slide ${number} of ${total}: ${title}` : `Slide ${number} of ${total}`),
  slideLabel: (number, total) => `${number} of ${total}`,
  fullScreen: "Full screen",
  exitFullScreen: "Exit full screen",
  deck: "slide deck",
  slide: "slide",
};

/**
 * Figma's slides viewer (3344:153468, 3344:153492, 3344:153515): a white frame with a black 16%
 * edge, 12 px corners and 20 inside; the slide, a 16:9 card with a black 16% edge and 16 px
 * corners, its title centred in Poppins 30 over the content and a 12 px footer under it; under
 * the slide, Previous and Next (outline pink, 46 px) at its edges and "Slide 2/10" between them.
 * A slide is laid out at Figma's 809 x 455 and grows to fill the frame, or the screen in full
 * screen, so it reads the same at every size. On a computer it never shrinks below that, so
 * browser zoom still enlarges its text, and the frame scrolls instead. On a phone (narrower than
 * the sm breakpoint, or a touch screen) it shrinks to fit the width, as pinch-zoom enlarges it
 * there, and Previous and Next show only their arrows; in full screen it fits the screen.
 */
export const slideDeckVariants = tv({
  slots: {
    root: [
      "relative flex min-h-0 flex-col gap-(--slides-gap) rounded-(--slides-radius) bg-surface-card p-(--slides-padding)",
      "inset-ring inset-ring-line-strong outline-none data-fullscreen:rounded-none data-fullscreen:inset-ring-0",
    ],
    stage: "flex min-h-0 flex-1 items-center-safe justify-center-safe overflow-auto",
    frame: "relative shrink-0",
    motion: "absolute inset-0",
    scaled: "origin-top-left",
    slide: [
      "flex size-full flex-col gap-(--slides-slide-gap) overflow-hidden rounded-(--slides-slide-radius) bg-surface-card",
      "p-(--slides-slide-padding) inset-ring inset-ring-line-strong",
    ],
    // Room at the end for the full-screen button, which sits over the slide's corner.
    // Slides keep Figma's Regular title: presentation type, not a page's hierarchy.
    title: "px-8 font-normal whitespace-pre-line",
    content: "flex min-h-0 flex-1 flex-col overflow-auto",
    footer: "type-caption text-fg-primary",
    corner: "absolute inset-e-2 top-2",
    nav: "grid max-w-full grid-cols-3 items-center self-center",
    previous: "justify-self-start sm:min-w-(--slides-button-width)",
    position: "text-center type-label text-fg-link tabular-nums",
    next: "justify-self-end sm:min-w-(--slides-button-width)",
    // On a phone the two buttons show their arrows, their names left to screen readers.
    buttonLabel: "max-sm:sr-only",
  },
});

interface SlideContextValue {
  number: number;
  total: number;
  step: number;
  footer?: (number: number, total: number) => ReactNode;
  headingLevel: 2 | 3 | 4;
  messages: SlideDeckMessages;
}

const SlideContext = createContext<SlideContextValue | null>(null);

export interface SlideProps {
  /** Over the content, centred (Poppins 30); a line break in it starts a new line. */
  title?: string;
  /**
   * Steps shown one at a time before Next moves on, as today's league table reveals a row at a
   * time. Previous steps back. Default 1.
   */
  steps?: number;
  /** What the slide shows; it fills the slide under the title. A function gets the step shown, from 0. */
  children?: ReactNode | ((step: number) => ReactNode);
  className?: string;
}

/** One slide of a SlideDeck: its title, what it shows (a chart that fills it, a table), and the deck's footer. */
export function Slide({ title, children, className }: SlideProps) {
  const deck = useContext(SlideContext);
  const titleId = useId();
  const slots = slideDeckVariants();
  if (!deck) throw new Error("Slide belongs inside a SlideDeck.");
  const content = typeof children === "function" ? children(deck.step) : children;
  return (
    <section
      role="group"
      aria-roledescription={deck.messages.slide}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : deck.messages.slideLabel(deck.number, deck.total)}
      className={slots.slide({ className })}
    >
      {title ? (
        <Heading id={titleId} level={deck.headingLevel} variant="page-title" align="center" className={slots.title()}>
          {title}
        </Heading>
      ) : null}
      <div className={slots.content()}>{content}</div>
      {deck.footer ? <p className={slots.footer()}>{deck.footer(deck.number, deck.total)}</p> : null}
    </section>
  );
}

export interface SlideDeckProps {
  /** Names the deck for screen readers; the page's header shows the simulation's name over it. */
  title: string;
  /** Under each slide's content: "(c) 2025 by Int Labs for Client. All Rights Reserved | 2/10". */
  footer?: (number: number, total: number) => ReactNode;
  /** The slide shown, from 0, when the page holds it. */
  index?: number;
  /** The first slide shown when the deck holds its own place. Default 0. */
  defaultIndex?: number;
  /** A new slide shows, with its index. */
  onIndexChange?: (index: number) => void;
  /** The heading level of the slides' titles in the page. Default 2. */
  headingLevel?: 2 | 3 | 4;
  messages?: Partial<SlideDeckMessages>;
  /** Slide elements, in order. */
  children: ReactNode;
  className?: string;
}

/** Full screen is the browser's: the deck hears when it starts and ends (Escape included). */
function subscribeFullScreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Whether the page may go full screen does not change while it is open. */
function subscribeNothing() {
  return () => undefined;
}

function subscribePhone(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isPhone() {
  return typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches;
}

const slideMotion: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * SLIDE_TRAVEL }),
  shown: { opacity: 1, x: 0, transition: transitions.base },
  leave: (direction: number) => ({ opacity: 0, x: direction * -SLIDE_TRAVEL, transition: transitions.fast }),
};

/**
 * Slides shown one at a time. Previous and Next move between them (only Next on the first slide,
 * only Previous on the last), and so do the arrow keys, Page Up and Page Down while focus is in
 * the deck; Home and End go to the ends. A slide slides in from the side it comes from. Screen
 * readers hear each new slide's number and title. Full screen fills the screen with the deck, the
 * slide as large as it fits; Escape leaves it.
 */
export function SlideDeck({ title, footer, index, defaultIndex = 0, onIndexChange, headingLevel = 2, messages, children, className }: SlideDeckProps) {
  const text = { ...defaultSlideDeckMessages, ...messages };
  const slots = slideDeckVariants();
  const slides = Children.toArray(children).filter((child): child is ReactElement<SlideProps> => isValidElement(child));
  const total = slides.length;
  const [ownIndex, setOwnIndex] = useState(defaultIndex);
  const current = Math.min(Math.max(index ?? ownIndex, 0), Math.max(total - 1, 0));
  // The step belongs to the slide it was taken on; a slide the page moves to starts at its first.
  const [position, setPosition] = useState({ slide: current, step: 0 });
  const step = position.slide === current ? position.step : 0;
  const [direction, setDirection] = useState(1);
  const [announcement, setAnnouncement] = useState("");
  const deckId = useId();
  const fullScreen = useSyncExternalStore(subscribeFullScreen, () => document.fullscreenElement?.id === deckId, () => false);
  const canFullScreen = useSyncExternalStore(subscribeNothing, () => document.fullscreenEnabled === true, () => false);
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const [scale, setScale] = useState(1);
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const keepFocus = useRef(false);

  const stepsOf = (slide: number) => Math.max(1, slides[slide]?.props.steps ?? 1);
  const titleOf = (slide: number) => slides[slide]?.props.title;

  const move = (slide: number, slideStep = 0) => {
    const target = Math.min(Math.max(slide, 0), total - 1);
    keepFocus.current = rootRef.current?.contains(document.activeElement) ?? false;
    setPosition({ slide: target, step: slideStep });
    if (target === current) return;
    setDirection(target > current ? 1 : -1);
    setAnnouncement(text.announce(target + 1, total, titleOf(target)));
    if (index === undefined) setOwnIndex(target);
    onIndexChange?.(target);
  };
  const hasNext = step < stepsOf(current) - 1 || current < total - 1;
  const hasPrevious = step > 0 || current > 0;
  const goNext = () => {
    if (step < stepsOf(current) - 1) move(current, step + 1);
    else if (current < total - 1) move(current + 1);
  };
  const goPrevious = () => {
    if (step > 0) move(current, step - 1);
    else if (current > 0) move(current - 1, stepsOf(current - 1) - 1);
  };

  // Previous or Next goes when the deck reaches an end: focus moves to the other, so it stays in the deck.
  useEffect(() => {
    if (!keepFocus.current) return;
    keepFocus.current = false;
    const focused = document.activeElement;
    if (focused && focused !== document.body && rootRef.current?.contains(focused)) return;
    (nextRef.current ?? previousRef.current ?? rootRef.current)?.focus();
  }, [current, step]);

  // The slide grows to fill the stage, at its 16:9. On a computer it never shrinks below the size
  // it is laid out at; on a phone it fits the stage's width, and in full screen the whole screen.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const widthFit = stage.clientWidth / SLIDE_WIDTH;
      const fit = Math.min(widthFit, stage.clientHeight / SLIDE_HEIGHT);
      if (!Number.isFinite(fit)) setScale(1);
      else if (fullScreen) setScale(fit);
      // Its width alone: in a page the stage is as tall as the slide, so its height would hold it small.
      else if (phone && widthFit < 1) setScale(widthFit);
      else setScale(Math.max(1, fit));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fullScreen, phone]);

  const toggleFullScreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest(OWN_KEYS)) return;
    const actions: Record<string, () => void> = {
      ArrowRight: goNext,
      PageDown: goNext,
      ArrowLeft: goPrevious,
      PageUp: goPrevious,
      Home: () => move(0),
      End: () => move(total - 1),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const width = SLIDE_WIDTH * scale;
  const context: SlideContextValue = { number: current + 1, total, step, footer, headingLevel, messages: text };

  return (
    <section
      ref={rootRef}
      id={deckId}
      aria-roledescription={text.deck}
      aria-label={title}
      // Focusable, so a press on a slide keeps the keys in the deck.
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-fullscreen={fullScreen || undefined}
      className={slots.root({ className })}
    >
      <div ref={stageRef} className={slots.stage()}>
        <div className={slots.frame()} style={{ width, height: SLIDE_HEIGHT * scale }}>
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <m.div key={current} custom={direction} variants={slideMotion} initial="enter" animate="shown" exit="leave" className={slots.motion()}>
              <div className={slots.scaled()} style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${scale})` }}>
                <SlideContext.Provider value={context}>{slides[current]}</SlideContext.Provider>
              </div>
            </m.div>
          </AnimatePresence>
          {canFullScreen ? (
            <IconButton
              icon={fullScreen ? Minimize2 : Maximize2}
              label={fullScreen ? text.exitFullScreen : text.fullScreen}
              onClick={toggleFullScreen}
              className={slots.corner()}
            />
          ) : null}
        </div>
      </div>
      <div className={slots.nav()} style={{ width }}>
        {hasPrevious ? (
          <Button ref={previousRef} variant="outline" iconStart={ArrowLeft} onClick={goPrevious} className={slots.previous()}>
            <span className={slots.buttonLabel()}>{text.previous}</span>
          </Button>
        ) : (
          <span />
        )}
        <p className={slots.position()}>{text.position(current + 1, total)}</p>
        {hasNext ? (
          <Button ref={nextRef} variant="outline" iconEnd={ArrowRight} onClick={goNext} className={slots.next()}>
            <span className={slots.buttonLabel()}>{text.next}</span>
          </Button>
        ) : (
          <span />
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
