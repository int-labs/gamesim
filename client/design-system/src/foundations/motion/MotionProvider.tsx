import { LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { motionTokens } from "../../tokens";

const ReduceEffectsContext = createContext(false);

const loadFeatures = () => import("./features").then((module) => module.default);

const defaultTransition = { duration: motionTokens.duration.base, ease: motionTokens.ease.standard };

export interface MotionProviderProps {
  children: ReactNode;
  /**
   * The app's "Reduce effects" switch (a facilitator setting, or a projector or slow laptop):
   * movement, celebrations and animated icons stop, as when the system asks for reduced motion.
   */
  reduceEffects?: boolean;
}

/**
 * Mount once at the root of an app. Animations use Motion's `m` components, whose features load
 * lazily; reduced motion follows the system setting, or is forced by `reduceEffects`, which also
 * sets `data-motion="reduced"` on <html> for the CSS `motion-reduce:` and `motion-safe:` variants.
 */
export function MotionProvider({ children, reduceEffects = false }: MotionProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    if (reduceEffects) root.dataset.motion = "reduced";
    else delete root.dataset.motion;
    return () => {
      delete root.dataset.motion;
    };
  }, [reduceEffects]);

  return (
    <ReduceEffectsContext.Provider value={reduceEffects}>
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion={reduceEffects ? "always" : "user"} transition={defaultTransition}>
          {children}
        </MotionConfig>
      </LazyMotion>
    </ReduceEffectsContext.Provider>
  );
}

/** True when movement should stop: the system asks for reduced motion or the app reduces effects. */
export function useReducedEffects(): boolean {
  const system = useReducedMotion();
  const app = useContext(ReduceEffectsContext);
  return app || system === true;
}
