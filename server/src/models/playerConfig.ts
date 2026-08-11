import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * PlayerConfig — the operator-editable catalog behind the notebook player.
 *
 * Everything the player renders (genres, the production spec axes, channels,
 * vendors, hiring, marketing, scenarios, add-ons, segments, archetypes, events,
 * upgrades, insight questions, tunable constants, copy and image slots) lives
 * here so it can be edited without a frontend deploy. The player keeps its
 * bundled tables as a permanent fallback and merges this on top, so a missing
 * or partial document is a supported state, not an error.
 *
 * ── Draft vs published ──────────────────────────────────────────────────────
 * Edits land on the live section fields (the DRAFT). `GET` serves
 * `publishedSnapshot` — a frozen deep copy taken by POST /publish. A classroom
 * mid-round therefore never sees half-finished edits, and publishing is a
 * single deliberate act.
 *
 * ── Why the sections are Mixed ──────────────────────────────────────────────
 * Deliberate. Mongoose subdocument arrays are what silently corrupted
 * `Decision.inputs[].fields` (see models/decisions.ts) by wrapping every entry
 * in its own array, and these catalogs are far more deeply nested than that
 * was. Shape is instead enforced by zod at the controller boundary
 * (validators/playerConfig.ts), which validates more precisely than Mongoose
 * can and produces per-field error messages the console can render inline.
 *
 * ── Images ──────────────────────────────────────────────────────────────────
 * Every entry that renders art carries BOTH `imageAssetId` (an uploaded
 * ImageAsset) and `imagePath` — which holds a KEY into the player's own asset
 * map (`addons.integrated.charm_bear`), not a URL. The player's assets.ts
 * URL-encodes each path segment because the sprite folders contain spaces, `&`
 * and em-dashes, so it stays the single owner of URL resolution.
 *
 * Resolution order in the player: imageAssetId URL → imagePath key → the
 * bundled default. That's what lets the DB be seeded without uploading ~80
 * sprites up front, and lets operators replace art one piece at a time.
 */

/** Sections that can be PATCHed individually. Order is the console's rail order. */
export const PLAYER_CONFIG_SECTIONS = [
  // V3 (FinLit) economy
  "genres",
  "productionOptions",
  "channelMeta",
  "channelsByGenre",
  "vendors",
  "hiringCandidates",
  "marketingTeams",
  "scenarios",
  "constants",
  // V2 catalogs
  "addOns",
  "addOnCategories",
  "segments",
  "channelsV2",
  "archetypes",
  "events",
  "upgrades",
  "insights",
  // Presentation
  "copy",
  "images",
] as const;

export type PlayerConfigSection = (typeof PLAYER_CONFIG_SECTIONS)[number];

export interface PlayerConfigInterface extends Document {
  simulationTypeId: Types.ObjectId;
  version: number;
  status: "draft" | "published";
  publishedAt: Date | null;
  publishedSnapshot: Record<string, unknown> | null;
  /** Free-text note shown in the console's version history. */
  publishNote: string | null;

  genres: unknown[];
  productionOptions: Record<string, unknown[]>;
  channelMeta: unknown[];
  channelsByGenre: unknown[];
  vendors: unknown[];
  hiringCandidates: unknown[];
  marketingTeams: unknown[];
  scenarios: unknown[];
  constants: Record<string, unknown>;

  addOns: unknown[];
  addOnCategories: unknown[];
  segments: unknown[];
  channelsV2: unknown[];
  archetypes: unknown[];
  events: unknown[];
  upgrades: unknown[];
  insights: unknown[];

  copy: Record<string, string>;
  images: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const arr = { type: Schema.Types.Mixed, default: () => [] };
const obj = { type: Schema.Types.Mixed, default: () => ({}) };

const playerConfigSchema = new Schema<PlayerConfigInterface>(
  {
    simulationTypeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "SimulationType",
      unique: true,
      index: true,
    },
    version: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: { type: Date, default: null },
    publishedSnapshot: { type: Schema.Types.Mixed, default: null },
    publishNote: { type: String, default: null },

    genres: arr,
    productionOptions: obj,
    channelMeta: arr,
    channelsByGenre: arr,
    vendors: arr,
    hiringCandidates: arr,
    marketingTeams: arr,
    scenarios: arr,
    constants: obj,

    addOns: arr,
    addOnCategories: arr,
    segments: arr,
    channelsV2: arr,
    archetypes: arr,
    events: arr,
    upgrades: arr,
    insights: arr,

    copy: obj,
    images: obj,
  },
  { timestamps: true, minimize: false }
);

/** The draft state, as the shape `publishedSnapshot` stores and `GET` serves. */
export function toSnapshot(doc: PlayerConfigInterface): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of PLAYER_CONFIG_SECTIONS) {
    out[section] = (doc as any)[section];
  }
  return out;
}

export default mongoose.model<PlayerConfigInterface>(
  "PlayerConfig",
  playerConfigSchema,
  "playerConfigs"
);
