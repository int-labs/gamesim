import mongoose, { Document, Schema } from "mongoose";

export interface ImageAssetInterface extends Document {
  image_id: string;        // Unique reference ID for the frontend to look up
  filename: string;        // Original filename
  mimeType: string;        // e.g. "image/png", "image/jpeg"
  width: number;           // Expected: 144
  height: number;          // Expected: 288
  data: Buffer;            // Raw binary image data (BLOB)
  createdAt: Date;
  updatedAt: Date;
}

const imageAssetSchema = new Schema<ImageAssetInterface>(
  {
    image_id: {
      type: String,
      required: true,
      unique: true,
      index: true,         // Indexed so frontend lookups by image_id are fast
    },
    filename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    },
    width: {
      type: Number,
      default: 144,
    },
    height: {
      type: Number,
      default: 288,
    },
    data: {
      type: Buffer,        // MongoDB BSON Binary — stores raw image bytes
      required: true,
    },
  },
  {
    timestamps: true,      // Auto-manages createdAt and updatedAt
  }
);

const ImageAsset = mongoose.model<ImageAssetInterface>("ImageAsset", imageAssetSchema);

export default ImageAsset;