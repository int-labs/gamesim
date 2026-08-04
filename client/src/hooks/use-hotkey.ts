import { useEffect, useRef } from "react";

type Handler = (e: KeyboardEvent) => void;

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    node.isContentEditable === true
  );
}

/**
 * Single-key / modifier hotkey.
 *   useHotkey("k", fn, { meta: true })   → ⌘K / Ctrl-K
 *   useHotkey("/", fn)                   → only when not already typing
 */
export function useHotkey(
  key: string,
  handler: Handler,
  opts: { meta?: boolean; shift?: boolean; allowInInput?: boolean; enabled?: boolean } = {}
) {
  const saved = useRef(handler);
  saved.current = handler;

  const { meta = false, shift = false, allowInInput = false, enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (meta && !(e.metaKey || e.ctrlKey)) return;
      if (!meta && (e.metaKey || e.ctrlKey)) return;
      if (shift && !e.shiftKey) return;
      if (!allowInInput && isTypingTarget(e.target)) return;
      e.preventDefault();
      saved.current(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, meta, shift, allowInInput, enabled]);
}

/** Sequence hotkeys like "g d" (go dashboard). 900 ms window between keys. */
export function useSequenceHotkey(sequence: string, handler: () => void, enabled = true) {
  const saved = useRef(handler);
  saved.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const keys = sequence.toLowerCase().split(" ");
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reset = () => {
      index = 0;
      if (timer) clearTimeout(timer);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return reset();
      if (e.key.toLowerCase() !== keys[index]) return reset();
      index += 1;
      if (timer) clearTimeout(timer);
      if (index === keys.length) {
        reset();
        saved.current();
        return;
      }
      timer = setTimeout(reset, 900);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [sequence, enabled]);
}
