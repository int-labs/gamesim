import { Router } from "express";
import {
  getRoundsBySimulation,
  getRoundById,
  createRound,
  updateRoundStatus,
  deleteRound,
} from "../controllers/roundControllers";
import { authenticate } from "../middleware/authenticate";
import { authorise } from "../middleware/authorise";

const router = Router();

router.use(authenticate);

// GET    /rounds?simulationId=   → list all rounds for a simulation
// POST   /rounds                 → create a new round (admin/operator)
// GET    /rounds/:id             → get single round
// PATCH  /rounds/:id/status      → advance/update round status (admin/operator)
// DELETE /rounds/:id             → delete round (admin)
router.get("/", getRoundsBySimulation);
router.post("/", authorise("admin", "operator"), createRound);
router.get("/:id", getRoundById);
router.patch("/:id/status", authorise("admin", "operator"), updateRoundStatus);
router.delete("/:id", authorise("admin"), deleteRound);

export default router;
