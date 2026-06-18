import mongoose, { Document, Schema, Types } from "mongoose";

export interface RefreshTokenInterface extends Document {
  userId:    Types.ObjectId;
  token:     string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<RefreshTokenInterface>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    token:     { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<RefreshTokenInterface>("RefreshToken", RefreshTokenSchema);