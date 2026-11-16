import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { tv } from "../../lib/tv";
import { RoundStartingDrawing } from "./RoundStartingDrawing";

/**
 * The round's interstitial (Figma 2546:398410): the whole screen in slate 100 while the next round
 * opens, Figma's drawing at 236 px (a game can bring its own), and 24 px under it the words in
 * Poppins Regular 48, gray 900
 * (Figma sets them in Inter, which the design system leaves out of its screens), in a 600 px
 * column. It fades in and out. It holds the page's focus as a dialog does, named by its words, and
 * nothing closes it: the game takes it away when the round is ready.
 */
export const roundStartingVariants = tv({
  slots: {
    popup: [
      "fixed inset-0 z-modal flex flex-col items-center justify-center gap-6 overflow-y-auto bg-surface-page p-4",
      "scrim outline-none motion-reduce:transition-none",
    ],
    illustration: "flex size-(--round-starting-illustration-size) shrink-0 items-center justify-center *:size-full",
    title: "max-w-(--round-starting-width) text-center type-interstitial text-fg-primary",
  },
});

export interface RoundStartingProps {
  /** Controlled: the game shows it when a round opens and takes it away when the page is ready. */
  open: boolean;
  /** "New round is starting!". */
  title: ReactNode;
  /** A game's own drawing, an SVG that fills a 236 px square; Figma's figures by default. */
  illustration?: ReactNode;
}

/** Covers the screen while the next round opens, so no one decides on a page about to change. */
export function RoundStarting({ open, title, illustration = <RoundStartingDrawing /> }: RoundStartingProps) {
  const slots = roundStartingVariants();
  return (
    // Escape and outside presses change nothing: the game decides when it goes.
    <BaseDialog.Root open={open}>
      <BaseDialog.Portal data-ds-root="">
        <BaseDialog.Popup className={slots.popup()}>
          <div aria-hidden className={slots.illustration()}>
            {illustration}
          </div>
          <BaseDialog.Title className={slots.title()}>{title}</BaseDialog.Title>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
