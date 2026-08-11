import { importEsmNamespace } from "../utils/esmImport";

/**
 * Avatar generation for teams and their members.
 *
 * DiceBear renders deterministically from (style, seed), so the same inputs
 * always give the same face. Most styles render SERVER-SIDE from the npm
 * package rather than pointing at api.dicebear.com, for three reasons:
 *   - no external runtime dependency in a classroom with flaky wifi
 *   - the art can't change under us if DiceBear ships a new style version
 *   - the result is a plain image URL, so generated avatars and uploaded
 *     photos look identical to every consumer
 *
 * The rendered SVG is inlined as a data URI — see generateAndStoreAvatar for
 * why that beats object storage for this particular kind of image.
 *
 * ── LICENSING ───────────────────────────────────────────────────────────────
 * Only attribution-free styles are offered. Every style below is either
 * CC0 1.0 (public domain) or explicitly "free for personal and commercial
 * use". DiceBear also ships `adventurer` and `funEmoji`, which are CC BY 4.0
 * and would oblige the console to carry visible attribution — deliberately
 * excluded. If you ever add them, add the credit line too.
 */

export type AvatarStyleId =
  | "critters"
  | "shapes"
  | "pixelArt"
  | "pixelArtNeutral"
  | "thumbs"
  | "notionists"
  | "identicon"
  | "initials"
  | "bottts";

export const AVATAR_STYLES: {
  id: AvatarStyleId;
  label: string;
  license: string;
  note: string;
}[] = [
  {
    id: "critters",
    label: "Critters",
    license: "CC0 1.0",
    note: "Friendly creatures. The platform default. Rendered via DiceBear's hosted API (see REMOTE_ONLY) because the npm collection stops at v9.",
  },
  {
    id: "shapes",
    label: "Shapes",
    license: "CC0 1.0",
    note: "Abstract geometry. The default for TEAMS — a team is not a person, and giving it a face made it indistinguishable from a roster member in every list.",
  },
  {
    id: "pixelArt",
    label: "Pixel Art",
    license: "CC0 1.0",
    note: "Matches the notebook sim's pixel aesthetic.",
  },
  { id: "pixelArtNeutral", label: "Pixel Art (neutral)", license: "CC0 1.0", note: "Flatter, calmer pixels." },
  { id: "thumbs", label: "Thumbs", license: "CC0 1.0", note: "Simple friendly shapes." },
  { id: "notionists", label: "Notionists", license: "CC0 1.0", note: "Hand-drawn people." },
  { id: "identicon", label: "Identicon", license: "CC0 1.0", note: "Abstract geometric pattern." },
  { id: "initials", label: "Initials", license: "CC0 1.0", note: "Just the person's letters on a colour block — no character art." },
  {
    id: "bottts",
    label: "Bottts",
    license: "Free for personal and commercial use",
    note: "Robots. By Pablo Stanley.",
  },
];

/**
 * The style everyone gets unless they pick another.
 *
 * Critters ships in DiceBear 10, but `@dicebear/collection` stops at 9.4.3 —
 * v10 restructured the JS monorepo and no longer publishes a bundled
 * collection, so `critters` cannot be imported. It IS served by the hosted
 * API at `10.x` (the `9.x` path 404s, which is what makes this easy to
 * mis-diagnose as "unavailable"). `renderAvatarSvg` fetches it once and inlines
 * the result, so the runtime behaviour matches every other style.
 */
export const DEFAULT_AVATAR_STYLE: AvatarStyleId = "critters";

/**
 * Teams get a different style on purpose.
 *
 * A team and a person rendered in the same character style are impossible to
 * tell apart in a list — the console shows both, often adjacent (a team row
 * with its members beneath it). `shapes` is abstract geometry, so the kind of
 * thing is legible before you read the label. It is also CC0 and ships in the
 * npm package, so unlike Critters it renders with no network call at all.
 *
 * An operator picking a style explicitly (PUT /teams/:id/avatar) still wins.
 */
export const DEFAULT_TEAM_AVATAR_STYLE: AvatarStyleId = "shapes";

/** Used when a REMOTE_ONLY style can't be fetched. Must be locally renderable. */
const LOCAL_FALLBACK_STYLE: AvatarStyleId = "bottts";

const STYLE_IDS = new Set(AVATAR_STYLES.map((s) => s.id));

export const isAvatarStyle = (v: unknown): v is AvatarStyleId =>
  typeof v === "string" && STYLE_IDS.has(v as AvatarStyleId);

/**
 * A palette for the generated backgrounds.
 *
 * Several DiceBear styles render on transparent, which lands as white on the
 * console's cards and reads as a missing image. Every generated avatar gets a
 * solid backdrop picked deterministically from the seed, so the same person
 * keeps the same colour and no two adjacent members clash by accident.
 */
const BACKDROPS = [
  "2E2D7E", // navy — brand
  "525CA9", // periwinkle
  "D80E68", // pink-600
  "0E8A5F", // success green
  "B3760A", // amber
  "3A3990", // navy-600
  "7A6750", // warm neutral
  "4A48A8", // navy-500
];

const backdropFor = (seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return BACKDROPS[h % BACKDROPS.length];
};

/**
 * Styles that only exist on DiceBear's hosted API, not in the npm package.
 *
 * `critters` is published in DiceBear 10 but `@dicebear/collection` stops at
 * 9.4.3 — the v10 JS monorepo dropped the bundled collection entirely, so the
 * only way to render it is over HTTP. We fetch ONCE, at avatar-creation time,
 * and inline the result as a data URI: the classroom still never touches the
 * network to display an avatar, and the art can't change under us afterwards.
 */
const REMOTE_ONLY: Partial<Record<AvatarStyleId, string>> = {
  critters: "10.x",
};

async function fetchRemoteAvatarSvg(
  style: AvatarStyleId,
  seed: string,
  apiVersion: string
): Promise<string> {
  const url =
    `https://api.dicebear.com/${apiVersion}/${style}/svg` +
    `?seed=${encodeURIComponent(seed)}&size=256`;

  // The hosted renderer cold-starts; a short timeout would fail the first call
  // of the day and make the style look broken.
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`DiceBear returned ${res.status} for "${style}".`);
  return res.text();
}

/**
 * Paint the backdrop ourselves instead of asking DiceBear for one.
 *
 * `?backgroundColor=` is honoured by the v9 styles but not by v10 `critters`,
 * which returns the art on transparent regardless — and transparent lands as
 * white on the console's cards, which is indistinguishable from a broken
 * image. Injecting a full-bleed rect as the first child of the root works for
 * every style, local or remote, and can't drift when the API changes.
 */
function withBackdrop(svg: string, seed: string): string {
  // Already has an explicit full-size fill? Leave it alone.
  if (/<rect[^>]*width="100%?"[^>]*fill="#[0-9a-fA-F]{3,6}"/.test(svg)) return svg;

  const open = svg.match(/<svg[^>]*>/)?.[0];
  if (!open) return svg;

  const viewBox = open.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 100 100";
  const [minX, minY, w, h] = viewBox.split(/\s+/).map(Number);
  const rect =
    `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#${backdropFor(seed)}"/>`;

  return svg.replace(open, `${open}${rect}`);
}

export async function renderAvatarSvg(style: AvatarStyleId, seed: string): Promise<string> {
  const remote = REMOTE_ONLY[style];
  if (remote) {
    try {
      return withBackdrop(await fetchRemoteAvatarSvg(style, seed, remote), seed);
    } catch (err) {
      // Never fail avatar creation over a third party being slow — fall back to
      // a locally-rendered style rather than leaving a member with no face.
      console.warn(`[avatars] remote style "${style}" unavailable, falling back:`, err);
      return renderAvatarSvg(LOCAL_FALLBACK_STYLE, seed);
    }
  }

  const [core, collection] = await Promise.all([
    importEsmNamespace<any>("@dicebear/core"),
    importEsmNamespace<any>("@dicebear/collection"),
  ]);

  const styleImpl = collection[style];
  if (!styleImpl) throw new Error(`Unknown avatar style "${style}".`);

  const svg = core.createAvatar(styleImpl, { seed, size: 256 }).toString();
  // Same backdrop treatment as the remote path, so every style looks alike.
  return withBackdrop(svg, seed);
}

export interface StoredAvatar {
  kind: "dicebear";
  style: AvatarStyleId;
  seed: string;
  imageAssetId: string | null;
  url: string;
}

/**
 * Renders an avatar and returns the shape `Team.avatar` / `TeamMember.avatar`
 * expects.
 *
 * ── WHY A DATA URI, NOT OBJECT STORAGE ──────────────────────────────────────
 * The original plan pushed these through the ImageAsset → Supabase pipeline.
 * A generated avatar is a ~1.5 KB deterministic SVG that can be rebuilt at any
 * time from (style, seed) — both of which we store — so a remote round-trip
 * buys nothing and costs an external dependency on every render. Inlining it
 * means avatars work with no network, no credentials and no storage bill, and
 * a team's face can never 404.
 *
 * Uploaded PHOTOS are the opposite case (large, not regenerable) and still go
 * to object storage via POST /image-assets.
 */
export async function generateAndStoreAvatar(
  style: AvatarStyleId,
  seed: string,
  _label?: string
): Promise<StoredAvatar> {
  const svg = await renderAvatarSvg(style, seed);

  // base64 rather than percent-encoding: SVG is full of characters that would
  // otherwise need escaping, and base64 survives every transport unchanged.
  const url = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return { kind: "dicebear", style, seed, imageAssetId: null, url };
}
