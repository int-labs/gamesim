import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiOptions,
  UploadApiResponse,
} from "cloudinary";
import express, { RequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Multer (2MB, memory storage, images only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      return cb(null, true);
    }
    // mark a custom validation error and reject the file
    (req as any).fileValidationError = "Only JPG, PNG, or WebP allowed";
    return cb(null, false);
  },
});

// ---------- Cloudinary upload helper (Promise)
function uploadToCloudinary(
  buffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (err?: UploadApiErrorResponse, res?: UploadApiResponse) => {
        if (err) return reject(err);
        if (!res) return reject(new Error("No response from Cloudinary"));
        resolve(res);
      }
    );
    stream.end(buffer);
  });
}

// ---------- Helpers
const ROOT_FOLDER = process.env.CLOUDINARY_ROOT || "stratagem";
const isObjectId = (v?: string) => !!v && /^[a-f0-9]{24}$/i.test(v);

/** Extract only 24-hex ObjectIDs from a free-form path string */
function extractObjectIdsFromPath(path?: string): string[] {
  if (!path) return [];
  return (path.match(/[a-f0-9]{24}/gi) || []).map((s) => s.toLowerCase());
}

/** Build folder path: stratagem/<ids...>/img  */
function buildFolderPath(ids: string[]): string {
  const parts = ids.filter(isObjectId);
  return [ROOT_FOLDER, ...parts, "img"].join("/");
}

// ---------- Main handler
const uploadHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    if ((req as any).fileValidationError) {
      res.status(400).json({ error: (req as any).fileValidationError });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Accept either explicit params (?st=&sim=&team=) OR a single ?path=/... string
    const st = (req.query.st as string | undefined)?.trim();
    const sim = (req.query.sim as string | undefined)?.trim();
    const team = (req.query.team as string | undefined)?.trim();
    const path = (req.query.path as string | undefined)?.trim();

    // Priority: if st/sim/team provided, use those; else parse ids from path
    const idsFromParams = [st, sim, team].filter(isObjectId) as string[];
    const ids =
      idsFromParams.length > 0 ? idsFromParams : extractObjectIdsFromPath(path);

    // Build final folder (always ends with /img)
    const folderPath = buildFolderPath(ids);

    // --- Sanitize filename -> public_id (no extension)
    const rawName = req.file.originalname || "image";
    const baseName = rawName
      .replace(/\.[^/.]+$/g, "") // drop extension
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "");
    const publicId = `${Date.now()}-${baseName}`;

    // --- Process with sharp (square, webp)
    const img = sharp(req.file.buffer);
    const meta = await img.metadata();
    const side = Math.max(meta.width ?? 0, meta.height ?? 0, 200);
    const processed = await img
      .resize(side, side, { fit: "cover" })
      .webp({ quality: 90 })
      .toBuffer();

    // --- Upload
    const result = await uploadToCloudinary(processed, {
      folder: folderPath, // stratagem/<ids>/img
      public_id: publicId, // filename here, not in folder
      resource_type: "image",
      overwrite: false,
      format: "webp",
      tags: [process.env.NODE_ENV || "unknown"], // env as metadata (not folders)
      context: { env: process.env.NODE_ENV || "unknown" },
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id, // e.g. stratagem/xxx/yyy/zzz/img/169...-name
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    });
    return;
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Upload failed" });
    return;
  }
};

// ---------- Route
router.post("", upload.single("file"), uploadHandler);

export default router;
