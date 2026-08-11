import { Router } from "express";
import {
  createDiceBearAvatar,
  getAvatarStyles,
  previewAvatar,
} from "../controllers/teamMemberControllers";
import { authenticate } from "../middleware/authentication";

const router = Router();

router.use(authenticate);

// Any authenticated caller — teams pick their own faces, so these can't be
// admin-only. Nothing here writes to a team; storing an avatar is a separate
// call to PUT /teams/:id/avatar, which does check ownership.
router.get("/styles", getAvatarStyles);
router.post("/preview", previewAvatar);
router.post("/dicebear", createDiceBearAvatar);

export default router;
