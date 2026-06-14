import mongoose from "mongoose";

class CustomError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
}

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true },
    name: { type: String },
    password: { type: String, default: null },
    role: {
      type: String,
      // admin is superadmin
      // operator is Int Labs team but can only manage simulations
      // client is a user of the app that can access their own simulations
      // team is a user of the app that is limited to playing a single simulation
      enum: ["admin", "team", "operator", "client"],
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null, // Only for team users
    },
    passkey: { type: String, unique: true, default: null }, // For temporary team login
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("passkey")) {
    const existing = await mongoose.models.User.findOne({
      passkey: this.passkey,
    });

    if (existing && existing._id.toString() !== this._id.toString()) {
      const error = new CustomError(
        `The value "${this.passkey}" is already in use.`,
        "PASSKEY_IN_USE"
      );
      throw error;
    }
  }
  next();
});

userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  if (update && typeof update === "object" && !Array.isArray(update)) {
    const existing = await mongoose.models.User.findOne({
      passkey: update.passkey,
    });

    if (
      existing &&
      existing._id.toString() !== this.getQuery()._id.toString()
    ) {
      const error = new CustomError(
        `The value "${update.passkey}" is already in use.`,
        "PASSKEY_IN_USE"
      );
      throw error;
    }
  }
  next();
});

const User = mongoose.model("User", userSchema, "users");

export default User;
