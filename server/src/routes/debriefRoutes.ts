import { Router } from "express";
import {
  getDebrief,
  publishDebrief,
  putDebrief,
  unpublishDebrief,
} from "../controllers/debriefControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// The published + Completed gate lives in the controller, so teams can call
// this freely and simply get a 404 until it unlocks.
router.get("/", getDebrief);

const WRITE = [authorize([ROLES.ADMIN, ROLES.OPERATOR])];
router.put("/", ...WRITE, putDebrief);
router.post("/publish", ...WRITE, publishDebrief);
router.post("/unpublish", ...WRITE, unpublishDebrief);

export default router;
