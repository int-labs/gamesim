/**
 * The ✕ mark used by every dismissible surface (modal, drawer, tip, bubble).
 *
 * It is drawn rather than typed. Every close button in the app used to render a
 * literal "✕" inside a `<span className="eyebrow eyebrow-sm">`, and `.eyebrow`
 * sets `color: var(--c-text-2)` — a typography class that also paints. That had
 * two consequences everywhere it was used:
 *
 *   1. On a dark header the hardcoded dark brown beat the button's own
 *      `text-cream-100`, giving 1.03:1 contrast: a close button you cannot see.
 *   2. The parent's hover colour never applied, because the span kept
 *      overriding it — so `hover:text-text` on the button did nothing.
 *
 * Drawing it on `currentColor` fixes both: the mark inherits whatever the
 * button sets, including hover and disabled states, and it rasterises the same
 * way regardless of which font happens to carry U+2715.
 */
export function CloseX({ size = 12 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="square"
      className="shrink-0"
    >
      <path d="M2 2 L10 10 M10 2 L2 10" />
    </svg>
  );
}
