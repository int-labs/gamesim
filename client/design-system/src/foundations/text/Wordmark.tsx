import type { HTMLAttributes } from "react";
import { tv, type VariantProps } from "../../lib/tv";

export const wordmarkVariants = tv({
  base: "inline-block w-fit bg-gradient-wordmark bg-clip-text whitespace-nowrap text-transparent",
  variants: {
    size: {
      /** "intlabs.", one word, always in Poppins Black: 32 px (the Admin, on every screen size). */
      admin: "type-wordmark",
      /** "LIFE Bank.": Poppins ExtraBold 28 (the player sidebar). */
      player: "type-wordmark-player",
    },
  },
  defaultVariants: { size: "admin" },
});

export interface WordmarkProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof wordmarkVariants> {}

/** The brand name painted with the pink-to-blue gradient. Not a heading: the page title is. */
export function Wordmark({ size, className, ...props }: WordmarkProps) {
  return <span className={wordmarkVariants({ size, className })} {...props} />;
}
