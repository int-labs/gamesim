import express, { RequestHandler } from "express";
import ImageAsset from "../models/imageAssets";

const router = express.Router();

// ---------- Helpers
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const DEFAULT_WIDTH  = 144;
const DEFAULT_HEIGHT = 288;

// ---------- Main handler
const uploadHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    const { image_id, filename, mimeType, data, width, height } = req.body;

    // --- Validate required fields
    if (!image_id || typeof image_id !== "string" || !image_id.trim()) {
      res.status(400).json({ error: "image_id is required" });
      return;
    }
    if (!filename || typeof filename !== "string" || !filename.trim()) {
      res.status(400).json({ error: "filename is required" });
      return;
    }
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      res
        .status(400)
        .json({ error: `mimeType must be one of: ${ALLOWED_MIME_TYPES.join(", ")}` });
      return;
    }
    if (!data || typeof data !== "string") {
      res.status(400).json({ error: "data (base64 string) is required" });
      return;
    }

    // --- Decode base64 → Buffer
    // Accept either raw base64 or a data URI (data:image/png;base64,<...>)
    const base64Str = data.includes(",") ? data.split(",")[1] : data;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Str, "base64");
    } catch {
      res.status(400).json({ error: "Invalid base64 data" });
      return;
    }

    if (buffer.length === 0) {
      res.status(400).json({ error: "Decoded image buffer is empty" });
      return;
    }

    // --- Upsert into imageAssets (replace if image_id already exists)
    const asset = await ImageAsset.findOneAndUpdate(
      { image_id: image_id.trim() },
      {
        image_id: image_id.trim(),
        filename:  filename.trim(),
        mimeType,
        width:  width  ?? DEFAULT_WIDTH,
        height: height ?? DEFAULT_HEIGHT,
        data:   buffer,
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
      _id:      asset._id,
      image_id: asset.image_id,
      filename: asset.filename,
      mimeType: asset.mimeType,
      width:    asset.width,
      height:   asset.height,
      bytes:    buffer.length,
    });
    return;
  } catch (err: any) {
    // Duplicate key race condition (concurrent upserts)
    if (err.code === 11000) {
      res.status(409).json({ error: "image_id already exists" });
      return;
    }
    res.status(500).json({ error: err?.message ?? "Upload failed" });
    return;
  }
};

// ---------- GET single image by image_id (serve raw binary)
const serveHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    const asset = await ImageAsset.findOne({ image_id: req.params.image_id });
    if (!asset) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    res.set("Content-Type", asset.mimeType);
    res.set("Cache-Control", "public, max-age=31536000");
    res.send(asset.data);
    return;
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Fetch failed" });
    return;
  }
};

// ---------- DELETE image by image_id
const deleteHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    const deleted = await ImageAsset.findOneAndDelete({ image_id: req.params.image_id });
    if (!deleted) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    res.status(200).json({ message: "Image deleted", image_id: req.params.image_id });
    return;
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Delete failed" });
    return;
  }
};

// ---------- Routes
// POST   /upload          → upload base64 image, store as Buffer in MongoDB
// GET    /upload/:image_id → serve raw image binary
// DELETE /upload/:image_id → remove image from DB
router.post("/", uploadHandler);
router.get("/:image_id", serveHandler);
router.delete("/:image_id", deleteHandler);

export default router;
