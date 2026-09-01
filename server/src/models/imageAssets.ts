import mongoose, { Document, Schema } from "mongoose";

export interface ImageAssetInterface extends Document {
  image_id:    string;
  filename:    string;
  url:         string;
  /** Key the object is stored under. Older rows predate this field and used
   *  the bare `image_id`, which is what the delete path falls back to. */
  storageKey?: string;
  /** Bucket the object was written to. Absent on rows predating per-upload
   *  bucket choice, which went to the default — the delete path falls back to
   *  it, so an old row still deletes from where it actually lives. */
  bucket?:     string;
  contentType?: string;
  size?:       number;
  createdAt:   Date;
  updatedAt:   Date;
}

const ImageAssetSchema = new Schema<ImageAssetInterface>(
  {
    image_id:    { type: String, required: true, unique: true, index: true },
    filename:    { type: String, required: true },
    url:         { type: String, required: true },
    storageKey:  { type: String },
    bucket:      { type: String },
    contentType: { type: String },
    size:        { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model<ImageAssetInterface>("ImageAsset", ImageAssetSchema, "imageAssets");