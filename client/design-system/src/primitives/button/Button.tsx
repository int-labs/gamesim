import { Button as BaseButton } from "@base-ui/react/button";
import { Check } from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { burstFrom } from "../../delight/burst";
import { AnimatedIcon, IconPlayProvider, useIconPlay } from "../../foundations/icon/AnimatedIcon";
import { mergeRefs } from "../../lib/refs";
import { Spinner } from "../spinner/Spinner";
import { ButtonContent, type ButtonIconProps } from "./ButtonContent";
import { buttonVariants, defaultButtonSize, type ButtonSize, type ButtonTone, type ButtonVariant } from "./buttonVariants";

export type ButtonStatus = "idle" | "loading" | "success";

export interface ButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseButton>, "className" | "children" | "disabled" | "focusableWhenDisabled">,
    ButtonIconProps {
  /** `solid` (the Figma primary), `outline`, `text`, `secondary` (the toolbar's Sort and Filter) or `flat` (the dialog's Delete). Default `solid`. */
  variant?: ButtonVariant;
  /** Solid and flat buttons: `primary` (pink), `energy` (yellow Start Round) or `danger` (red End Round; red 500 when flat). */
  tone?: ButtonTone;
  /** Default: `md` (40 px) for solid, secondary and flat, `lg` (46 px) for outline, `sm` (38 px) for text. */
  size?: ButtonSize;
  /** Stretch to the width of the container. */
  fullWidth?: boolean;
  disabled?: boolean;
  /**
   * `loading` shows the spinner and keeps the button focusable but inactive (aria-busy);
   * `success` draws a check. Both keep the button's width.
   */
  status?: ButtonStatus;
  /** A small confetti burst when the status turns to success (never with reduced effects). */
  celebrate?: boolean;
  className?: string;
  children?: ReactNode;
}

/** A button: the pink primary with its sheen and glow, the yellow and red round actions, outline and text buttons. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "solid",
    tone = "primary",
    size,
    fullWidth = false,
    disabled = false,
    status = "idle",
    celebrate = false,
    iconStart,
    iconEnd,
    iconAnimation,
    iconStroke,
    className,
    children,
    onPointerEnter,
    onFocus,
    ...props
  },
  ref,
) {
  const element = useRef<HTMLButtonElement | null>(null);
  const mergedRef = useMemo(() => mergeRefs(ref, element), [ref]);
  const { signal, play } = useIconPlay();
  const busy = status !== "idle";
  const resolvedSize = size ?? defaultButtonSize[variant];
  const slots = buttonVariants({ variant, tone, size: resolvedSize, fullWidth, interactive: !disabled && !busy, busy, disabled });

  const previousStatus = useRef(status);
  useEffect(() => {
    if (celebrate && status === "success" && previousStatus.current !== "success" && element.current) void burstFrom(element.current);
    previousStatus.current = status;
  }, [celebrate, status]);

  return (
    <BaseButton
      ref={mergedRef}
      disabled={disabled || busy}
      focusableWhenDisabled={busy}
      aria-busy={status === "loading" ? true : undefined}
      data-status={status}
      className={slots.root({ className })}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        play();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        play();
      }}
      {...props}
    >
      {variant === "solid" ? <span aria-hidden className={slots.sheen()} /> : null}
      {variant === "solid" && tone === "primary" ? (
        <>
          <span aria-hidden className={slots.sheenHover()} />
          <span aria-hidden className={slots.glow()} />
        </>
      ) : null}
      <IconPlayProvider signal={signal}>
        <span className={slots.content()}>
          <ButtonContent size={resolvedSize} iconStart={iconStart} iconEnd={iconEnd} iconAnimation={iconAnimation} iconStroke={iconStroke}>
            {children}
          </ButtonContent>
        </span>
      </IconPlayProvider>
      {status === "loading" ? (
        <span aria-hidden className={slots.overlay()}>
          <Spinner size="sm" />
        </span>
      ) : null}
      {status === "success" ? (
        <span aria-hidden className={slots.overlay()}>
          <AnimatedIcon icon={Check} animation="draw" trigger="mount" size="2xl" stroke="bold" />
        </span>
      ) : null}
    </BaseButton>
  );
});
