import { Router } from "express";
import {
  uploadImageAsset,
  getImageAssets,
  getImageAssetById,
  deleteImageAsset,
} from "../controllers/imageAssetsControllers";
import { upload } from "../constants/multer";

const router = Router();

router.post("/", upload.single("image"), uploadImageAsset);
router.get("/", getImageAssets);
router.get("/:image_id", getImageAssetById);
router.delete("/:image_id", deleteImageAsset);

export default router;