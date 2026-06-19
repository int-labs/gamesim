import { Router } from "express";
import {
  getRoundsBySimulation,
  getRoundById,
  createRound,
  updateRoundStatus,
  deleteRound,
} from "../controllers/roundControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

// router.use(authenticate);

// GET    /rounds?simulationId=   → list all rounds for a simulation
// POST   /rounds                 → create a new round (admin/operator)
// GET    /rounds/:id             → get single round
// PATCH  /rounds/:id/status      → advance/update round status (admin/operator)
// DELETE /rounds/:id             → delete round (admin)
router.get("/", getRoundsBySimulation);
router.post("/", authorize([ROLES.ADMIN, ROLES.OPERATOR]), createRound);
router.get("/:id", getRoundById);
router.patch("/:id/status", authorize([ROLES.ADMIN, ROLES.OPERATOR]), updateRoundStatus);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteRound);

export default router;
