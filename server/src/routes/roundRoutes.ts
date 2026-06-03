import { Router } from "express";
import {
  addEventToRound,
  createRound,
  deleteRoundBySimulationIdAndRoundNumber,
  getAllRounds,
  getRoundBySimulationIdAndRoundNumber,
  updateRoundBySimulationIdAndRoundNumber,
  updateRoundEvent,
} from "../controllers/roundControllers";
import { authenticate } from "../utils/middleware/authentication";
import { authorize } from "../utils/middleware/authorization";

const router = Router();

router.get("/", getAllRounds);
router.post("/", createRound);
router.post(
  "/:roundId/events",
  authenticate,
  authorize(["admin"]),
  addEventToRound
);
router.put(
  "/:roundId/events",
  authenticate,
  authorize(["admin"]),
  updateRoundEvent
);
router.get(
  "/:simulationId/:roundNumber?",
  getRoundBySimulationIdAndRoundNumber
);
router.put(
  "/:simulationId/:roundNumber",
  updateRoundBySimulationIdAndRoundNumber
);
router.delete(
  "/:simulationId/:roundNumber",
  deleteRoundBySimulationIdAndRoundNumber
);

export default router;
