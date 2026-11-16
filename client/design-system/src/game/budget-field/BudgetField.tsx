import { useAnimate } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useNumberFormat } from "../../foundations/format/NumberFormatProvider";
import { useReducedEffects } from "../../foundations/motion/MotionProvider";
import { shake } from "../../foundations/motion/presets";
import { tv } from "../../lib/tv";
import { Tooltip } from "../../overlays/tooltip/Tooltip";
import { Button } from "../../primitives/button/Button";
import { NumberField } from "../../primitives/number-field/NumberField";
import { tokens } from "../../tokens";

/** After an amount the page refused, the cap stays under the field this long. */
const HINT_DURATION = Number.parseFloat(tokens.component["budget-field"]["hint-duration"]);
/** Today's tolerance: an amount within half a unit of the cap is not over it. */
const TOLERANCE = 0.5;

export interface BudgetFieldMessages {
  /** The cap, under an amount over it or refused: "Max ฿4,000,000". */
  max: (amount: string) => string;
  /** How much more fits, once part of the budget is spent: "Up to ฿2,500,000 more". */
  room: (amount: string) => string;
  /** The action that fills the field to its cap: "Use max ฿4,000,000". */
  useMax: (amount: string) => string;
}

/** Today's copy (BudgetGuardedNumericInput). */
export const defaultBudgetFieldMessages: BudgetFieldMessages = {
  max: (amount) => `Max ${amount}`,
  room: (amount) => `Up to ${amount} more`,
  useMax: (amount) => `Use max ${amount}`,
};

/**
 * Figma draws no budget guard: the field is the decision field; under it, at its end, the hint in
 * the "Previous:" line's italic 14/20 (gray 600, red 700 at the cap), then Use max as a small text
 * button.
 */
export const budgetFieldVariants = tv({
  slots: {
    root: "flex w-full flex-col items-end gap-1.5",
    field: "w-full",
    hint: "type-hint text-end tabular-nums",
    // Its label ends where the field and the hint end; its padding reaches past them.
    useMax: "-me-2",
  },
  variants: {
    warn: {
      true: { hint: "text-fg-danger" },
      false: { hint: "text-fg-muted" },
    },
  },
});

export interface BudgetFieldProps {
  /** The amount kept. */
  value: number;
  /**
   * The most the field can hold now: what is left of the budget plus its own amount. Without one
   * there is no budget, and the field takes any amount.
   */
  cap?: number;
  /** Say how much more fits while under the cap: today, once part of the budget is spent elsewhere. */
  showRoom?: boolean;
  /**
   * The player left the field, pressed Enter or chose Use max: the amount to keep. Return false
   * when the page refuses it (the budget, or the energy a first spend takes): the field puts the
   * kept amount back and shows the cap for a few seconds.
   */
  onCommit: (value: number) => boolean | void;
  /** How the amount reads. Default `currency`: the app's currency symbol before it. */
  kind?: "number" | "currency";
  /** Default 0: whole amounts, as today's. */
  decimals?: number;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  messages?: Partial<BudgetFieldMessages>;
  className?: string;
}

/**
 * An amount under a shared budget (today's BudgetGuardedNumericInput). The player types freely;
 * past the cap the field turns red and shakes once, and the cap shows under it with Use max, which
 * fills the field to it. Leaving the field keeps the amount if the page accepts it; otherwise the
 * kept amount comes back and the cap stays for a few seconds. Pointing at the field shows the cap;
 * screen readers hear it, or the room left, as the field's description.
 */
export function BudgetField({
  value,
  cap,
  showRoom = false,
  onCommit,
  kind = "currency",
  decimals = 0,
  disabled = false,
  placeholder,
  id,
  name,
  messages,
  className,
  ...labelling
}: BudgetFieldProps) {
  const text = { ...defaultBudgetFieldMessages, ...messages };
  const format = useNumberFormat();
  const reduced = useReducedEffects();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const inputRef = useRef<HTMLInputElement>(null);
  const capId = useId();
  const hintId = useId();

  // What the player is typing, before it is kept: over the cap it turns the field red. A new
  // amount from the page replaces it, unless the player is typing.
  const [draft, setDraft] = useState(value);
  const [typing, setTyping] = useState(false);
  const [kept, setKept] = useState(value);
  if (!Object.is(kept, value)) {
    setKept(value);
    if (!typing) setDraft(value);
  }

  // After a refusal the cap stays under the field for a few seconds.
  const [refused, setRefused] = useState(false);
  const refusedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(refusedTimer.current), []);

  const budgeted = cap !== undefined && Number.isFinite(cap);
  const over = budgeted && !disabled && draft > cap + TOLERANCE;
  const room = budgeted ? Math.max(0, cap - value) : 0;
  const written = (amount: number) => (kind === "currency" ? format.money(amount, { decimals }) : format.number(amount, { decimals }));

  // Going past the cap shakes the field once, as a refused entry does.
  useEffect(() => {
    if (!over || reduced || !scope.current) return;
    const { transition, ...keyframes } = shake;
    void animate(scope.current, keyframes, transition);
  }, [over, reduced, animate, scope]);

  const clearRefused = () => {
    clearTimeout(refusedTimer.current);
    setRefused(false);
  };

  const commit = (amount: number) => {
    setTyping(false);
    if (onCommit(amount) === false) {
      setDraft(value);
      setRefused(true);
      clearTimeout(refusedTimer.current);
      refusedTimer.current = setTimeout(() => setRefused(false), HINT_DURATION);
      return;
    }
    clearRefused();
  };

  const fill = () => {
    const amount = Math.floor(value + room);
    if (onCommit(amount) === false) {
      setDraft(value);
      return;
    }
    setDraft(amount);
    clearRefused();
    // The button goes once the field is full: the player carries on from the field.
    inputRef.current?.focus();
  };

  const warn = budgeted && (over || refused);
  const hint = !budgeted ? null : warn ? text.max(written(cap)) : showRoom && room > 0 ? text.room(written(room)) : null;
  // Without a hint, the cap is the field's description and its tooltip.
  const capOnly = budgeted && hint === null;
  const offerMax = warn && !disabled && room > 0;
  const slots = budgetFieldVariants({ warn });

  return (
    <div className={slots.root({ className })}>
      <Tooltip content={capOnly && !disabled ? text.max(written(cap)) : null} describe={false}>
        <div ref={scope} className={slots.field()}>
          <NumberField
            ref={inputRef}
            value={draft}
            onValueChange={(next) => {
              setTyping(true);
              setDraft(next);
            }}
            onCommit={commit}
            validateWhileTyping={false}
            kind={kind}
            decimals={decimals}
            invalid={warn}
            disabled={disabled}
            placeholder={placeholder}
            id={id}
            name={name}
            aria-describedby={hint ? hintId : capOnly ? capId : undefined}
            {...labelling}
          />
        </div>
      </Tooltip>
      {capOnly ? (
        <span id={capId} hidden>
          {text.max(written(cap))}
        </span>
      ) : null}
      {hint ? (
        <p id={hintId} className={slots.hint()}>
          {hint}
        </p>
      ) : null}
      {offerMax ? (
        <Button variant="text" size="xs" onClick={fill} className={slots.useMax()}>
          {text.useMax(written(value + room))}
        </Button>
      ) : null}
    </div>
  );
}
