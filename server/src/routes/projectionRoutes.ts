import { Router } from "express";
import {
  getProjectionsByTeam,
  getProjectionById,
  deleteProjection,
  deleteProjectionsByRound,
  recalcProjections,
} from "../controllers/projectionControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// Projections are LIVE WHAT-IF only. See ../../README.md#the-four-collections

router.get("/", getProjectionsByTeam);
router.post("/recalc", authenticate, recalcProjections);
// Collection routes BEFORE `/:id` — Express matches in order.
router.delete("/", authorize([ROLES.ADMIN]), deleteProjectionsByRound);
router.get("/:id", getProjectionById);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteProjection);

export default router;
