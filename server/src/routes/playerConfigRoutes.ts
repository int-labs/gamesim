import { Router } from "express";
import {
  getPlayerConfig,
  patchPlayerConfigSection,
  publishPlayerConfig,
  putPlayerConfig,
  revertPlayerConfigDraft,
} from "../controllers/playerConfigControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// Readable by any authenticated caller — team tokens included, because the
// player fetches this at boot. The handler itself gates `?draft=true`.
router.get("/:simulationTypeId", getPlayerConfig);

const WRITE = [authorize([ROLES.ADMIN, ROLES.OPERATOR])];

router.put("/:simulationTypeId", ...WRITE, putPlayerConfig);
router.patch("/:simulationTypeId/section/:section", ...WRITE, patchPlayerConfigSection);
router.post("/:simulationTypeId/publish", ...WRITE, publishPlayerConfig);
router.post("/:simulationTypeId/revert", ...WRITE, revertPlayerConfigDraft);

export default router;
