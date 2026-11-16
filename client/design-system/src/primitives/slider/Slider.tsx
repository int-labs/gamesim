import { Slider as BaseSlider } from "@base-ui/react/slider";
import type { CSSProperties } from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { tv } from "../../lib/tv";

/**
 * A decision's slider (Figma 832:87599, 864:25418 and 1368:48785): a 6 px gray 300 rail, a 24 px
 * white thumb on its shadow that never leaves the rail, and under the rail a gray 400 tick for
 * each value with its label in SemiBold 14/20 gray 800: 69 px in all. The brand indigo fill runs
 * from a value to the thumb. Values the player may not choose now fade, and the thumb stops at
 * the last one allowed. Figma draws no hover or focus: the thumb takes a soft indigo halo under
 * the pointer and the focus ring from the keyboard. `sm` is the slider in a decision's column
 * (Figma's 174 px sliders): the labels in Regular 12/16, 4 px under the ticks, 59 px in all.
 */
export const sliderVariants = tv({
  slots: {
    // A locked decision's column dims as one (DecisionRow), so a slider in it does not dim again.
    root: "w-full data-disabled:not-in-data-locked:opacity-50",
    // The whole slider answers the pointer, its labels too, as today's does.
    control: "slider-control relative flex touch-none flex-col select-none not-data-disabled:cursor-pointer",
    rail: "slider-rail pointer-events-none absolute inset-x-0 h-(--slider-track-height) overflow-hidden rounded-full bg-(--slider-rail)",
    fill: "slider-fill absolute inset-y-0 bg-accent",
    track: "h-(--slider-thumb-size) w-full",
    thumb: [
      "size-(--slider-thumb-size) rounded-full bg-surface-card shadow-thumb outline-offset-2",
      "transition-shadow duration-fast ease-standard motion-reduce:transition-none",
      "not-data-disabled:cursor-grab not-data-disabled:hover:ring-4 not-data-disabled:hover:ring-accent/12",
      "data-dragging:cursor-grabbing data-dragging:ring-4 data-dragging:ring-accent/16",
      "has-focus-visible:outline-2 has-focus-visible:outline-focus-ring",
    ],
    marks: "slider-marks grid",
    mark: "flex min-w-0 flex-col items-center gap-(--slider-label-gap) transition-opacity duration-fast ease-standard motion-reduce:transition-none",
    tick: "h-(--slider-marker-height) w-(--slider-marker-width) shrink-0 bg-(--slider-marker)",
    label: "text-center type-body font-semibold text-fg-body",
  },
  variants: {
    marks: {
      numbers: { control: "slider-inset-thumb", label: "whitespace-nowrap tabular-nums" },
      // As wide as the word, up to its column and the gap under the tick; then it wraps.
      words: { control: "slider-inset-column", label: "slider-word w-max wrap-break-word" },
    },
    /** A value the player may not choose now. */
    unavailable: { true: { mark: "opacity-40" } },
    size: {
      md: {},
      sm: { mark: "gap-(--slider-label-gap-sm)", label: "type-caption font-normal" },
    },
  },
  defaultVariants: { marks: "numbers", size: "md" },
});

interface SliderBaseProps {
  /** The value on the scale. */
  value: number;
  /** While the thumb moves: each value it reaches, from the pointer or a key. */
  onValueChange: (value: number) => void;
  /** When the player lets go of the thumb, or after a key: the value to keep (today's commit on release). */
  onValueCommit?: (value: number) => void;
  /**
   * The least and the most the player may choose now (the level's limits, the energy left): the
   * marks outside fade and the thumb stops at them. Default the scale's ends.
   */
  allowedMin?: number;
  allowedMax?: number;
  /**
   * Where the indigo fill starts: 0 for a change on last round (a level), the scale's start for a
   * score, or null for none. Default the scale's start for numbers, none for words.
   */
  fillFrom?: number | null;
  /** How screen readers say a value. Default its label. */
  getAriaValueText?: (value: number) => string;
  /** The round's decisions are locked: the thumb stops answering. */
  disabled?: boolean;
  /** The value's name when a form is submitted. */
  name?: string;
  /** `sm` in a decision's column, where three share 620 px. Default `md`. */
  size?: "md" | "sm";
  /** Names the slider when no label does (a DecisionRow's title does). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
}

export interface SliderNumbersProps extends SliderBaseProps {
  /** The scale's ends: a mark for each step between them, written as its number. */
  min: number;
  max: number;
  /** Default 1. */
  step?: number;
  /** Writes a mark's number ("5%"). Default the app's number format. */
  formatLabel?: (value: number) => string;
  labels?: never;
}

export interface SliderWordsProps extends SliderBaseProps {
  /**
   * Words for the values 0, 1, 2 and on ("Very Low" to "Very High"): each sits over its tick in an
   * equal share of the width, and wraps when it is long.
   */
  labels: readonly string[];
  min?: never;
  max?: never;
  step?: never;
  formatLabel?: never;
}

export type SliderProps = SliderNumbersProps | SliderWordsProps;

/** The number of decimal places in a step or a bound (0.25 has 2), so marks add up without float noise. */
function decimalsOf(value: number) {
  const [, fraction = ""] = String(value).split(".");
  return fraction.length;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/**
 * A value on a scale of marks: a level's change (-2 to 5), a score (0 to 10), or words ("Very Low"
 * to "Very High"). It keeps today's behaviour: the value follows the thumb as it moves and is kept
 * when the player lets go; a press anywhere on the slider, its labels too, moves the thumb there;
 * and the thumb never passes the values allowed now. Inside a DecisionRow the decision's title and
 * description name and describe it.
 */
export function Slider(props: SliderProps) {
  const {
    value,
    onValueChange,
    onValueCommit,
    allowedMin,
    allowedMax,
    getAriaValueText,
    disabled,
    name,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    className,
  } = props;
  const format = useNumberFormat();
  const words = props.labels;
  const min = words ? 0 : props.min;
  const max = words ? Math.max(words.length - 1, 1) : props.max;
  const step = words ? 1 : (props.step ?? 1);
  const decimals = Math.max(decimalsOf(step), decimalsOf(min));
  const count = Math.max(Math.round((max - min) / step) + 1, 2);
  const marks = Array.from({ length: count }, (_, index) => Number((min + index * step).toFixed(decimals)));

  const labelOf = (mark: number, index: number) =>
    words ? (words[index] ?? "") : props.formatLabel ? props.formatLabel(mark) : format.number(mark, { decimals });
  const spoken = (mark: number) => getAriaValueText?.(mark) ?? labelOf(mark, Math.round((mark - min) / step));

  // The values allowed now; the thumb shows the value within them, as today's does.
  const low = clamp(allowedMin ?? min, min, max);
  const high = Math.max(low, clamp(allowedMax ?? max, min, max));
  const shown = clamp(value, low, high);

  const fillFrom = props.fillFrom === undefined ? (words ? null : min) : props.fillFrom;
  const origin = fillFrom === null ? null : clamp(fillFrom, min, max);
  const share = (at: number) => (at - min) / (max - min);
  const fillStart = origin === null ? shown : Math.min(origin, shown);
  const fillEnd = origin === null ? shown : Math.max(origin, shown);

  const slots = sliderVariants({ marks: words ? "words" : "numbers", size: props.size });
  const geometry = {
    "--slider-marks": count,
    "--slider-fill-start": share(fillStart),
    "--slider-fill-end": share(fillEnd),
  } as CSSProperties;

  return (
    <BaseSlider.Root
      value={shown}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      name={name}
      aria-labelledby={ariaLabelledBy}
      onValueChange={(next, details) => {
        const kept = clamp(next, low, high);
        // Past the values allowed: the thumb stays where it is, and nothing is kept on release.
        if (kept === shown) {
          details.cancel();
          return;
        }
        onValueChange(kept);
      }}
      onValueCommitted={(next) => onValueCommit?.(clamp(next, low, high))}
      // Disabled here or by its Field, the group says so, and its dimmed labels count as inactive.
      render={(rootProps, state) => <div {...rootProps} aria-disabled={state.disabled || undefined} />}
      className={slots.root({ className })}
      style={geometry}
    >
      <BaseSlider.Control className={slots.control()}>
        <div className={slots.rail()}>
          {origin === null ? null : (
            <div
              className={slots.fill()}
              data-from-start={fillStart <= min || undefined}
              data-to-end={fillEnd >= max || undefined}
            />
          )}
        </div>
        <BaseSlider.Track className={slots.track()}>
          <BaseSlider.Thumb
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            getAriaValueText={(_formatted, at) => spoken(at)}
            className={slots.thumb()}
          />
        </BaseSlider.Track>
        <div aria-hidden className={slots.marks()}>
          {marks.map((mark, index) => {
            const unavailable = mark < low || mark > high;
            return (
              <div key={mark} aria-disabled={unavailable || undefined} className={slots.mark({ unavailable })}>
                <span className={slots.tick()} />
                <span className={slots.label()}>{labelOf(mark, index)}</span>
              </div>
            );
          })}
        </div>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
