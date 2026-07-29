import { Router } from "express";
import {
  getRoundsBySimulation,
  getRoundById,
  createRound,
  updateRoundStatus,
  deleteRound,
  deleteResultsByRound,
  calculateRound,
} from "../controllers/roundControllers";
import { finalizeRound } from "../controllers/roundFinalizationControllers";
import { authenticate } from "../middleware/authentication";
import { authorize } from "../middleware/authorization";
import { ROLES } from "../constants/roles";

const router = Router();

router.use(authenticate);

// GET    /rounds?simulationId=   → list all rounds for a simulation
// POST   /rounds                 → create a new round (admin/operator)
// GET    /rounds/:id             → get single round
// PATCH  /rounds/:id/status      → advance/update round status (admin/operator)
// POST   /rounds/:roundId/finalize → run the engine + persist results (admin/operator)
// DELETE /rounds/:id             → delete round (admin)
router.delete("/", authenticate, authorize([ROLES.ADMIN]), deleteResultsByRound);
router.get("/", getRoundsBySimulation);
router.post("/:id/calculate", authenticate, authorize([ROLES.ADMIN, ROLES.OPERATOR]), calculateRound);
router.post("/", authorize([ROLES.ADMIN, ROLES.OPERATOR]), createRound);
router.get("/:id", getRoundById);
router.patch("/:id/status", authorize([ROLES.ADMIN, ROLES.OPERATOR]), updateRoundStatus);
router.post("/:roundId/finalize", authorize([ROLES.ADMIN, ROLES.OPERATOR]), finalizeRound);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteRound);

export default router;
