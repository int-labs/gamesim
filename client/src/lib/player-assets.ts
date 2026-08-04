/**
 * Resolving art that lives in the PLAYER app, from the console.
 *
 * ── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────
 * The player resolves a notebook's cover by filename convention:
 *
 *   // notebook-pixel-sim/src/engine/finlit/core/config/genres.ts
 *   genreArt = (id) => GENRES.find(g => g.id === id)?.imgPath
 *                      ?? `/img/notebooks/${encodeURIComponent(id)}.png`
 *
 * That is a good design over there — dropping `indie.png` into
 * `assets/img/notebooks/` publishes a new notebook with no code change, which
 * is why the seeded genres correctly carry `imagePath: null`.
 *
 * But the convention is relative to the PLAYER's origin, and the console runs
 * somewhere else entirely. So every product row rendered a generic package icon
 * while the real cover art sat one origin away. This module is the join.
 *
 * ── RESOLUTION ORDER ────────────────────────────────────────────────────────
 * Identical to the player's, so the console never shows something the player
 * wouldn't:
 *
 *   1. `imageAssetId` — an operator upload. Already an absolute URL.
 *   2. `imagePath`    — a path under the player's public root.
 *   3. the notebook convention, when we know the genre id.
 *   4. nothing; the caller falls back to an icon.
 */

/**
 * Where the player app is served from.
 *
 * `sim-preview` used to hardcode `http://localhost:5173`, which meant the
 * Player Preview link was broken in every deployment. One setting, used by
 * both that link and the art below.
 */
export const PLAYER_ORIGIN: string = (
  (import.meta as any).env?.VITE_PLAYER_URL ?? "http://localhost:5173"
).replace(/\/$/, "");

/** An absolute URL for a path under the player's public root. */
export const playerUrl = (path: string): string =>
  `${PLAYER_ORIGIN}/${String(path).replace(/^\//, "")}`;

/**
 * Cover art for a notebook genre, by the player's own convention.
 *
 * The id is encoded because genre ids come from operator data and may contain
 * characters that need escaping — the same reason the player encodes them.
 */
export const genreArtUrl = (genreId: string): string =>
  playerUrl(`img/notebooks/${encodeURIComponent(genreId)}.png`);

export interface ArtSource {
  /** An uploaded ImageAsset's URL, when the operator has replaced the art. */
  imageAssetId?: string | null;
  /** A path under the player's public root, or a key into its asset map. */
  imagePath?: string | null;
}

/**
 * Resolve art for a row that carries the standard image fields.
 *
 * `genreId` is the last resort so a product that has never had art configured
 * still shows its notebook — which is the whole point, since the bundled game
 * ships the art but stores no reference to it.
 */
export function resolveArt(row: ArtSource | null | undefined, genreId?: string | null): string | undefined {
  if (!row && !genreId) return undefined;

  // An upload is stored as a full URL (or a data URI for generated images).
  const uploaded = row?.imageAssetId;
  if (typeof uploaded === "string" && /^(https?:|data:)/.test(uploaded)) return uploaded;

  const path = row?.imagePath;
  if (typeof path === "string" && path.trim()) {
    return /^(https?:|data:)/.test(path) ? path : playerUrl(path);
  }

  return genreId ? genreArtUrl(genreId) : undefined;
}

/**
 * Best-effort genre id for a product.
 *
 * There is deliberately no `genreId` column on `Product`: a product belongs to
 * the generic engine and genres belong to one particular game, so joining them
 * in the schema would leak the notebook sim into every future simulation type.
 * Matching on the name is good enough for a picture, and returns undefined —
 * not a wrong image — when it doesn't match.
 */
export function guessGenreId(productName: string | undefined, genreIds: string[]): string | undefined {
  if (!productName) return undefined;
  const slug = productName.toLowerCase();
  return genreIds.find((id) => slug.includes(id.toLowerCase()));
}
