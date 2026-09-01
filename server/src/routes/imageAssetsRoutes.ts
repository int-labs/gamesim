import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import {
  uploadImageAsset,
  getImageAssets,
  getImageAssetById,
  getStorageStatus,
  getStorageBuckets,
  deleteImageAsset,
} from "../controllers/imageAssetsControllers";
import { upload } from "../constants/multer";

const router = Router();

/**
 * Multer rejects (wrong type, file too large) are thrown from middleware, and
 * with no error handler Express renders them as a 500 HTML stack trace — which
 * a fetch() caller reads as an unexplained server crash. Turn them into the
 * 400 the client can actually show.
 */
const handleUploadErrors = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That image is larger than the 5 MB limit."
        : `Upload rejected (${err.code}).`;
    res.status(400).json({ message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ message: err.message });
    return;
  }
  next(err);
};

router.post("/", upload.single("image"), handleUploadErrors, uploadImageAsset);
router.get("/", getImageAssets);
// Must precede "/:image_id", which would otherwise swallow them.
router.get("/storage", getStorageStatus);
router.get("/buckets", getStorageBuckets);
router.get("/:image_id", getImageAssetById);
router.delete("/:image_id", deleteImageAsset);

export default router;
