import { Avatar as DiceBearAvatar, Style, type StyleDefinition } from "@dicebear/core";
import { avatarBackgrounds, type AvatarRecipe } from "./dicebearAddress";

// The addresses, the styles and their loading live in dicebearAddress.ts, without the drawing
// library; they are shared from here too.
export * from "./dicebearAddress";

/** A part of an avatar a player can choose (hair, eyes, glasses) and its variants. */
export interface AvatarPart {
  key: string;
  variants: string[];
  /** The part may be left out (glasses, earrings): the builder offers None. */
  optional: boolean;
}

/** A colour a player can choose (skin, hair) and the style's own palette for it, without "#". */
export interface AvatarColour {
  key: string;
  values: string[];
}

/**
 * The parts with a choice to make: more than one variant; aliases of another part follow it. The
 * biggest choices come first (hair, mouth, eyes before details), as a player looks for them first.
 */
export function avatarParts(definition: StyleDefinition): AvatarPart[] {
  const parts = Object.entries(definition.components ?? {}).flatMap(([key, component]) => {
    if ("extends" in component) return [];
    const variants = Object.keys(component.variants);
    if (variants.length < 2) return [];
    return [{ key, variants, optional: component.probability !== undefined && component.probability < 100 }];
  });
  return parts.sort((a, b) => b.variants.length - a.variants.length);
}

const hex = (value: string) => value.replace(/^#/, "").toLowerCase();

/**
 * The colours with a choice to make: a palette of more than one. The background is left to
 * avatarBackgroundsOf, which the builder offers in its own tab.
 */
export function avatarColours(definition: StyleDefinition): AvatarColour[] {
  return Object.entries(definition.colors ?? {}).flatMap(([key, colour]) => {
    if (key === "background") return [];
    const values = [...new Set(colour.values.map(hex))];
    return values.length < 2 ? [] : [{ key, values }];
  });
}

/**
 * The backgrounds a style can take: its own palette first, where the background is part of its
 * drawing (Thumbs' shape sits on it, Fun Emoji's face is it), then avatarBackgrounds. `none` is
 * whether it may be left out: only where the style has no palette of its own.
 */
export function avatarBackgroundsOf(definition: StyleDefinition): { values: string[]; none: boolean } {
  const own = (definition.colors?.background?.values ?? []).map(hex);
  return { values: [...new Set([...own, ...avatarBackgrounds])], none: own.length === 0 };
}

const styles = new WeakMap<StyleDefinition, Style<StyleDefinition>>();

/**
 * The avatar as an image address (an SVG data URI), drawn here. `override` tries a choice on top
 * of the recipe's, for a builder's previews.
 */
export function renderAvatar(definition: StyleDefinition, recipe: AvatarRecipe, override: Record<string, string> = {}): string {
  let style = styles.get(definition);
  if (!style) {
    style = new Style(definition);
    styles.set(definition, style);
  }
  const options: Record<string, string | number> = { seed: recipe.seed };
  for (const [key, value] of Object.entries({ ...recipe.choices, ...override })) {
    options[key] = key.endsWith("Probability") ? Number(value) : value;
  }
  return new DiceBearAvatar(style, options).toDataUri();
}
