import { Router } from "express";
import {
  getDecisionById,
  createDecision,
  deleteDecision,
  getDecisions,
} from "../controllers/decisionsControllers";
import { authenticate } from "../middleware/authentication";
import { authorize }    from "../middleware/authorization";
import { ROLES } from "../constants/roles";
import { deleteDecisionsByRound } from "../controllers/decisionsControllers";

const router = Router();

router.use(authenticate);

// GET    /decisions?simulationId=&teamId=&roundNumber=&productId=&segmentId=
//          → query decisions; filterable by any combination of index fields
//          → useful for CSV export by simulationId, or per-team per-round drill-down
//
// POST   /decisions
//          → team submits a decision for one product in a round
//          → insert only; resubmission rejected (409) if record already exists
//
// GET    /decisions/:id
//          → get a single decision document
//
// DELETE /decisions/:id
//          → hard delete a decision (admin only)
//            use sparingly — decisions are meant to be immutable after submission
router.delete("/", authenticate, authorize([ROLES.ADMIN]), deleteDecisionsByRound);
router.get("/", getDecisions);
router.post("/", createDecision);
router.get("/:id", getDecisionById);
router.delete("/:id", authorize([ROLES.ADMIN]), deleteDecision);

export default router;