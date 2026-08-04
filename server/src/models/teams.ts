import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * A Team is the competing entity the market model scores. Its LOGIN is a
 * separate `User` document with `role: "team"` carrying the passkey — see
 * userControllers.createUser. Don't conflate the two.
 *
 * `avatar` and `members` are additive and optional: every document written
 * before they existed still loads, and every existing consumer (passkey login,
 * results, projections) is untouched by their presence.
 */

export interface TeamAvatar {
  /** "dicebear" = generated from (style, seed); "upload" = an operator photo. */
  kind: "dicebear" | "upload";
  style?: string | null;
  seed?: string | null;
  /** ImageAsset._id when the art was stored through the asset pipeline. */
  imageAssetId?: Types.ObjectId | null;
  /** Denormalised so rendering never needs a second lookup. */
  url: string;
}

export interface TeamMember {
  _id?: Types.ObjectId;
  name: string;
  /** Free label — "CEO", "Head of Ops". Display only, never scored. */
  role?: string | null;
  avatar?: TeamAvatar | null;
  order: number;
}

export interface TeamInterface extends Document {
  simulationId: Types.ObjectId;
  teamName:     string;
  teamLeader?:  string;
  score?:       number;
  marketShare?: number;
  avatar?:      TeamAvatar | null;
  members:      TeamMember[];
  createdAt:    Date;
  updatedAt:    Date;
}

const AvatarSchema = new Schema<TeamAvatar>(
  {
    kind:         { type: String, enum: ["dicebear", "upload"], required: true },
    style:        { type: String, default: null },
    seed:         { type: String, default: null },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "ImageAsset", default: null },
    url:          { type: String, required: true },
  },
  { _id: false }
);

// NOTE: a FLAT array of member subdocuments. The extra `[]` that once wrapped
// every entry in its own array is exactly what broke Decision.inputs[].fields
// (see models/decisions.ts) — keep this single-level.
const MemberSchema = new Schema<TeamMember>({
  name:   { type: String, required: true, trim: true, maxlength: 60 },
  role:   { type: String, default: null, trim: true, maxlength: 60 },
  avatar: { type: AvatarSchema, default: null },
  order:  { type: Number, required: true, default: 0 },
});

const TeamSchema = new Schema<TeamInterface>(
  {
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation", required: true },
    teamName:     { type: String, required: true },
    teamLeader:   { type: String },
    score:        { type: Number },
    marketShare:  { type: Number },
    avatar:       { type: AvatarSchema, default: null },
    members:      { type: [MemberSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<TeamInterface>("Team", TeamSchema, "teams");
