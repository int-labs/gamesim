import { Router } from "express";
import {
  getAllDecisions,
  createDecision,
  getDecisionByParams,
  updateDecisionByParams,
  deleteDecisionByParams,
  getDecisionById,
  getPastInitiatives,
  readCurrentRoundDecision,
  readPrevRoundDecision,
  getPreviousDecisions, // Import the new controller
} from "../controllers/decisionControllers"; // Adjust the path as necessary
import { authenticate } from "../utils/middleware/authentication";
import { authorize } from "../utils/middleware/authorization";

const router = Router();

// Define routes
router.get("/", getAllDecisions); // Get all decisions
router.post("/", authenticate, authorize(["team"]), createDecision); // Create a new decision
router.get(
  "/past-initiatives",
  authenticate,
  authorize(["team"]),
  getPastInitiatives
); // Get all decisions
router.get("/current-round", authenticate, authorize(["team"]), readCurrentRoundDecision);
router.get("/prev-round", authenticate, authorize(["team"]), readPrevRoundDecision);
router.get("/previous-decisions", authenticate, authorize(["team"]), getPreviousDecisions);
router.get("/:decisionId", getDecisionById); // Get decision by ID
router.get("/:simulationId/:teamId/:roundNumber?", getDecisionByParams); // Made roundNumber optional
router.put("/:simulationId/:teamId/:roundNumber?", updateDecisionByParams); // Made roundNumber optional
router.delete("/:simulationId/:teamId/:roundNumber?", deleteDecisionByParams); // Made roundNumber optional

export default router;
