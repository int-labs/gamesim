import mongoose, { Document, Schema, Types } from "mongoose";

/** Facilitator notes on a round: free-standing commentary, or a debrief chart's description. */

export interface RoundNoteInterface extends Document {
  simulationId: Types.ObjectId;
  roundNumber: number;
  teamId: Types.ObjectId | null;
  /** The `DebriefChart` this note describes, by `_id`. `null` is a free-standing note. */
  chartId: Types.ObjectId | null;
  /** !important which instance, when `scope` is `each`. Keyed by the pair, never `_id` alone. */
  productId: Types.ObjectId | null;
  title: string;
  /** Markdown. Rendered as plain text until a renderer is wired in. */
  body: string;
  imageAssetId: Types.ObjectId | null;
  authorUserId: Types.ObjectId | null;
  /** Pinned notes sort first, regardless of age. */
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roundNoteSchema = new Schema<RoundNoteInterface>(
  {
    simulationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Simulation",
      index: true,
    },
    roundNumber: { type: Number, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    chartId:   { type: Schema.Types.ObjectId, ref: "DebriefChart", default: null },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: "", maxlength: 5000 },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "ImageAsset", default: null },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roundNoteSchema.index({ simulationId: 1, roundNumber: 1, teamId: 1 });

export default mongoose.model<RoundNoteInterface>("RoundNote", roundNoteSchema, "roundNotes");
