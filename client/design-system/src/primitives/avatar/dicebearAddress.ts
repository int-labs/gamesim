import type { StyleDefinition } from "@dicebear/core";

// A DiceBear avatar's address and its styles, without DiceBear's drawing library: an Avatar
// reads an address as it renders, and loads the library (dicebear.ts) only to draw one.

/**
 * Avatars from DiceBear (dicebear.com), drawn in the browser by its library: choosing one makes no
 * request anywhere. What a team keeps is a DiceBear address, the form today's apps already save
 * in `avatarUrl`, so the server stores the same string and any screen can show it as an image:
 * `https://api.dicebear.com/10.x/<style>/svg?seed=Team%20Anakin&hairVariant=long01&hairColor=0e0e0e`.
 *
 * The styles players choose from. Each definition loads only when a builder needs it. Their
 * licences all allow commercial use; CC BY styles are credited beside the builder (the
 * definition's own meta names the artist and the licence).
 */
export const avatarStyles = {
  thumbs: { label: "Thumbs", load: () => import("@dicebear/styles/thumbs.json") },
  "fun-emoji": { label: "Fun Emoji", load: () => import("@dicebear/styles/fun-emoji.json") },
  adventurer: { label: "Adventurer", load: () => import("@dicebear/styles/adventurer.json") },
  avataaars: { label: "Avataaars", load: () => import("@dicebear/styles/avataaars.json") },
  "big-smile": { label: "Big Smile", load: () => import("@dicebear/styles/big-smile.json") },
  lorelei: { label: "Lorelei", load: () => import("@dicebear/styles/lorelei.json") },
  notionists: { label: "Notionists", load: () => import("@dicebear/styles/notionists.json") },
  micah: { label: "Micah", load: () => import("@dicebear/styles/micah.json") },
  personas: { label: "Personas", load: () => import("@dicebear/styles/personas.json") },
  "toon-head": { label: "Toon Head", load: () => import("@dicebear/styles/toon-head.json") },
  "pixel-art": { label: "Pixel Art", load: () => import("@dicebear/styles/pixel-art.json") },
  bottts: { label: "Bottts", load: () => import("@dicebear/styles/bottts.json") },
} as const satisfies Record<string, { label: string; load: () => Promise<{ default: unknown }> }>;

export type AvatarStyleKey = keyof typeof avatarStyles;

export const avatarStyleKeys = Object.keys(avatarStyles) as AvatarStyleKey[];

/** Today's apps draw a team without a picture in Thumbs, seeded with its name. */
export const defaultAvatarStyle: AvatarStyleKey = "thumbs";

/**
 * Background colours a player can put behind an avatar: today's fallback avatar's three, two warm
 * tints, the brand's lavender and the page's slate. Without one, the avatar is transparent.
 */
export const avatarBackgrounds = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "ddd8ff", "f1f5f9"] as const;

const definitions = new Map<AvatarStyleKey, Promise<StyleDefinition>>();

/** A style's definition, loaded once and shared. */
export function loadAvatarStyle(key: AvatarStyleKey): Promise<StyleDefinition> {
  let loading = definitions.get(key);
  if (!loading) {
    loading = avatarStyles[key].load().then((module) => module.default as unknown as StyleDefinition);
    definitions.set(key, loading);
  }
  return loading;
}

/** What makes an avatar: its style, its seed and the choices made on top of what the seed picks. */
export interface AvatarRecipe {
  style: AvatarStyleKey;
  seed: string;
  /** Option name to value, as DiceBear 10 names them: `hairVariant`, `glassesProbability`, `hairColor`, `backgroundColor`. */
  choices: Readonly<Record<string, string>>;
}

const API = "https://api.dicebear.com";
const VERSION = "10.x";
const CHOICE = /^(?:[A-Za-z0-9]+(?:Variant|Probability|Color))$/;

/** The address a team keeps: DiceBear's own form, its choices in a fixed order so equal avatars have equal addresses. */
export function avatarUrl(recipe: AvatarRecipe): string {
  const query = new URLSearchParams({ seed: recipe.seed });
  for (const key of Object.keys(recipe.choices).sort()) query.set(key, recipe.choices[key] ?? "");
  // URLSearchParams writes spaces as "+"; DiceBear's addresses use %20, as today's fallback.
  return `${API}/${VERSION}/${recipe.style}/svg?${query.toString().replace(/\+/g, "%20")}`;
}

function isStyleKey(value: string | undefined): value is AvatarStyleKey {
  return value !== undefined && Object.prototype.hasOwnProperty.call(avatarStyles, value);
}

/**
 * Reads a DiceBear address back into a recipe, for the builder to start from: a version 10
 * address keeps its choices; an older one (today's 9.x fallback) keeps its style and seed, as its
 * options are named differently. Anything else (an uploaded photo) is null.
 */
export function parseAvatarUrl(url: string | null | undefined): AvatarRecipe | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== API) return null;
  const [, version, style, format] = parsed.pathname.split("/");
  if (!isStyleKey(style) || format !== "svg" || !version?.endsWith(".x")) return null;
  const choices: Record<string, string> = {};
  if (version === VERSION) {
    for (const [key, value] of parsed.searchParams) if (CHOICE.test(key) && value) choices[key] = value;
  }
  return { style, seed: parsed.searchParams.get("seed") ?? "", choices };
}
