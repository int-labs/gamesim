import { Request, Response } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ImageAsset from "../models/imageAssets";
import { deleteObject, putObject, resolveStorage } from "../services/storage";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/gif": ".gif",
};

// POST /image-assets
export const uploadImageAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file provided." });
      return;
    }

    const filename = req.file.originalname;

    // Check BEFORE writing the object. The original order uploaded first and
    // then bailed on a duplicate name, leaving an orphaned file in the bucket
    // on every collision.
    const existing = await ImageAsset.findOne({ filename });
    if (existing) {
      res.status(409).json({
        message: `An image named "${filename}" already exists.`,
        imageAsset: existing,
      });
      return;
    }

    const image_id = uuidv4();
    // Keep the extension on the stored object: a local file served without one
    // is sniffed as application/octet-stream and downloads instead of
    // rendering.
    const ext = EXT_BY_MIME[req.file.mimetype] ?? path.extname(filename).toLowerCase();
    const storageKey = `${image_id}${ext}`;

    const url = await putObject(req.file.buffer, storageKey, req.file.mimetype);

    const imageAsset = await ImageAsset.create({
      image_id,
      filename,
      url,
      storageKey,
      contentType: req.file.mimetype,
      size: req.file.size,
    });

    res.status(201).json(imageAsset);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to upload image." });
  }
};

// GET /image-assets
export const getImageAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageAssets = await ImageAsset.find().sort({ createdAt: -1 });
    res.status(200).json(imageAssets);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch image assets." });
  }
};

// GET /image-assets/storage — which driver is live, so the console can say so
// instead of letting an operator assume uploads are durable when they aren't.
export const getStorageStatus = async (_req: Request, res: Response): Promise<void> => {
  // Verified, not assumed: `resolveStorage` actually asks Supabase whether it
  // is there. Reporting "durable" off the presence of two env vars is how the
  // console ended up promising durability while every upload failed.
  const { driver, durable, detail } = await resolveStorage();
  res.status(200).json({ driver, durable, message: detail });
};

// GET /image-assets/:image_id
export const getImageAssetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageAsset = await ImageAsset.findOne({ image_id: req.params.image_id });
    if (!imageAsset) {
      res.status(404).json({ message: "Image asset not found." });
      return;
    }
    res.status(200).json(imageAsset);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch image asset." });
  }
};

// DELETE /image-assets/:image_id
export const deleteImageAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageAsset = await ImageAsset.findOne({ image_id: req.params.image_id });
    if (!imageAsset) {
      res.status(404).json({ message: "Image asset not found." });
      return;
    }

    // Rows written before `storageKey` existed were stored under the bare id.
    await deleteObject(imageAsset.storageKey ?? imageAsset.image_id);
    await ImageAsset.deleteOne({ image_id: req.params.image_id });

    res.status(200).json({ message: "Image asset deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete image asset." });
  }
};
