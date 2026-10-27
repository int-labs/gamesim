import { Router } from "express";
import {
  createDebriefChartStyle,
  deleteDebriefChartStyle,
  getDebriefChartStyles,
  updateDebriefChartStyle,
} from "../controllers/debriefChartStyleControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// Readable by any authenticated caller: the gallery is global and carries no
// simulation's data, and the player receives each chart's shape anyway.
router.get("/", getDebriefChartStyles);

// A shape is rendered by the player, so writing one is strictly admin —
// narrower than /round-notes, which operators may also write.
const WRITE = [authorize([ROLES.ADMIN])];
router.post("/", ...WRITE, createDebriefChartStyle);
router.patch("/:id", ...WRITE, updateDebriefChartStyle);
router.delete("/:id", ...WRITE, deleteDebriefChartStyle);

export default router;
