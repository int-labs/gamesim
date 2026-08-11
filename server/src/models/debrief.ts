import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * The end-of-simulation wrap-up: one debrief per simulation.
 *
 * GATING (enforced in the controller, not here): a team may only read this
 * when `status === "published"` AND its simulation is `Completed`. The debrief
 * is the reward for finishing — leaking it mid-run would hand teams the
 * facilitator's conclusions while they're still competing.
 *
 * Sections carry the same optional `teamId` targeting as RoundNote, so a
 * general debrief can include per-team addenda in one document.
 */

export interface DebriefSection {
  _id?: Types.ObjectId;
  title: string;
  /** Markdown. */
  body: string;
  imageAssetId: Types.ObjectId | null;
  /** null = every team sees this section. */
  teamId: Types.ObjectId | null;
  order: number;
}

export interface DebriefInterface extends Document {
  simulationId: Types.ObjectId;
  status: "draft" | "published";
  publishedAt: Date | null;
  heroImageAssetId: Types.ObjectId | null;
  title: string;
  intro: string;
  sections: DebriefSection[];
  createdAt: Date;
  updatedAt: Date;
}

// FLAT array of subdocuments — one level, same discipline as Team.members and
// Decision.inputs[].fields (see models/decisions.ts for what nesting cost us).
const sectionSchema = new Schema<DebriefSection>({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  body: { type: String, default: "", maxlength: 20000 },
  imageAssetId: { type: Schema.Types.ObjectId, ref: "ImageAsset", default: null },
  teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
  order: { type: Number, required: true, default: 0 },
});

const debriefSchema = new Schema<DebriefInterface>(
  {
    simulationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Simulation",
      unique: true,
      index: true,
    },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: { type: Date, default: null },
    heroImageAssetId: { type: Schema.Types.ObjectId, ref: "ImageAsset", default: null },
    title: { type: String, default: "Debrief", trim: true, maxlength: 160 },
    intro: { type: String, default: "", maxlength: 20000 },
    sections: { type: [sectionSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<DebriefInterface>("Debrief", debriefSchema, "debriefs");
