import { Router } from "express";
import {
  createDebriefChart,
  deleteDebriefChart,
  getDebriefCharts,
  updateDebriefChart,
} from "../controllers/debriefChartControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// Readable by any authenticated caller. A simulation type's chart list is
// configuration, not another team's data — and the player already receives it
// resolved on /round-debrief.
router.get("/", getDebriefCharts);

const WRITE = [authorize([ROLES.ADMIN, ROLES.OPERATOR])];
router.post("/", ...WRITE, createDebriefChart);
router.patch("/:id", ...WRITE, updateDebriefChart);
router.delete("/:id", ...WRITE, deleteDebriefChart);

export default router;
