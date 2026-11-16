import { useAnimate } from "motion/react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedEffects } from "../motion/MotionProvider";
import { iconAnimations, type IconAnimation, type IconAnimationName } from "./animations";
import { Icon, type IconProps } from "./Icon";

const IconPlaySignal = createContext(0);

/**
 * Plays the animated icons inside it that use `trigger="parent"` each time `signal` changes.
 * Buttons, navigation items and cards wrap their content in it (see useIconPlay).
 */
export function IconPlayProvider({ signal, children }: { signal: number; children: ReactNode }) {
  return <IconPlaySignal.Provider value={signal}>{children}</IconPlaySignal.Provider>;
}

/** For a parent that plays its icons: call `play` on pointer enter or focus, pass `signal` to IconPlayProvider. */
export function useIconPlay() {
  const [signal, setSignal] = useState(0);
  const play = useCallback(() => setSignal((current) => current + 1), []);
  return { signal, play };
}

export type AnimatedIconTrigger = "hover" | "parent" | "mount" | "change" | "manual";

export interface AnimatedIconHandle {
  /** Plays the animation once (does nothing while effects are reduced). */
  play: () => void;
}

export interface AnimatedIconProps extends IconProps {
  /** Default `pop`. */
  animation?: IconAnimationName;
  /**
   * When it plays: `hover` (the pointer enters the icon, the default), `parent` (see
   * IconPlayProvider), `mount`, `change` (whenever `value` changes) or `manual` (the ref's `play`).
   */
  trigger?: AnimatedIconTrigger;
  /** With `trigger="change"`: the value whose changes play the animation. */
  value?: unknown;
}

/** An Icon that moves: on hover, with its parent, on mount, on a value change or on demand. */
export const AnimatedIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(function AnimatedIcon(
  { animation = "pop", trigger = "hover", value, onPointerEnter, ...iconProps },
  ref,
) {
  const [scope, animate] = useAnimate<SVGSVGElement>();
  const reduced = useReducedEffects();

  const play = useCallback(() => {
    const svg = scope.current;
    if (reduced || !svg) return;
    const preset: IconAnimation = iconAnimations[animation];
    const targets = preset.parts ? Array.from(svg.querySelectorAll(preset.parts)) : svg;
    void animate(targets, preset.keyframes, preset.options);
  }, [animate, animation, reduced, scope]);

  useImperativeHandle(ref, () => ({ play }), [play]);

  const mounted = useRef(false);
  useEffect(() => {
    if (trigger !== "mount" || mounted.current) return;
    mounted.current = true;
    play();
  }, [trigger, play]);

  const previousValue = useRef(value);
  useEffect(() => {
    if (trigger === "change" && !Object.is(previousValue.current, value)) play();
    previousValue.current = value;
  }, [trigger, value, play]);

  const signal = useContext(IconPlaySignal);
  const previousSignal = useRef(signal);
  useEffect(() => {
    if (trigger === "parent" && signal !== previousSignal.current) play();
    previousSignal.current = signal;
  }, [trigger, signal, play]);

  return (
    <Icon
      ref={scope}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (trigger === "hover") play();
      }}
      {...iconProps}
    />
  );
});
