import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import { useEffect, useState } from "react";
import { tv, type VariantProps } from "../../lib/tv";
import { tokens } from "../../tokens";
import { loadAvatarStyle, parseAvatarUrl } from "./dicebearAddress";

/** How long an image may take before the initials show instead. */
const FALLBACK_DELAY = Number.parseFloat(tokens.component.avatar["fallback-delay"]);

/**
 * A team's or a person's picture in a circle (Figma avatar07: the image alone, no ring and no
 * background of its own, 46 px on the team cards). Without a picture, or while one fails to load,
 * the name's initials show on brand indigo, as today's Admin team cards show the team's initial
 * (white on indigo reads 13:1).
 */
export const avatarVariants = tv({
  slots: {
    root: "inline-flex shrink-0 overflow-hidden rounded-full select-none",
    image: "size-full object-cover transition-opacity duration-fast ease-standard data-starting-style:opacity-0 motion-reduce:transition-none",
    fallback: "flex size-full items-center justify-center bg-accent text-fg-on-accent",
  },
  variants: {
    // Poppins SemiBold as the KPI values and card titles; at 32 px, Source Sans reads better small.
    size: {
      sm: { root: "size-(--avatar-size-sm)", fallback: "type-caption font-semibold" },
      md: { root: "size-(--avatar-size-md)", fallback: "type-kpi-value" },
      lg: { root: "size-(--avatar-size-lg)", fallback: "type-heading" },
      /** The profile photo in the team's Edit Team Details dialog. */
      xl: { root: "size-(--avatar-size-xl)", fallback: "type-heading" },
    },
  },
  defaultVariants: { size: "lg" },
});

// A letter or digit, but not a Thai vowel written before its consonant (เ แ โ ใ ไ): the initial of
// ใจดี is จ.
const INITIAL = /[\p{L}\p{N}]/u;
const THAI_LEADING_VOWEL = /[เ-ไ]/u;

/** The first letter of a word, as whole characters (not UTF-16 halves); the word's first character if it has no letter. */
function initialOf(word: string | undefined) {
  if (!word) return "";
  const characters = Array.from(word);
  return characters.find((character) => INITIAL.test(character) && !THAI_LEADING_VOWEL.test(character)) ?? characters[0] ?? "";
}

/** The first letters of a name's first and last words: "Team Anakin" is TA, "Rido Hendrawan" RH, "Novabank" N. */
export function initialsOf(name: string, locale?: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return (initialOf(words[0]) + initialOf(last)).toLocaleUpperCase(locale);
}

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  /** Whose avatar it is: the initials come from it. */
  name: string;
  /** The picture. Without one, or while it fails to load, the initials show. */
  src?: string | null;
  /**
   * What assistive technology hears, when nothing next to the avatar names its owner. By
   * default the avatar is decorative: the name is written beside it.
   */
  alt?: string;
  /** For the initials' letter case (Turkish i, for example). */
  locale?: string;
  className?: string;
}

/**
 * A DiceBear 10 address (what the avatar builder keeps) is drawn here from its recipe, so showing
 * a team makes no request to DiceBear; any other picture (a photo, an older DiceBear address) is
 * loaded as it is. DiceBear's drawing library loads with the first avatar it draws, as its style
 * does, so a screen that shows an avatar doesn't carry it from the start.
 */
function useDrawnSrc(src: string | null | undefined) {
  const recipe = src?.includes("/10.x/") ? parseAvatarUrl(src) : null;
  const [drawn, setDrawn] = useState<{ src: string; image: string } | null>(null);
  useEffect(() => {
    if (!recipe || !src) return;
    let live = true;
    void Promise.all([import("./dicebear"), loadAvatarStyle(recipe.style)]).then(([{ renderAvatar }, definition]) => {
      if (live) setDrawn({ src, image: renderAvatar(definition, recipe) });
    });
    return () => {
      live = false;
    };
    // The recipe is read from src.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  if (!recipe) return src;
  return drawn && drawn.src === src ? drawn.image : undefined;
}

export function Avatar({ name, src: given, alt, size, locale, className }: AvatarProps) {
  const slots = avatarVariants({ size });
  const src = useDrawnSrc(given);
  const labelled = alt !== undefined && alt !== "";
  return (
    <BaseAvatar.Root
      role={labelled ? "img" : undefined}
      aria-label={labelled ? alt : undefined}
      aria-hidden={labelled ? undefined : true}
      className={slots.root({ className })}
    >
      {src ? <BaseAvatar.Image src={src} alt="" className={slots.image()} /> : null}
      {/* A picture gets a moment to load before its initials show, so a quick one does not flash them. */}
      <BaseAvatar.Fallback delay={given ? FALLBACK_DELAY : 0} className={slots.fallback()}>
        {initialsOf(name, locale)}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
