// Motion's animation features, loaded on demand by MotionProvider (LazyMotion), so the first
// paint does not wait for them. Layout animations (domMax) are loaded only by the screens that
// reorder lists.
export { domAnimation as default } from "motion/react";
