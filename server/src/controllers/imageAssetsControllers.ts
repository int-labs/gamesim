import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import ImageAsset from "../models/imageAssets";
import { uploadImage, deleteImage } from "../constants/supabase";

// POST /image-assets
export const uploadImageAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file provided." });
      return;
    }

    const image_id = uuidv4();
    const filename = req.file.originalname;

    const url = await uploadImage(req.file.buffer, image_id);

    const existing = await ImageAsset.findOne({ filename });
    if (existing) {
      res.status(409).json({ message: "Image with this filename already exists." });
      return;
    }

    const imageAsset = await ImageAsset.create({ image_id, filename, url });
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

    await deleteImage(req.params.image_id);
    await ImageAsset.deleteOne({ image_id: req.params.image_id });

    res.status(200).json({ message: "Image asset deleted." });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete image asset." });
  }
};