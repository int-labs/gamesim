import mongoose, { Document, Schema } from "mongoose";

export interface ImageAssetInterface extends Document {
  image_id:  string;
  filename:  string;
  url:       string;
  createdAt: Date;
  updatedAt: Date;
}

const ImageAssetSchema = new Schema<ImageAssetInterface>(
  {
    image_id: { type: String, required: true, unique: true, index: true },
    filename: { type: String, required: true },
    url:      { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ImageAssetInterface>("ImageAsset", ImageAssetSchema);