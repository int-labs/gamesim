import { Request, Response } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ImageAsset from "../models/imageAssets";
import {
  deleteObject,
  listBuckets,
  objectExists,
  putObject,
  resolveStorage,
} from "../services/storage";

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

    // Multer puts non-file form fields on `body`. Validated against the live
    // bucket list rather than passed through: an unknown name would otherwise
    // surface as an opaque Supabase error after the read has already happened.
    // Multer puts non-file form fields on `body`. The bucket is REQUIRED: there
    // is no default to fall back to, because storage is partitioned by
    // simulation type and no bucket is right to guess.
    const bucket = typeof req.body?.bucket === "string" ? req.body.bucket.trim() : "";
    const available = await listBuckets().catch(() => []);

    if (!bucket) {
      res.status(400).json({
        message: "A storage bucket is required. Choose which bucket to upload to.",
        buckets: available.map((b) => b.name),
      });
      return;
    }

    // `listBuckets()` is the authoritative existence check: `from(b).list()`
    // succeeds for ANY name, including one that has never existed, so it cannot
    // stand in for this. An empty list means the local driver, where buckets do
    // not apply.
    if (available.length > 0 && !available.some((b) => b.name === bucket)) {
      res.status(400).json({
        message: `Unknown storage bucket "${bucket}".`,
        buckets: available.map((b) => b.name),
      });
      return;
    }

    const url = await putObject(req.file.buffer, storageKey, req.file.mimetype, bucket);

    const imageAsset = await ImageAsset.create({
      image_id,
      filename,
      url,
      storageKey,
      bucket,
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
  try {
    // Verified, not assumed: `resolveStorage` actually asks Supabase whether it
    // is there. Reporting "durable" off the presence of two env vars is how the
    // console ended up promising durability while every upload failed.
    const { driver, durable, detail } = await resolveStorage();
    res.status(200).json({ driver, durable, message: detail });
  } catch (err: any) {
    // Without this, a rejection is an unhandled promise in an Express handler:
    // no response at all, and the request hangs until the client gives up.
    res.status(500).json({ message: err?.message ?? "Failed to resolve storage." });
  }
};

// GET /image-assets/buckets — which buckets an upload may target.
export const getStorageBuckets = async (_req: Request, res: Response): Promise<void> => {
  try {
    // No `defaultBucket`: there isn't one, and returning a suggestion would
    // invite the console to pre-select a bucket the operator never chose.
    const buckets = await listBuckets();
    res.status(200).json({ buckets });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to list storage buckets." });
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

    // Rows written before `storageKey` existed were stored under the bare id.
    const key = imageAsset.storageKey ?? imageAsset.image_id;
    const bucket = imageAsset.bucket;

    // Look before removing. Supabase's `remove()` reports success on a missing
    // object, so the check is what distinguishes "deleted the file" from "there
    // was no file" — and lets the answer say which.
    //
    // ── WHICH ORPHAN IS SURVIVABLE ──────────────────────────────────────────
    // The record is removed EITHER WAY, and a failed lookup is treated as "not
    // found" rather than aborting. That is deliberate, and it is the asymmetry
    // to preserve if this is ever revisited:
    //
    //   A record without its object is the BAD orphan. The pointer still
    //   resolves, so the console lists a healthy-looking row and the player
    //   renders an empty image from a URL that looks correct. Nothing announces
    //   the failure, and an administrator — who has no Supabase access — has no
    //   way to see it, let alone fix it.
    //
    //   An object without its record is the SURVIVABLE orphan. Every lookup
    //   returns null/undefined, which is loud, traceable, and re-uploadable.
    //   The cost is a stray file in a bucket.
    //
    // So on any doubt, drop the record. Failing the other way — keeping a
    // record whose object may be gone — manufactures the invisible failure.
    const present = bucket ? await objectExists(key, bucket).catch(() => false) : false;

    if (present) await deleteObject(key, bucket!);
    await ImageAsset.deleteOne({ image_id: req.params.image_id });

    res.status(200).json({
      message: present
        ? "Image asset deleted."
        : `No file was found${bucket ? ` in "${bucket}"` : ""} for "${imageAsset.filename}", so only the orphaned record was removed.`,
      fileDeleted: present,
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete image asset." });
  }
};
