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
  /** The GlobalInput item's `key` this decorates. */
  id: string;
  /** Full asset URL, or an ImageAsset id the read path resolves to one. */
  imageAssetId?: string | null;
  caseStudy?:    PlayerConfigCaseStudy | null;
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
