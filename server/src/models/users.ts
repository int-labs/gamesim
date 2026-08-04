import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * A staff member's face and display name.
 *
 * Shape-identical to `TeamAvatar` so one renderer serves both, and generated
 * the same way (see services/avatars.ts): `kind` + `style` + `seed` is the
 * complete description and `url` is derived, never supplied by a caller.
 */
export interface UserAvatar {
  kind:          "dicebear" | "upload";
  style?:        string;
  seed?:         string;
  imageAssetId?: string | null;
  url:           string;
}

export interface UserInterface extends Document {
  email?:        string;
  /** Optional display name; the console falls back to the email's local part. */
  name?:         string;
  password:      string;
  role:          "admin" | "operator" | "client" | "team";
  teamId?:       Types.ObjectId;
  simulationId?: Types.ObjectId;
  passkey?:      string;
  avatar?:       UserAvatar | null;
  createdAt:     Date;
  updatedAt:     Date;
}

const UserSchema = new Schema<UserInterface>(
  {
    email:        { type: String, unique: true, sparse: true },
    name:         { type: String, default: null },
    password:     { type: String, required: true },
    role:         { type: String, enum: ["admin", "operator", "client", "team"], required: true },
    teamId:       { type: Schema.Types.ObjectId, ref: "Team" },
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation" },
    passkey:      { type: String },
    // Additive and optional: every user written before this existed keeps
    // working, and the console falls back to initials when it is absent.
    avatar: {
      type: new Schema(
        {
          kind:         { type: String, enum: ["dicebear", "upload"], required: true },
          style:        { type: String },
          seed:         { type: String },
          imageAssetId: { type: Schema.Types.ObjectId, ref: "ImageAsset", default: null },
          url:          { type: String, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index — passkey unique per simulation
UserSchema.index({ simulationId: 1, passkey: 1 }, { unique: true, sparse: true });

// Pre-save hook — validate passkey uniqueness within simulationId scope
UserSchema.pre("save", async function (next) {
  if (!this.passkey || !this.simulationId) return next();
  if (!this.isNew && !this.isModified("passkey")) return next();

  try {
    const existing = await mongoose.models.User.findOne({
      simulationId: this.simulationId,
      passkey:      this.passkey,
      _id:          { $ne: this._id },
    });

    if (existing) {
      return next(new Error(`Passkey "${this.passkey}" is already in use for this simulation.`));
    }

    next();
  } catch (err: any) {
    next(err);
  }
});

export default mongoose.model<UserInterface>("User", UserSchema);