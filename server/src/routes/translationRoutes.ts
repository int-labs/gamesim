import express from "express";
import {
  bulkTranslateText,
  translateText,
} from "../controllers/translationControllers";
import { authenticate } from "../utils/middleware/authentication";
import { authorize } from "../utils/middleware/authorization";

const router = express.Router();

router.post("/", authenticate, authorize(["admin"]), translateText);
router.post("/bulk", authenticate, authorize(["admin"]), bulkTranslateText);

export default router;
