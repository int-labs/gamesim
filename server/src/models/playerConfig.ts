import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Operator-authored PRESENTATION for the player client. One document per
 * simulation type.
 *
 * It deliberately carries NO game numbers. Costs, energy, bonuses and levels
 * all live on GlobalInput, and duplicating any of them here would give an
 * operator two places to set one value — the defect this config was trimmed
 * back to avoid.
 *
 * `config` is an open map, not an enumerated set of sections: its KEYS follow
 * the client's own section names (`vendors`, `candidates`, `marketingTeams`)
 * and each entry's `id` is the GlobalInput ITEM KEY it decorates. Adding a
 * section is a client concern, so the server does not gate the names.
 */
export interface PlayerConfigCaseStudy {
  title?:    string;
  brief?:    string;
  bestWhen?: string;
  watchOut?: string;
}

export interface PlayerConfigEntry {
  /** What this row decorates, by id. Which id depends on the SECTION: a
   *  GlobalInput item's `key` for vendors/candidates/marketingTeams/channels,
   *  a Product FIELD key for `drivers`, a Product `_id` for `products`. */
  id: string;
  /**
   * `drivers` ONLY — the PARENT this row's field key belongs to, a Product
   * `_id`. Added 2026-09-30.
   *
   * A field key alone is not unique enough to describe: one key means different
   * things on different notebooks, and `ProductField.direction` is already
   * per product, so the copy has to be too. A row with no `productId` is kept
   * as an unscoped FALLBACK for any product lacking its own — which is what
   * every row written before this date is.
   */
  productId?:    string | null;
  /** Full asset URL, or an ImageAsset id the read path resolves to one. */
  imageAssetId?: string | null;
  caseStudy?:    PlayerConfigCaseStudy | null;
  /** `drivers`: overrides the ProductField's label. `products`: overrides
   *  `Product.productName`. Blank means use the backend's own. */
  label?:        string | null;
  /** `drivers`: the driver row's tooltip. `products`: the one-line blurb. */
  hint?:         string | null;
  /** `products` only — the longer prose the Details tab shows. */
  description?:  string | null;
  /** `products` only — the Details tab's STRENGTHS bullets. */
  bestFor?:      string[] | null;
  /** `products` only — the Details tab's WEAKNESS bullets. */
  watchOut?:     string[] | null;
  /**
   * `products` only — the Segments tab: who buys this notebook and what they
   * care about, as operator-authored flavour and lore. Added 2026-09-30.
   *
   * HTML, stored and served VERBATIM — and ALREADY SANITISED when it arrives.
   *
   * The admin console sanitises on the way in (`sanitizeSegmentsHtml` in
   * `PlayerConfigPage`): `<object>`, `<embed>` and `<link>` removed, every `on*`
   * handler and every URL-bearing attribute stripped, and a document containing
   * `<script>` escaped whole so it displays as its own source. Owner's ruling
   * 2026-09-30 — the boundary is held explicitly on the admin side, and the
   * player client injects what it is given.
   *
   * THIS ENDPOINT DOES NOT ENFORCE THAT. A row written straight to the API
   * never passes the console, so the guarantee is only as strong as who can
   * reach it. If that stops being acceptable, sanitise in the controller — not
   * in the player client, which would be a second opinion about what is safe.
   */
  segments?:     string | null;
}

export interface PlayerConfigInterface extends Document {
  simulationTypeId: Types.ObjectId;
  config:           Record<string, PlayerConfigEntry[]>;
  createdAt:        Date;
  updatedAt:        Date;
}

const playerConfigSchema = new Schema<PlayerConfigInterface>(
  {
    simulationTypeId: {
      type:     Schema.Types.ObjectId,
      required: true,
      ref:      "SimulationType",
      unique:   true,
      index:    true,
    },
    // Mixed on purpose — see the note above. Section names are the client's.
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<PlayerConfigInterface>(
  "PlayerConfig",
  playerConfigSchema,
  "playerConfigs"
);
