import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { forwardRef, type ReactNode } from "react";
import { IconPlayProvider, useIconPlay } from "../../foundations/icon/AnimatedIcon";
import { ButtonContent, type ButtonIconProps } from "./ButtonContent";
import { buttonVariants, defaultButtonSize, type ButtonSize, type ButtonTone, type ButtonVariant } from "./buttonVariants";

export interface LinkButtonProps extends Omit<useRender.ComponentProps<"a">, "className" | "children">, ButtonIconProps {
  /** Default `outline`, as the Figma "Feedback Slides" link. */
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * A link that looks like a button: it keeps link semantics (it navigates). Pass `render` to use
 * the router's link: <LinkButton render={<Link to="/slides" />}>Feedback Slides</LinkButton>.
 */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  { variant = "outline", tone = "primary", size, fullWidth = false, iconStart, iconEnd, iconAnimation, iconStroke, render, className, children, ...props },
  ref,
) {
  const { signal, play } = useIconPlay();
  const resolvedSize = size ?? defaultButtonSize[variant];
  const slots = buttonVariants({ variant, tone, size: resolvedSize, fullWidth, interactive: true });
  return useRender({
    defaultTagName: "a",
    render,
    ref,
    props: mergeProps<"a">(
      {
        className: slots.root({ className }),
        onPointerEnter: play,
        onFocus: play,
        children: (
          <>
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
          </>
        ),
      },
      props,
    ),
  });
});
