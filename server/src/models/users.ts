import mongoose, { Document, Schema, Types } from "mongoose";

export interface UserInterface extends Document {
  email?:        string;
  password:      string;
  role:          "admin" | "operator" | "client" | "team";
  teamId?:       Types.ObjectId;
  simulationId?: Types.ObjectId;
  passkey?:      string;
  createdAt:     Date;
  updatedAt:     Date;
}

const UserSchema = new Schema<UserInterface>(
  {
    email:        { type: String, unique: true, sparse: true },
    password:     { type: String, required: true },
    role:         { type: String, enum: ["admin", "operator", "client", "team"], required: true },
    teamId:       { type: Schema.Types.ObjectId, ref: "Team" },
    simulationId: { type: Schema.Types.ObjectId, ref: "Simulation" },
    passkey:      { type: String },
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