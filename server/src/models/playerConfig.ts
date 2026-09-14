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
